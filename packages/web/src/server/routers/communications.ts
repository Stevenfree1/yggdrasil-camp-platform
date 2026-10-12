import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, managerProcedure, leadProcedure } from '../trpc';
import { buildBrandedEmail, sendPersonalizedMassEmail } from '../lib/email';
import { resolveRecipients, isDuesUnpaid } from '../lib/recipients';
import { buildRecipientContext, renderMergeFields } from '../lib/mergeFields';
import { MASS_EMAIL_TEMPLATES, getMassEmailTemplate } from '../lib/massEmailTemplates';

const recipientFilterEnum = z.enum([
  'all',
  'confirmed',
  'unpaid_dues',
  'build_crew',
  'strike_crew',
  'not_on_whatsapp',
  'no_preapproval',
  'no_ticket',
  'no_travel_plans',
  'custom',
]);

export const communicationsRouter = router({
  /**
   * Returns counts and member lists for action items that need attention.
   * Excludes CANCELLED members from all queries.
   */
  getActionItems: managerProcedure
    .input(z.object({ seasonId: z.string().uuid().optional() }).optional().default({}))
    .query(async ({ ctx, input }) => {
      let { seasonId } = input;

      if (!seasonId) {
        const activeSeason = await ctx.prisma.season.findFirst({
          where: { isActive: true },
          select: { id: true },
        });

        if (!activeSeason) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
        }

        seasonId = activeSeason.id;
      }

      // Verify season exists
      const season = await ctx.prisma.season.findUnique({
        where: { id: seasonId },
        select: { id: true, duesAmount: true },
      });

      if (!season) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
      }

      // ── Unpaid Dues ──
      // Find season members whose DUES payments total less than the season's duesAmount
      const allNonCancelledSMs = await ctx.prisma.seasonMember.findMany({
        where: {
          seasonId,
          status: { not: 'CANCELLED' },
        },
        include: {
          member: { select: { id: true, name: true, email: true, playaName: true } },
          payments: {
            where: { type: 'DUES' },
            select: { amount: true },
          },
        },
      });

      const unpaidDues = allNonCancelledSMs
        .filter((sm) =>
          isDuesUnpaid({
            duesStatus: sm.duesStatus,
            duesOverrideCents: sm.duesOverrideCents,
            seasonDuesCents: season.duesAmount,
            duesPaidCents: sm.payments.reduce((sum, p) => sum + p.amount, 0),
          }),
        )
        .map((sm) => ({
          seasonMemberId: sm.id,
          memberId: sm.member.id,
          name: sm.member.name,
          email: sm.member.email,
          playaName: sm.member.playaName,
          totalPaid: sm.payments.reduce((sum, p) => sum + p.amount, 0),
          duesAmount: season.duesAmount,
        }));

      // ── No Ticket ──
      // Members without a Ticket record for this season
      const membersWithTickets = await ctx.prisma.ticket.findMany({
        where: { seasonId },
        select: { memberId: true },
      });
      const memberIdsWithTickets = new Set(membersWithTickets.map((t) => t.memberId));

      const noTicket = allNonCancelledSMs
        .filter((sm) => !memberIdsWithTickets.has(sm.member.id))
        .map((sm) => ({
          seasonMemberId: sm.id,
          memberId: sm.member.id,
          name: sm.member.name,
          email: sm.member.email,
          playaName: sm.member.playaName,
        }));

      // ── Not on WhatsApp ──
      const notOnWhatsApp = allNonCancelledSMs
        .filter((sm) => !sm.addedToWhatsApp)
        .map((sm) => ({
          seasonMemberId: sm.id,
          memberId: sm.member.id,
          name: sm.member.name,
          email: sm.member.email,
          playaName: sm.member.playaName,
        }));

      // ── No Pre-Approval ──
      const noPreApproval = allNonCancelledSMs
        .filter((sm) => sm.preApprovalForm === null || sm.preApprovalForm === 'NO')
        .map((sm) => ({
          seasonMemberId: sm.id,
          memberId: sm.member.id,
          name: sm.member.name,
          email: sm.member.email,
          playaName: sm.member.playaName,
          preApprovalForm: sm.preApprovalForm,
        }));

      // ── Pending Applications ──
      const pendingApplications = await ctx.prisma.application.findMany({
        where: { status: 'PENDING' },
        select: {
          id: true,
          name: true,
          email: true,
          playaName: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        unpaidDues: { count: unpaidDues.length, members: unpaidDues },
        noTicket: { count: noTicket.length, members: noTicket },
        notOnWhatsApp: { count: notOnWhatsApp.length, members: notOnWhatsApp },
        noPreApproval: { count: noPreApproval.length, members: noPreApproval },
        pendingApplications: { count: pendingApplications.length, applications: pendingApplications },
      };
    }),

  /**
   * Send a mass email to filtered groups of members.
   * Only available to camp leads.
   */
  /** The code-defined broadcast templates, for the composer's "start from template" picker. */
  listTemplates: leadProcedure.query(() => MASS_EMAIL_TEMPLATES),

  sendMassEmail: leadProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(50000),
      recipientFilter: recipientFilterEnum,
      customEmails: z.array(z.string().email()).optional(),
      // Optional source template — recorded in the audit log only. The subject/body
      // above are authoritative (the client prefills then lets the admin edit).
      templateKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { seasonId, subject, body, recipientFilter, customEmails, templateKey } = input;

      if (templateKey && !getMassEmailTemplate(templateKey)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown template: ${templateKey}` });
      }

      const season = await ctx.prisma.season.findUnique({
        where: { id: seasonId },
        select: { id: true, name: true, year: true, duesAmount: true },
      });
      if (!season) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
      }

      const recipients = await resolveRecipients(ctx.prisma, {
        seasonId,
        filter: recipientFilter,
        customEmails,
      });
      if (recipients.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No recipients matched the selected filter',
        });
      }

      // Shared context is the same for everyone; the rest is rendered per recipient
      // so each person gets their own {{firstName}} / {{duesAmount}}.
      const shared = { seasonName: season.name?.trim() || `the ${season.year} season` };
      const messages = recipients.map((r) => {
        const context = buildRecipientContext(r, shared, season.duesAmount);
        const renderedSubject = renderMergeFields(subject, context);
        const renderedBody = renderMergeFields(body, context);
        const { html, text } = buildBrandedEmail(renderedSubject, renderedBody);
        return { to: r.email, subject: renderedSubject, html, text };
      });

      const result = await sendPersonalizedMassEmail(messages, 'MASS_EMAIL');

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'MASS_EMAIL_SENT',
          entityType: 'Season',
          entityId: seasonId,
          details: {
            subject,
            templateKey: templateKey ?? null,
            recipientFilter,
            recipientCount: recipients.length,
            sent: result.sent,
            failed: result.failed,
            errors: result.errors,
          },
        },
      });

      return result;
    }),
});
