import { randomUUID } from 'crypto';
import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import type { EmailType, EmailStatus } from '@prisma/client';
import logger from './logger';
import prisma from './prisma';
import { getCampConfig } from '@/lib/config';

const campConfig = getCampConfig();
const CAMP_NAME = campConfig.name;
const CAMP_DOMAIN = campConfig.domain;
const CONTACT_EMAIL = campConfig.email;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const EMAIL_FROM = process.env.EMAIL_FROM || `${campConfig.name} <noreply@${campConfig.domain}>`;
const APP_URL = process.env.APP_URL || campConfig.website;
const PAYMENTS_EMAIL = process.env.PAYMENTS_EMAIL || `payments@${campConfig.domain}`;
// Optional WhatsApp group invite link surfaced in the welcome email. If unset,
// the email tells the new member their lead will add them manually.
const WHATSAPP_INVITE_URL = process.env.WHATSAPP_INVITE_URL || '';

// Determine which transport to use: SendGrid first, then SMTP, then log-only
let transportMode: 'sendgrid' | 'smtp' | 'log' = 'log';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  transportMode = 'sendgrid';
  logger.info('Email transport: SendGrid');
} else if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transportMode = 'smtp';
  logger.info('Email transport: SMTP (Nodemailer)');
} else {
  logger.warn('Email transport: log-only (no SENDGRID_API_KEY or SMTP credentials configured)');
}

// Lazy-initialised Nodemailer transport
let _nodemailerTransport: nodemailer.Transporter | null = null;
function getNodemailerTransport(): nodemailer.Transporter {
  if (!_nodemailerTransport) {
    _nodemailerTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _nodemailerTransport;
}

// ---------------------------------------------------------------------------
// Brand constants used across every template
// ---------------------------------------------------------------------------

const BRAND = {
  sage: '#4A5D5A',
  sageDark: '#2F4243',
  sageLight: '#8A9D9A',
  desertTan: '#D4C4A8',
  desertTanLight: '#F5EFE6',
  gold: '#D4AF37',
  goldDark: '#AC8A21',
  cream: '#FAF7F2',
  ink: '#2C2416',
  inkSecondary: '#5A4F3C',
  borderLight: '#E9E2D5',
  fontDisplay: "'Cinzel', 'Georgia', serif",
  fontBody: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  fontAccent: "'Cormorant', 'Georgia', serif",
} as const;

// ---------------------------------------------------------------------------
// Core send helper
// ---------------------------------------------------------------------------

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Template tag stored on the EmailLog row (defaults to OTHER). */
  type?: EmailType;
  /** Admin who initiated the send, when known. */
  triggeredByMemberId?: string;
}

/**
 * Injects a 1×1 self-hosted tracking pixel referencing the EmailLog row. When
 * the recipient's client loads it, /api/email/open/[id] stamps openedAt. This
 * is the same technique Resend's open tracking uses, with the same caveats
 * (Apple Mail Privacy pre-fetches inflate opens), but needs no external config.
 */
function injectOpenPixel(html: string, logId: string): string {
  const pixel =
    `<img src="${APP_URL}/api/email/open/${logId}" alt="" width="1" height="1" ` +
    `style="display:none;width:1px;height:1px;max-width:0;max-height:0;border:0;overflow:hidden;" />`;
  return html.includes('</body>')
    ? html.replace('</body>', `${pixel}</body>`)
    : `${html}${pixel}`;
}

/**
 * Records one EmailLog row for a send attempt. Resolves the recipient member by
 * email or previousEmails. Logging failures are swallowed — they must never
 * break email delivery.
 */
async function recordEmailLog(args: {
  logId: string;
  to: string;
  subject: string;
  type: EmailType;
  status: EmailStatus;
  error?: string;
  triggeredByMemberId?: string;
}): Promise<void> {
  try {
    const member = await prisma.member.findFirst({
      where: { OR: [{ email: args.to }, { previousEmails: { has: args.to } }] },
      select: { id: true },
    });
    await prisma.emailLog.create({
      data: {
        id: args.logId,
        to: args.to,
        memberId: member?.id ?? null,
        type: args.type,
        subject: args.subject,
        status: args.status,
        error: args.error ?? null,
        transport: transportMode,
        triggeredByMemberId: args.triggeredByMemberId ?? null,
      },
    });
  } catch (err: any) {
    logger.error(`Failed to write EmailLog for ${args.to}: ${err?.message || err}`);
  }
}

// When non-null, sendEmail captures the built email into this buffer instead of
// sending/logging — used by getEmailPreviews() to render the templates with
// sample data. Null in all normal operation, so it has zero effect on sends.
let _captureBuffer: { type: EmailType; subject: string; html: string }[] | null = null;

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const { to, subject, html, text, type = 'OTHER', triggeredByMemberId } = payload;

  if (_captureBuffer) {
    _captureBuffer.push({ type, subject, html });
    return true;
  }

  const logId = randomUUID();

  let status: EmailStatus;
  let errorMessage: string | undefined;

  if (transportMode === 'log') {
    logger.info(`[EMAIL-LOG] To: ${to} | Subject: ${subject}`);
    logger.debug(`[EMAIL-LOG] Text:\n${text}`);
    status = 'LOGGED_ONLY';
  } else {
    const trackedHtml = injectOpenPixel(html, logId);
    try {
      if (transportMode === 'sendgrid') {
        await sgMail.send({ to, from: EMAIL_FROM, subject, html: trackedHtml, text });
      } else {
        const transport = getNodemailerTransport();
        await transport.sendMail({ from: EMAIL_FROM, to, subject, html: trackedHtml, text });
      }
      logger.info(`Email sent to ${to}: ${subject}`);
      status = 'SENT';
    } catch (err: any) {
      errorMessage = err?.message ? String(err.message) : String(err);
      logger.error(`Failed to send email to ${to}: ${errorMessage}`);
      status = 'FAILED';
    }
  }

  await recordEmailLog({ logId, to, subject, type, status, error: errorMessage, triggeredByMemberId });

  return status !== 'FAILED';
}

// ---------------------------------------------------------------------------
// HTML template helpers
// ---------------------------------------------------------------------------

/**
 * Wraps email body content in the branded layout shell.
 * Uses table-based layout for maximum email client compatibility.
 */
function layout(bodyContent: string, preheaderText?: string): string {
  const preheader = preheaderText
    ? `<span style="display:none;font-size:1px;color:${BRAND.cream};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheaderText}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${CAMP_NAME}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: ${BRAND.desertTanLight}; }
    a { color: ${BRAND.gold}; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; }
      .padding-mobile { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.desertTanLight};font-family:${BRAND.fontBody};">
  ${preheader}

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${BRAND.desertTanLight};">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <!-- Main card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(44,36,22,0.1);">

          <!-- Header band -->
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND.sage} 0%, ${BRAND.sageDark} 100%);padding:32px 40px;text-align:center;">
              <!-- Gold accent line -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="60" style="margin:0 auto 16px auto;">
                <tr><td style="height:2px;background-color:${BRAND.gold};"></td></tr>
              </table>
              <h1 style="margin:0;font-family:${BRAND.fontDisplay};font-size:26px;font-weight:400;letter-spacing:3px;color:${BRAND.cream};text-transform:uppercase;">${CAMP_NAME}</h1>
              <p style="margin:6px 0 0;font-family:${BRAND.fontAccent};font-size:14px;font-style:italic;color:${BRAND.desertTan};letter-spacing:1px;">${campConfig.tagline}</p>
              <!-- Gold accent line -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="60" style="margin:16px auto 0 auto;">
                <tr><td style="height:2px;background-color:${BRAND.gold};"></td></tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="padding-mobile" style="padding:36px 40px;background-color:#ffffff;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND.cream};padding:24px 40px;border-top:1px solid ${BRAND.borderLight};">
              <!-- Decorative divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:16px;">
                <tr>
                  <td style="height:1px;background:linear-gradient(to right, transparent, ${BRAND.desertTan}, ${BRAND.gold}, ${BRAND.desertTan}, transparent);"></td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-family:${BRAND.fontDisplay};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.sageLight};text-align:center;">${CAMP_NAME} &middot; Black Rock City</p>
              <p style="margin:0;font-family:${BRAND.fontBody};font-size:12px;color:${BRAND.inkSecondary};text-align:center;line-height:1.6;">
                <a href="${APP_URL}" style="color:${BRAND.sage};text-decoration:underline;">${CAMP_DOMAIN}</a>
              </p>
              <p style="margin:12px 0 0;font-family:${BRAND.fontBody};font-size:11px;color:${BRAND.sageLight};text-align:center;line-height:1.5;">
                You received this email because of your relationship with ${CAMP_NAME}.<br />
                If you believe this was sent in error, please contact us at ${CONTACT_EMAIL}.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Main card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates a branded CTA button (table-based for Outlook compatibility).
 */
function ctaButton(text: string, href: string): string {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto;">
  <tr>
    <td style="border-radius:6px;background:linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%);">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:${BRAND.fontDisplay};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:6px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

/**
 * Renders a heading line within the email body.
 */
function heading(text: string): string {
  return `<h2 style="margin:0 0 16px;font-family:${BRAND.fontDisplay};font-size:20px;font-weight:400;letter-spacing:1px;color:${BRAND.sage};">${text}</h2>`;
}

/**
 * Renders a standard paragraph.
 */
function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${BRAND.fontBody};font-size:15px;line-height:1.7;color:${BRAND.ink};">${text}</p>`;
}

/**
 * Renders an informational box with a subtle background.
 */
function infoBox(content: string): string {
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
  <tr>
    <td style="padding:20px 24px;background-color:${BRAND.cream};border-radius:6px;border-left:3px solid ${BRAND.gold};">
      ${content}
    </td>
  </tr>
</table>`;
}

/**
 * Small muted text.
 */
function smallText(text: string): string {
  return `<p style="margin:0 0 8px;font-family:${BRAND.fontBody};font-size:12px;line-height:1.6;color:${BRAND.inkSecondary};">${text}</p>`;
}

// ---------------------------------------------------------------------------
// Public email functions
// ---------------------------------------------------------------------------

/**
 * Send a welcome email to a newly registered / accepted member.
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
  opts?: { whatsappUrl?: string },
): Promise<boolean> {
  const firstName = name.split(' ')[0];
  const whatsappUrl = opts?.whatsappUrl ?? WHATSAPP_INVITE_URL;

  const whatsappBlockHtml = whatsappUrl
    ? infoBox(
        `<p style="margin:0 0 12px;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">Join the camp WhatsApp</strong><br/>` +
        `This is where day-to-day camp coordination happens. Tap below to join.</p>` +
        ctaButton('Join WhatsApp Group', whatsappUrl),
      )
    : infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">Camp WhatsApp</strong><br/>` +
        `A camp lead will add you to our WhatsApp group, where day-to-day coordination happens.</p>`,
      );

  const html = layout(
    [
      heading(`Welcome to ${CAMP_NAME}, ${firstName}`),
      paragraph(
        'Your dues are in and your spot is confirmed &mdash; welcome to the family! ' + CAMP_NAME + ' is built on ' +
        'radical inclusion, gifting, and a shared love of showing up for one another.'
      ),
      paragraph(
        'As a member you now have access to your personal dashboard where you can manage your profile, ' +
        'track season details, view your lodging placement, and stay connected with the camp.'
      ),
      ctaButton('Visit Your Dashboard', `${APP_URL}/portal`),
      whatsappBlockHtml,
      paragraph(
        'If you have any questions, reach out to your camp leads or reply to this email. ' +
        'We look forward to seeing you in Black Rock City!'
      ),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">With warmth and dust,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `Welcome to ${CAMP_NAME}, ${firstName}! Your spot is confirmed.`
  );

  const text = [
    `Welcome to ${CAMP_NAME}, ${firstName}!`,
    '',
    'Your dues are in and your spot is confirmed -- welcome to the family! ' + CAMP_NAME + ' is built on radical inclusion, gifting, and a shared love of showing up for one another.',
    '',
    'As a member you now have access to your personal dashboard where you can manage your profile, track season details, view your lodging placement, and stay connected with the camp.',
    '',
    `Visit your dashboard: ${APP_URL}/portal`,
    '',
    whatsappUrl
      ? `Join the camp WhatsApp group: ${whatsappUrl}`
      : 'A camp lead will add you to our WhatsApp group, where day-to-day coordination happens.',
    '',
    'If you have any questions, reach out to your camp leads or reply to this email.',
    'We look forward to seeing you in Black Rock City!',
    '',
    'With warmth and dust,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: `Welcome to ${CAMP_NAME}, ${firstName}!`, html, text, type: 'WELCOME' });
}

/**
 * Notify a pre-approved applicant that they're in, with dues payment
 * instructions and a deadline. Payment methods all route to PAYMENTS_EMAIL.
 */
export async function sendPreApprovalDuesEmail(
  to: string,
  name: string,
  opts: { duesLabel: string; deadlineLabel: string },
): Promise<boolean> {
  const firstName = name.split(' ')[0];
  const { duesLabel, deadlineLabel } = opts;

  const html = layout(
    [
      heading(`You&rsquo;re Pre-Approved, ${firstName}!`),
      paragraph(
        `Great news &mdash; you&rsquo;ve been pre-approved to camp with ${CAMP_NAME} this season. ` +
        `To lock in your spot, please pay your membership dues by <strong style="color:${BRAND.sage};">${deadlineLabel}</strong>.`
      ),
      infoBox(
        `<p style="margin:0 0 6px;font-family:${BRAND.fontDisplay};font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${BRAND.sage};">Membership Dues</p>` +
        `<p style="margin:0 0 12px;font-family:${BRAND.fontBody};font-size:22px;font-weight:600;color:${BRAND.ink};">${duesLabel}</p>` +
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.7;">` +
        `Pay by <strong>PayPal</strong>, <strong>Venmo</strong>, <strong>Zelle</strong>, or <strong>bank transfer</strong>, all to:<br/>` +
        `<a href="mailto:${PAYMENTS_EMAIL}" style="color:${BRAND.gold};font-weight:600;">${PAYMENTS_EMAIL}</a><br/>` +
        `Please include your full name in the payment note so we can match it to your application.</p>`
      ),
      paragraph(
        `If we don&rsquo;t receive your dues by ${deadlineLabel}, your pre-approval may be released to someone on the waitlist. ` +
        `If you need more time or have any questions, just reply to this email.`
      ),
      ctaButton('Learn About ' + CAMP_NAME, `${APP_URL}`),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">See you on the playa,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `You're pre-approved! Pay your dues by ${deadlineLabel} to confirm your spot.`
  );

  const text = [
    `You're Pre-Approved, ${firstName}!`,
    '',
    `Great news -- you've been pre-approved to camp with ${CAMP_NAME} this season.`,
    `To lock in your spot, please pay your membership dues by ${deadlineLabel}.`,
    '',
    `MEMBERSHIP DUES: ${duesLabel}`,
    `Pay by PayPal, Venmo, Zelle, or bank transfer, all to: ${PAYMENTS_EMAIL}`,
    'Please include your full name in the payment note so we can match it to your application.',
    '',
    `If we don't receive your dues by ${deadlineLabel}, your pre-approval may be released to someone on the waitlist.`,
    'If you need more time or have questions, just reply to this email.',
    '',
    `Learn more: ${APP_URL}`,
    '',
    'See you on the playa,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: `You're Pre-Approved for ${CAMP_NAME} — Dues Due ${deadlineLabel}`, html, text, type: 'PRE_APPROVAL_DUES' });
}

/**
 * Notify an applicant their pre-approval lapsed because dues weren't received
 * in the window. They're moved to the waitlist (not declined).
 */
export async function sendPreApprovalExpiredEmail(to: string, name: string): Promise<boolean> {
  const firstName = name.split(' ')[0];

  const html = layout(
    [
      heading('Your Pre-Approval Window Has Closed'),
      paragraph(
        `Hi ${firstName}, we didn&rsquo;t receive your membership dues within the pre-approval window, so we&rsquo;ve ` +
        `moved your application to our <strong style="color:${BRAND.sage};">waitlist</strong> for now.`
      ),
      paragraph(
        'This isn&rsquo;t a no &mdash; spots often open back up. If you still want to camp with us this season, ' +
        'just reply to this email and we&rsquo;ll see what we can do.'
      ),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">Warm regards,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `Your ${CAMP_NAME} pre-approval window has closed`
  );

  const text = [
    'Your Pre-Approval Window Has Closed',
    '',
    `Hi ${firstName}, we didn't receive your membership dues within the pre-approval window, so we've moved your application to our waitlist for now.`,
    '',
    "This isn't a no -- spots often open back up. If you still want to camp with us this season, just reply to this email and we'll see what we can do.",
    '',
    'Warm regards,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: CAMP_NAME + ' — Pre-Approval Window Closed', html, text, type: 'PRE_APPROVAL_EXPIRED' });
}

/**
 * Send a password reset email with a secure token link.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  resetUrl?: string,
): Promise<boolean> {
  const url = resetUrl || `${APP_URL}/reset-password?token=${resetToken}`;

  const html = layout(
    [
      heading('Reset Your Password'),
      paragraph(
        'We received a request to reset the password for your ' + CAMP_NAME + ' account. ' +
        'Click the button below to choose a new password.'
      ),
      ctaButton('Reset Password', url),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:13px;color:${BRAND.inkSecondary};line-height:1.6;">` +
        `This link will expire in <strong>1 hour</strong>. If you didn&rsquo;t request a password reset, you can safely ignore this email &mdash; your password will remain unchanged.</p>`
      ),
      smallText(`If the button above doesn&rsquo;t work, copy and paste this URL into your browser:`),
      `<p style="margin:0 0 16px;font-family:${BRAND.fontBody};font-size:12px;color:${BRAND.gold};word-break:break-all;line-height:1.5;">${url}</p>`,
    ].join('\n'),
    'Reset your ' + CAMP_NAME + ' password'
  );

  const text = [
    'Reset Your Password',
    '',
    'We received a request to reset the password for your ' + CAMP_NAME + ' account.',
    'Visit the following link to choose a new password:',
    '',
    url,
    '',
    'This link will expire in 1 hour.',
    "If you didn't request a password reset, you can safely ignore this email.",
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: 'Reset Your ' + CAMP_NAME + ' Password', html, text, type: 'PASSWORD_RESET' });
}

/**
 * Send an invitation email for a new member to join the camp.
 */
export async function sendInviteEmail(
  to: string,
  inviterName: string,
  inviteToken: string,
  inviteUrl?: string,
): Promise<boolean> {
  const url = inviteUrl || `${APP_URL}/invite/${inviteToken}`;

  const html = layout(
    [
      heading("You're Invited to " + CAMP_NAME),
      paragraph(
        `<strong style="color:${BRAND.sage};">${inviterName}</strong> has invited you to join ${CAMP_NAME} &mdash; ` +
        'a Burning Man theme camp built on community and radical self-expression.'
      ),
      paragraph(
        'By accepting this invitation you will create your member account and gain access to the camp portal ' +
        'where you can manage your season participation, housing, payments, and more.'
      ),
      ctaButton('Accept Invitation', url),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">About ${CAMP_NAME}</strong><br/>` +
        `${campConfig.description}</p>`
      ),
      smallText(`If the button above doesn&rsquo;t work, copy and paste this URL into your browser:`),
      `<p style="margin:0 0 16px;font-family:${BRAND.fontBody};font-size:12px;color:${BRAND.gold};word-break:break-all;line-height:1.5;">${url}</p>`,
    ].join('\n'),
    `${inviterName} has invited you to join ${CAMP_NAME}`
  );

  const text = [
    "You're Invited to " + CAMP_NAME + "!",
    '',
    `${inviterName} has invited you to join ${CAMP_NAME} -- a Burning Man theme camp built on community and radical self-expression.`,
    '',
    'Accept your invitation and create your account here:',
    url,
    '',
    'About ' + CAMP_NAME + ':',
    campConfig.description,
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: `You're Invited to Join ${CAMP_NAME}`, html, text, type: 'INVITE' });
}

/**
 * Send a confirmation email after a membership application is submitted.
 */
export async function sendApplicationConfirmation(to: string, name: string): Promise<boolean> {
  const firstName = name.split(' ')[0];

  const html = layout(
    [
      heading('Application Received'),
      paragraph(
        `Thank you, ${firstName}! We have received your membership application for ${CAMP_NAME}. ` +
        'Our team will review your application and get back to you as soon as possible.'
      ),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">What happens next?</strong><br/>` +
        `Our camp leads review every application personally. You can expect to hear back within 1&ndash;2 weeks. ` +
        `In the meantime, feel free to explore our website to learn more about the camp.</p>`
      ),
      ctaButton('Learn About ' + CAMP_NAME, `${APP_URL}`),
      paragraph(
        'If you have any questions while you wait, please don&rsquo;t hesitate to reach out to us at ' +
        '<a href="mailto:' + CONTACT_EMAIL + '" style="color:' + BRAND.gold + ';">' + CONTACT_EMAIL + '</a>.'
      ),
    ].join('\n'),
    `We received your ${CAMP_NAME} application, ${firstName}!`
  );

  const text = [
    'Application Received',
    '',
    `Thank you, ${firstName}! We have received your membership application for ${CAMP_NAME}.`,
    'Our team will review your application and get back to you as soon as possible.',
    '',
    "What happens next?",
    'Our camp leads review every application personally. You can expect to hear back within 1-2 weeks.',
    'In the meantime, feel free to explore our website to learn more about the camp.',
    '',
    `Learn more: ${APP_URL}`,
    '',
    'Questions? Contact us at ' + CONTACT_EMAIL,
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: 'Application Received - ' + CAMP_NAME, html, text, type: 'APPLICATION_CONFIRMATION' });
}

/**
 * Notify an applicant that their membership application has been approved.
 */
export async function sendApplicationApproved(to: string, name: string): Promise<boolean> {
  const firstName = name.split(' ')[0];

  const html = layout(
    [
      heading('Congratulations! You&rsquo;re In'),
      paragraph(
        `Great news, ${firstName}! Your application to join ${CAMP_NAME} has been <strong style="color:${BRAND.sage};">approved</strong>. ` +
        'Welcome to the family!'
      ),
      paragraph(
        'You will receive a separate invitation email shortly with a link to set up your member account. ' +
        'Once your account is active you can access the member portal to manage your season participation.'
      ),
      ctaButton('Visit ' + CAMP_NAME, `${APP_URL}`),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">Getting started</strong><br/>` +
        `Once you set up your account, complete your profile and review the current season details. ` +
        `Your camp leads will reach out with more information about next steps, dues, and logistics.</p>`
      ),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">See you on the playa!<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `Congratulations ${firstName}! Your ${CAMP_NAME} application has been approved.`
  );

  const text = [
    "Congratulations! You're In!",
    '',
    `Great news, ${firstName}! Your application to join ${CAMP_NAME} has been approved. Welcome to the family!`,
    '',
    'You will receive a separate invitation email shortly with a link to set up your member account.',
    'Once your account is active you can access the member portal to manage your season participation.',
    '',
    `Visit ${CAMP_NAME}: ${APP_URL}`,
    '',
    'Getting started:',
    'Once you set up your account, complete your profile and review the current season details.',
    'Your camp leads will reach out with more information about next steps, dues, and logistics.',
    '',
    'See you on the playa!',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: 'Welcome to ' + CAMP_NAME + ' - Application Approved!', html, text, type: 'APPLICATION_APPROVED' });
}

/**
 * Sent when an approved applicant becomes a member and needs to set up their
 * account (new members, or imported members who never set a password). Carries
 * the set-password link → /invite/[token]. This is the email the old
 * "application approved" template promised but never sent.
 */
export async function sendProfileSetupEmail(
  to: string,
  name: string,
  inviteToken: string,
  opts?: { inviteUrl?: string; whatsappUrl?: string },
): Promise<boolean> {
  const firstName = name.split(' ')[0];
  const url = opts?.inviteUrl || `${APP_URL}/invite/${inviteToken}`;
  const whatsappUrl = opts?.whatsappUrl ?? WHATSAPP_INVITE_URL;

  const whatsappBlockHtml = whatsappUrl
    ? infoBox(
        `<p style="margin:0 0 12px;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">Join the camp WhatsApp</strong><br/>` +
        `This is where day-to-day camp coordination happens.</p>` +
        ctaButton('Join WhatsApp Group', whatsappUrl),
      )
    : '';

  const html = layout(
    [
      heading(`Welcome to ${CAMP_NAME}, ${firstName} &mdash; You&rsquo;re In!`),
      paragraph(
        'Your application has been approved and you&rsquo;re officially part of the camp. ' +
        'The last step is to set up your member account so you can manage your profile, season details, and more.'
      ),
      ctaButton('Set Up Your Account', url),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">What happens when you click</strong><br/>` +
        `You&rsquo;ll choose a password and land in your member portal, where you can complete your profile. ` +
        `Membership dues are handled separately &mdash; your camp leads will follow up with details, so there&rsquo;s nothing to pay right now.</p>`
      ),
      whatsappBlockHtml,
      smallText(`If the button above doesn&rsquo;t work, copy and paste this link into your browser:`),
      `<p style="margin:0 0 16px;font-family:${BRAND.fontBody};font-size:12px;color:${BRAND.gold};word-break:break-all;line-height:1.5;">${url}</p>`,
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">See you on the playa,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `You're in, ${firstName}! Set up your ${CAMP_NAME} account.`
  );

  const text = [
    `Welcome to ${CAMP_NAME}, ${firstName} -- You're In!`,
    '',
    'Your application has been approved and you are officially part of the camp.',
    'The last step is to set up your member account:',
    '',
    url,
    '',
    "You'll choose a password and land in your member portal, where you can complete your profile.",
    'Membership dues are handled separately -- your camp leads will follow up, so there is nothing to pay right now.',
    '',
    whatsappUrl ? `Join the camp WhatsApp group: ${whatsappUrl}` : '',
    '',
    'See you on the playa,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].filter(Boolean).join('\n');

  return sendEmail({ to, subject: `Welcome to ${CAMP_NAME} — Set Up Your Account`, html, text, type: 'PROFILE_SETUP' });
}

/**
 * Sent when an approved applicant already has an active account (a returning
 * member). We never reset their password — we just welcome them back and point
 * them to log in.
 */
export async function sendWelcomeBackEmail(
  to: string,
  name: string,
  opts?: { loginUrl?: string },
): Promise<boolean> {
  const firstName = name.split(' ')[0];
  const url = opts?.loginUrl || `${APP_URL}/login`;

  const html = layout(
    [
      heading(`Welcome Back, ${firstName}!`),
      paragraph(
        'Great news &mdash; you&rsquo;re in for this season! You already have a ' + CAMP_NAME + ' account, ' +
        'so there&rsquo;s nothing new to set up. Just log in to manage your profile and season details.'
      ),
      ctaButton('Log In', url),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">Can&rsquo;t remember your password?</strong><br/>` +
        `Use the &ldquo;Forgot password&rdquo; link on the login page to set a new one. ` +
        `Membership dues are handled separately &mdash; your camp leads will follow up with details.</p>`
      ),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">See you on the playa,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `Welcome back to ${CAMP_NAME}, ${firstName}!`
  );

  const text = [
    `Welcome Back, ${firstName}!`,
    '',
    "Great news -- you're in for this season! You already have a " + CAMP_NAME + " account, so there's nothing new to set up.",
    'Just log in to manage your profile and season details:',
    '',
    url,
    '',
    'Can\'t remember your password? Use the "Forgot password" link on the login page to set a new one.',
    'Membership dues are handled separately -- your camp leads will follow up with details.',
    '',
    'See you on the playa,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: `Welcome Back to ${CAMP_NAME}, ${firstName}!`, html, text, type: 'WELCOME_BACK' });
}

/**
 * Notify an applicant that their membership application has been denied.
 */
export async function sendApplicationDenied(to: string, name: string): Promise<boolean> {
  const firstName = name.split(' ')[0];

  const html = layout(
    [
      heading('Application Update'),
      paragraph(
        `Dear ${firstName}, thank you for your interest in ${CAMP_NAME} and for taking the time to submit your application.`
      ),
      paragraph(
        'After careful review, we are unable to offer you a spot in the camp for this season. ' +
        'Please know that this was a difficult decision &mdash; we receive many more applications than we have space for, ' +
        'and it does not reflect on you personally.'
      ),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `We encourage you to apply again for future seasons. Camp composition changes year to year, ` +
        `and we would love to consider you again.</p>`
      ),
      paragraph(
        'If you have questions or would like feedback, feel free to reach out to us at ' +
        '<a href="mailto:' + CONTACT_EMAIL + '" style="color:' + BRAND.gold + ';">' + CONTACT_EMAIL + '</a>.'
      ),
      paragraph('We wish you a wonderful Burn wherever you call home on the playa.'),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">Warm regards,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `${CAMP_NAME} application update for ${firstName}`
  );

  const text = [
    'Application Update',
    '',
    `Dear ${firstName}, thank you for your interest in ${CAMP_NAME} and for taking the time to submit your application.`,
    '',
    'After careful review, we are unable to offer you a spot in the camp for this season.',
    'Please know that this was a difficult decision -- we receive many more applications than we have space for, and it does not reflect on you personally.',
    '',
    'We encourage you to apply again for future seasons. Camp composition changes year to year, and we would love to consider you again.',
    '',
    'If you have questions or would like feedback, feel free to reach out to us at ' + CONTACT_EMAIL + '.',
    '',
    'We wish you a wonderful Burn wherever you call home on the playa.',
    '',
    'Warm regards,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: CAMP_NAME + ' - Application Update', html, text, type: 'APPLICATION_DENIED' });
}

/**
 * Send a membership renewal / dues reminder email.
 */
export async function sendMembershipReminder(to: string, name: string): Promise<boolean> {
  const firstName = name.split(' ')[0];

  const html = layout(
    [
      heading('Season Reminder'),
      paragraph(
        `Hi ${firstName}! This is a friendly reminder that the new ${CAMP_NAME} season is approaching. ` +
        'Please log in to your member portal to confirm your participation and review any outstanding items.'
      ),
      ctaButton('Go to Member Portal', `${APP_URL}/members`),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.6;">` +
        `<strong style="color:${BRAND.sage};">Action items</strong><br/>` +
        `&bull; Confirm your participation status<br/>` +
        `&bull; Update your profile and emergency contacts<br/>` +
        `&bull; Review housing and logistics preferences<br/>` +
        `&bull; Check your dues and payment status</p>`
      ),
      paragraph(
        'If your plans have changed and you will not be joining us this season, please update your status so ' +
        'we can plan accordingly.'
      ),
      paragraph(
        'Questions? Reach out to your camp leads or email us at ' +
        '<a href="mailto:' + CONTACT_EMAIL + '" style="color:' + BRAND.gold + ';">' + CONTACT_EMAIL + '</a>.'
      ),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">See you in the dust,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `Season reminder for ${firstName} - Action needed`
  );

  const text = [
    'Season Reminder',
    '',
    `Hi ${firstName}! This is a friendly reminder that the new ${CAMP_NAME} season is approaching.`,
    'Please log in to your member portal to confirm your participation and review any outstanding items.',
    '',
    `Member portal: ${APP_URL}/members`,
    '',
    'Action items:',
    '- Confirm your participation status',
    '- Update your profile and emergency contacts',
    '- Review housing and logistics preferences',
    '- Check your dues and payment status',
    '',
    'If your plans have changed and you will not be joining us this season, please update your status so we can plan accordingly.',
    '',
    'Questions? Email us at ' + CONTACT_EMAIL,
    '',
    'See you in the dust,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: CAMP_NAME + ' - Season Reminder', html, text, type: 'MEMBERSHIP_REMINDER' });
}

/**
 * Remind a member to pay dues before the price goes up. Dues increase by a
 * fixed amount after the deadline and continue to climb each month after,
 * so this nudges members to pay early and lock in the lowest rate. Also notes
 * the no-guaranteed-refund policy for last-minute cancellations.
 */
export async function sendDuesIncreaseReminder(
  to: string,
  name: string,
  opts?: { deadlineLabel?: string; increaseLabel?: string; payUrl?: string },
): Promise<boolean> {
  const firstName = name.split(' ')[0];
  const deadlineLabel = opts?.deadlineLabel ?? 'June 30';
  const increaseLabel = opts?.increaseLabel ?? '$100';
  const payUrl = opts?.payUrl ?? `${APP_URL}/portal/payments`;

  const html = layout(
    [
      heading('Friendly Dues Reminder'),
      paragraph(
        `Hi ${firstName}! A quick heads-up on ${CAMP_NAME} dues: rates go up by ` +
        `<strong style="color:${BRAND.sage};">${increaseLabel}</strong> after ` +
        `<strong style="color:${BRAND.sage};">${deadlineLabel}</strong>, and continue to increase by ` +
        `${increaseLabel} each month after that. We highly recommend paying early to lock in the lowest rate.`
      ),
      infoBox(
        `<p style="margin:0 0 6px;font-family:${BRAND.fontDisplay};font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${BRAND.sage};">Dues Schedule</p>` +
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};line-height:1.7;">` +
        `&bull; Pay on or before <strong>${deadlineLabel}</strong> &mdash; lowest rate<br/>` +
        `&bull; After ${deadlineLabel} &mdash; dues go up ${increaseLabel}<br/>` +
        `&bull; Each month after &mdash; another ${increaseLabel} increase</p>`
      ),
      ctaButton('Pay Your Dues', payUrl),
      infoBox(
        `<p style="margin:0;font-family:${BRAND.fontBody};font-size:13px;color:${BRAND.inkSecondary};line-height:1.7;">` +
        `<strong style="color:${BRAND.sage};">A note on refunds</strong><br/>` +
        `Because we start making camp commitments and purchases well before the event, we can&rsquo;t guarantee ` +
        `refunds for last-minute cancellations. Please make sure you&rsquo;re committed before paying.</p>`
      ),
      paragraph(
        'Questions about your dues or payment? Just reply to this email or reach out to your camp leads at ' +
        '<a href="mailto:' + PAYMENTS_EMAIL + '" style="color:' + BRAND.gold + ';">' + PAYMENTS_EMAIL + '</a>.'
      ),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">See you in the dust,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `Pay your ${CAMP_NAME} dues by ${deadlineLabel} to lock in the lowest rate.`
  );

  const text = [
    'Friendly Dues Reminder',
    '',
    `Hi ${firstName}! A quick heads-up on ${CAMP_NAME} dues: rates go up by ${increaseLabel} after ${deadlineLabel}, and continue to increase by ${increaseLabel} each month after that. We highly recommend paying early to lock in the lowest rate.`,
    '',
    'DUES SCHEDULE',
    `- Pay on or before ${deadlineLabel} -- lowest rate`,
    `- After ${deadlineLabel} -- dues go up ${increaseLabel}`,
    `- Each month after -- another ${increaseLabel} increase`,
    '',
    `Pay your dues: ${payUrl}`,
    '',
    'A NOTE ON REFUNDS',
    "Because we start making camp commitments and purchases well before the event, we can't guarantee refunds for last-minute cancellations. Please make sure you're committed before paying.",
    '',
    `Questions about your dues or payment? Reply to this email or reach out to your camp leads at ${PAYMENTS_EMAIL}.`,
    '',
    'See you in the dust,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({
    to,
    subject: `Reminder: ${CAMP_NAME} Dues Go Up After ${deadlineLabel}`,
    html,
    text,
    type: 'DUES_INCREASE_REMINDER',
  });
}

/**
 * Send a donation receipt email to a donor.
 * Includes tax-deductibility information only when the camp has a tax status configured.
 */
export async function sendDonationReceipt(
  to: string,
  donorName: string,
  amount: string,
  date: string,
  campaignName?: string,
): Promise<boolean> {
  const firstName = donorName.split(' ')[0] || 'Friend';
  const campaign = campaignName || `${campConfig.name} General Fund`;

  const taxStatus = campConfig.taxStatus;
  const taxBlockHtml = taxStatus
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">` +
      `<tr><td style="padding:16px 20px;background-color:${BRAND.cream};border-radius:6px;border:1px solid ${BRAND.borderLight};">` +
      `<p style="margin:0 0 8px;font-family:${BRAND.fontDisplay};font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${BRAND.sage};">Tax Information</p>` +
      `<p style="margin:0;font-family:${BRAND.fontBody};font-size:13px;line-height:1.6;color:${BRAND.inkSecondary};">` +
      `${CAMP_NAME} is a ${taxStatus} organization. This donation is tax-deductible to the extent allowed by law. ` +
      `No goods or services were provided in exchange for this contribution. Please retain this email as your official donation receipt.</p>` +
      `</td></tr></table>`
    : '';

  const html = layout(
    [
      heading('Thank You for Your Donation'),
      paragraph(
        `Dear ${firstName}, thank you for your generous contribution to ${CAMP_NAME}. ` +
        'Your support helps us build art cars, host community events, and make the playa feel a little more like home.'
      ),
      infoBox(
        `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">` +
        `<tr><td style="padding:4px 0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.inkSecondary};">Donor</td>` +
        `<td style="padding:4px 0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};text-align:right;font-weight:600;">${donorName}</td></tr>` +
        `<tr><td style="padding:4px 0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.inkSecondary};">Amount</td>` +
        `<td style="padding:4px 0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};text-align:right;font-weight:600;">${amount}</td></tr>` +
        `<tr><td style="padding:4px 0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.inkSecondary};">Date</td>` +
        `<td style="padding:4px 0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};text-align:right;">${date}</td></tr>` +
        `<tr><td style="padding:4px 0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.inkSecondary};">Campaign</td>` +
        `<td style="padding:4px 0;font-family:${BRAND.fontBody};font-size:14px;color:${BRAND.ink};text-align:right;">${campaign}</td></tr>` +
        `</table>`
      ),
      taxBlockHtml,
      paragraph(
        'Your generosity makes a real difference. Every dollar goes directly into art installations, camp infrastructure, ' +
        'community events, and the hospitality that defines ' + CAMP_NAME + '.'
      ),
      ctaButton('Visit ' + CAMP_NAME, `${APP_URL}`),
      `<p style="margin:24px 0 0;font-family:${BRAND.fontAccent};font-size:16px;font-style:italic;color:${BRAND.sage};">With gratitude,<br/>The ${CAMP_NAME} Team</p>`,
    ].join('\n'),
    `Thank you for your donation of ${amount} to ${CAMP_NAME}!`
  );

  const text = [
    `Thank You for Your Donation, ${firstName}!`,
    '',
    'Thank you for your generous contribution to ' + CAMP_NAME + '.',
    'Your support helps us build art cars, host community events, and make the playa feel a little more like home.',
    '',
    'Donation Details:',
    `  Donor: ${donorName}`,
    `  Amount: ${amount}`,
    `  Date: ${date}`,
    `  Campaign: ${campaign}`,
    '',
    ...(taxStatus
      ? [
          'TAX INFORMATION',
          `${CAMP_NAME} is a ${taxStatus} organization. This donation is tax-deductible to the extent allowed by law.`,
          'No goods or services were provided in exchange for this contribution.',
          'Please retain this email as your official donation receipt.',
          '',
        ]
      : []),
    'Your generosity makes a real difference. Every dollar goes directly into art installations,',
    'camp infrastructure, community events, and the hospitality that defines ' + CAMP_NAME + '.',
    '',
    `Visit us: ${APP_URL}`,
    '',
    'With gratitude,',
    'The ' + CAMP_NAME + ' Team',
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  return sendEmail({ to, subject: `Donation Receipt - ${CAMP_NAME} (${amount})`, html, text, type: 'DONATION_RECEIPT' });
}

/**
 * Send a mass email to a list of recipients using the branded template.
 * Iterates over each recipient and calls the core sendEmail helper.
 * Returns aggregate results: how many sent, failed, and individual errors.
 */
export async function sendMassEmailToRecipients(
  recipients: string[],
  subject: string,
  body: string,
  senderName: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const html = layout(
    [
      heading(subject),
      paragraph(body),
      smallText(`Sent by ${senderName} via ${CAMP_NAME}`),
    ].join('\n'),
    subject,
  );

  const text = [
    subject,
    '',
    body,
    '',
    `Sent by ${senderName} via ${CAMP_NAME}`,
    '',
    '---',
    CAMP_NAME + ' | ' + CAMP_DOMAIN,
  ].join('\n');

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const to of recipients) {
    const ok = await sendEmail({ to, subject, html, text, type: 'MASS_EMAIL' });
    if (ok) {
      sent++;
    } else {
      failed++;
      errors.push(to);
    }
  }

  return { sent, failed, errors };
}

/** Escape the five HTML-significant characters so plain text is safe inside markup. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wrap an already-rendered (merge-substituted) plain-text body into the branded
 * shell. Blank lines become paragraph breaks; single newlines become <br/>. The
 * body is HTML-escaped, so merged-in member data can never inject markup.
 * Returns both the HTML and a plain-text alternative for the same message.
 */
export function buildBrandedEmail(subject: string, plainBody: string): { html: string; text: string } {
  const paragraphs = plainBody
    .split(/\n{2,}/)
    .map((para) => paragraph(escapeHtml(para).replace(/\n/g, '<br/>')))
    .join('\n');

  const html = layout([heading(subject), paragraphs].join('\n'), subject);
  const text = [subject, '', plainBody, '', '---', '" + CAMP_NAME + " | " + CAMP_DOMAIN + "'].join('\n');
  return { html, text };
}

/**
 * Send a batch of per-recipient (already personalized) messages. Each goes
 * through the core sendEmail path — own EmailLog row + open tracking — and a
 * per-recipient failure is counted without aborting the batch.
 */
export async function sendPersonalizedMassEmail(
  messages: { to: string; subject: string; html: string; text: string }[],
  type: EmailType = 'MASS_EMAIL',
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const m of messages) {
    const ok = await sendEmail({ to: m.to, subject: m.subject, html: m.html, text: m.text, type });
    if (ok) {
      sent++;
    } else {
      failed++;
      errors.push(m.to);
    }
  }

  return { sent, failed, errors };
}

// ---------------------------------------------------------------------------
// Named export for the entire service (useful for dependency injection / testing)
// ---------------------------------------------------------------------------

/**
 * Renders every transactional email template with representative sample data,
 * for the admin preview gallery. Reuses the real send path (no duplicated copy)
 * via the capture buffer, so previews never drift from what actually ships.
 * Returns one entry per template, in applicant-journey order.
 */
export async function getEmailPreviews(): Promise<
  { type: EmailType; subject: string; html: string }[]
> {
  _captureBuffer = [];
  try {
    const to = 'jane.doe@example.com';
    const name = 'Jane Doe';
    const token = 'PREVIEW-SAMPLE-TOKEN';
    await sendApplicationConfirmation(to, name);
    await sendApplicationApproved(to, name);
    await sendProfileSetupEmail(to, name, token);
    await sendWelcomeBackEmail(to, name);
    await sendPreApprovalDuesEmail(to, name, { duesLabel: '$1,200', deadlineLabel: 'June 30' });
    await sendPreApprovalExpiredEmail(to, name);
    await sendApplicationDenied(to, name);
    await sendWelcomeEmail(to, name);
    await sendInviteEmail(to, 'Camp Lead', token);
    await sendPasswordResetEmail(to, token);
    await sendMembershipReminder(to, name);
    await sendDuesIncreaseReminder(to, name, { deadlineLabel: 'June 30' });
    await sendDonationReceipt(to, name, '$100.00', 'May 31', 'Season Fundraiser');
    await sendMassEmailToRecipients(
      [to],
      'A Camp-Wide Update',
      'This is a sample announcement body, sent to a filtered group of members.',
      'Camp Lead',
    );
    return _captureBuffer;
  } finally {
    _captureBuffer = null;
  }
}

export const emailService = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendInviteEmail,
  sendApplicationConfirmation,
  sendApplicationApproved,
  sendApplicationDenied,
  sendProfileSetupEmail,
  sendWelcomeBackEmail,
  sendPreApprovalDuesEmail,
  sendPreApprovalExpiredEmail,
  sendMembershipReminder,
  sendDuesIncreaseReminder,
  sendDonationReceipt,
  sendMassEmailToRecipients,
};

export default emailService;
