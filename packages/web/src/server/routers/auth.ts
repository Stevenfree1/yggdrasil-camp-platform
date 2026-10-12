import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { router, publicProcedure, memberProcedure } from '../trpc';
import logger from '../lib/logger';
import { sendPasswordResetEmail } from '../lib/email';
import { assertRateLimit, normalizeRateLimitKey } from '../lib/rate-limit';
import {
  signSessionToken,
  signResetToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
} from '../lib/auth';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

const emailSchema = z.string().email('Invalid email address').max(255);

function publicUser(member: {
  id: string;
  email: string;
  name: string;
  playaName: string | null;
  role: string;
  emailVerified?: boolean;
}) {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    playaName: member.playaName,
    role: member.role,
    emailVerified: member.emailVerified ?? false,
  };
}

function rateLimitKey(action: string, value: string | undefined | null) {
  return `${action}:${normalizeRateLimitKey(value)}`;
}

export const authRouter = router({
  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1, 'Password is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.toLowerCase().trim();
      assertRateLimit({
        key: rateLimitKey('login:ip', ctx.ip),
        limit: 30,
        windowMs: 15 * 60 * 1000,
        action: 'login',
      });
      assertRateLimit({
        key: rateLimitKey('login:email', normalizedEmail),
        limit: 12,
        windowMs: 15 * 60 * 1000,
        action: 'login',
      });

      const member = await ctx.prisma.member.findUnique({
        where: { email: normalizedEmail },
      });

      if (!member || !member.passwordHash) {
        logger.security(
          `Failed login attempt for unknown or passwordless account: ${normalizedEmail}`,
          { ip: ctx.ip },
        );
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(input.password, member.passwordHash);
      if (!valid) {
        logger.security(`Failed login attempt (bad password) for: ${normalizedEmail}`, {
          ip: ctx.ip,
        });
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }

      if (!member.isActive) {
        logger.security(`Deactivated account login attempt: ${normalizedEmail}`, { ip: ctx.ip });
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Account is deactivated. Contact a camp admin.',
        });
      }

      setSessionCookie(ctx.cookieStore, signSessionToken(member.id, member.role));
      logger.info(`Login successful for ${member.email}`);

      // First post-invite login flips the active-season roster row Invited→Active.
      // Idempotent (the activatedAt:null guard no-ops on later logins) and
      // best-effort so an activation write never blocks login.
      try {
        await ctx.prisma.seasonMember.updateMany({
          where: { memberId: member.id, season: { isActive: true }, activatedAt: null },
          data: { activatedAt: new Date() },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to set activation for ${member.email} on login: ${message}`);
      }

      return { user: publicUser(member) };
    }),

  register: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        name: z.string().min(1, 'Name is required').max(100),
        playaName: z.string().max(100).optional(),
        phone: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.toLowerCase().trim();
      assertRateLimit({
        key: rateLimitKey('register:ip', ctx.ip),
        limit: 10,
        windowMs: 60 * 60 * 1000,
        action: 'registration',
      });
      assertRateLimit({
        key: rateLimitKey('register:email', normalizedEmail),
        limit: 3,
        windowMs: 60 * 60 * 1000,
        action: 'registration',
      });

      const existing = await ctx.prisma.member.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account with this email already exists',
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const member = await ctx.prisma.member.create({
        data: {
          email: normalizedEmail,
          name: input.name,
          playaName: input.playaName,
          phone: input.phone,
          passwordHash,
          role: 'MEMBER',
          isActive: true,
          emailVerified: false,
        },
      });

      setSessionCookie(ctx.cookieStore, signSessionToken(member.id, member.role));
      logger.info(`New registration: ${member.email}`);

      return { user: publicUser(member) };
    }),

  acceptInvite: publicProcedure
    .input(
      z.object({
        inviteToken: z.string().min(1, 'Invite token is required'),
        password: passwordSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertRateLimit({
        key: rateLimitKey('accept-invite:ip', ctx.ip),
        limit: 20,
        windowMs: 60 * 60 * 1000,
        action: 'invite acceptance',
      });

      const decoded = verifyToken(input.inviteToken);
      if (!decoded || typeof decoded.memberId !== 'string' || decoded.type !== 'invite') {
        logger.security('Invalid invite token presented for acceptInvite', { ip: ctx.ip });
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired invite token' });
      }

      const member = await ctx.prisma.member.findUnique({
        where: { id: decoded.memberId },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (member.passwordHash) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite already accepted' });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const updated = await ctx.prisma.member.update({
        where: { id: member.id },
        data: { passwordHash, emailVerified: true },
      });

      setSessionCookie(ctx.cookieStore, signSessionToken(updated.id, updated.role));
      logger.info(`Invite accepted by ${updated.email}`);

      // Setting a password via the invite link logs the member in without ever
      // hitting login, so flip the active-season roster row Invited→Active here
      // too. Idempotent (activatedAt:null guard) and best-effort.
      try {
        await ctx.prisma.seasonMember.updateMany({
          where: { memberId: updated.id, season: { isActive: true }, activatedAt: null },
          data: { activatedAt: new Date() },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to set activation for ${updated.email} on acceptInvite: ${message}`);
      }

      return { user: publicUser(updated) };
    }),

  validateInvite: publicProcedure
    .input(z.object({ inviteToken: z.string().min(1, 'Invite token is required') }))
    .mutation(async ({ ctx, input }) => {
      const decoded = verifyToken(input.inviteToken);
      if (!decoded || typeof decoded.memberId !== 'string' || decoded.type !== 'invite') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired invite link.' });
      }

      const member = await ctx.prisma.member.findUnique({
        where: { id: decoded.memberId },
        select: { id: true, email: true, name: true, passwordHash: true },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found.' });
      }

      if (member.passwordHash) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This invitation has already been accepted.',
        });
      }

      return { valid: true, email: member.email, name: member.name };
    }),

  forgotPassword: publicProcedure
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ ctx, input }) => {
      const normalized = input.email.toLowerCase().trim();
      assertRateLimit({
        key: rateLimitKey('forgot-password:ip', ctx.ip),
        limit: 10,
        windowMs: 60 * 60 * 1000,
        action: 'password reset',
      });
      assertRateLimit({
        key: rateLimitKey('forgot-password:email', normalized),
        limit: 5,
        windowMs: 60 * 60 * 1000,
        action: 'password reset',
      });

      const member = await ctx.prisma.member.findUnique({ where: { email: normalized } });

      if (member && member.isActive) {
        const resetToken = signResetToken(member.id);
        if (process.env.NODE_ENV === 'development') {
          logger.debug(`Reset token for ${member.email}: ${resetToken}`);
        }
        try {
          await sendPasswordResetEmail(member.email, resetToken);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Failed to send password reset email to ${member.email}: ${message}`);
        }
      } else {
        logger.security(
          `Password reset requested for non-existent/inactive email: ${normalized}`,
          { ip: ctx.ip },
        );
      }

      return {
        success: true,
        message: 'If an account with that email exists, a reset link has been sent.',
      };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1, 'Reset token is required'),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertRateLimit({
        key: rateLimitKey('reset-password:ip', ctx.ip),
        limit: 20,
        windowMs: 60 * 60 * 1000,
        action: 'password reset',
      });

      const decoded = verifyToken(input.token);
      if (!decoded || typeof decoded.memberId !== 'string' || decoded.type !== 'reset') {
        logger.security('Invalid reset token presented', { ip: ctx.ip });
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired reset token' });
      }

      const member = await ctx.prisma.member.findUnique({ where: { id: decoded.memberId } });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);

      await ctx.prisma.member.update({
        where: { id: decoded.memberId },
        data: { passwordHash },
      });

      logger.info(`Password reset completed for ${member.email}`);

      return { success: true };
    }),

  changePassword: memberProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.currentPassword === input.newPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'New password must be different from current password',
        });
      }

      const member = await ctx.prisma.member.findUnique({ where: { id: ctx.user.id } });

      if (!member || !member.passwordHash) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No password set for this account' });
      }

      const valid = await bcrypt.compare(input.currentPassword, member.passwordHash);
      if (!valid) {
        logger.security(
          `Failed password change attempt (wrong current password) for: ${member.email}`,
        );
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Current password is incorrect' });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);

      await ctx.prisma.member.update({ where: { id: ctx.user.id }, data: { passwordHash } });

      logger.info(`Password changed for ${member.email}`);

      return { success: true };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    clearSessionCookie(ctx.cookieStore);
    return { success: true };
  }),

  getProfile: memberProcedure.query(async ({ ctx }) => {
    const member = await ctx.prisma.member.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        playaName: true,
        phone: true,
        gender: true,
        role: true,
        adminScopes: true,
        isActive: true,
        emailVerified: true,
        hasAvatar: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        dietaryRestrictions: true,
        allergies: true,
        createdAt: true,
      },
    });

    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
    }

    return member;
  }),

  updateProfile: memberProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        playaName: z.string().max(100).nullable().optional(),
        phone: z.string().max(20).nullable().optional(),
        gender: z
          .enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'])
          .nullable()
          .optional(),
        emergencyContactName: z.string().max(100).nullable().optional(),
        emergencyContactPhone: z.string().max(20).nullable().optional(),
        dietaryRestrictions: z.string().max(500).nullable().optional(),
        allergies: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.member.update({
        where: { id: ctx.user.id },
        data: input,
        select: {
          id: true,
          email: true,
          name: true,
          playaName: true,
          phone: true,
          gender: true,
          role: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          dietaryRestrictions: true,
          allergies: true,
        },
      });
    }),
});
