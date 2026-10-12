import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router, memberProcedure, managerProcedure, leadProcedure } from '../trpc';
import { signInviteToken } from '../lib/auth';
import { sendInviteEmail } from '../lib/email';
import logger from '../lib/logger';

// --- Validation schemas ---

const memberSearchInput = z.object({
  search: z.string().max(200).optional(),
  role: z.enum(['LEAD', 'MANAGER', 'STAFF', 'MEMBER']).optional(),
  isActive: z.boolean().optional(),
  sortBy: z.enum(['name', 'email', 'createdAt', 'role']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
}).optional().default({});

const memberProfileInput = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  playaName: z.string().max(100).nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY']).nullable().optional(),
  emergencyContactName: z.string().max(100).nullable().optional(),
  emergencyContactPhone: z.string().max(20).nullable().optional(),
  dietaryRestrictions: z.string().max(500).nullable().optional(),
  allergies: z.string().max(500).nullable().optional(),
});

const memberDetailInclude = Prisma.validator<Prisma.MemberInclude>()({
  seasonMembers: {
    include: {
      season: {
        select: {
          id: true,
          year: true,
          name: true,
          isActive: true,
          startDate: true,
          endDate: true,
          buildStartDate: true,
          strikeEndDate: true,
        },
      },
      payments: true,
    },
    orderBy: { season: { year: 'desc' } },
  },
});

// --- Router ---

export const membersRouter = router({
  /** List members with search, filter, sort, and pagination (manager+) */
  list: managerProcedure
    .input(memberSearchInput)
    .query(async ({ ctx, input }) => {
      const where: Prisma.MemberWhereInput = {};

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } },
          { playaName: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.role) where.role = input.role;
      if (input.isActive !== undefined) where.isActive = input.isActive;

      const [members, total] = await Promise.all([
        ctx.prisma.member.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            playaName: true,
            phone: true,
            role: true,
            isActive: true,
            emailVerified: true,
            createdAt: true,
          },
          orderBy: { [input.sortBy]: input.sortOrder },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.member.count({ where }),
      ]);

      return { members, total, limit: input.limit, offset: input.offset };
    }),

  /** Get a single member by ID with season history (manager+) */
  getById: managerProcedure
    .input(z.object({ id: z.string().uuid('Invalid member ID') }))
    .query(async ({ ctx, input }) => {
      let member = await ctx.prisma.member.findUnique({
        where: { id: input.id },
        include: memberDetailInclude,
      });

      if (!member) {
        const seasonMember = await ctx.prisma.seasonMember.findUnique({
          where: { id: input.id },
          select: { memberId: true },
        });

        if (seasonMember) {
          member = await ctx.prisma.member.findUnique({
            where: { id: seasonMember.memberId },
            include: memberDetailInclude,
          });
        }
      }

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      // Omit passwordHash from response
      const { passwordHash, ...rest } = member;
      return rest;
    }),

  /** Invite a new member by email (admin only) */
  invite: leadProcedure
    .input(z.object({
      email: z.string().email('Invalid email address').max(255),
      name: z.string().min(1, 'Name is required').max(100),
      role: z.enum(['LEAD', 'MANAGER', 'STAFF', 'MEMBER']).optional().default('MEMBER'),
      seasonId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.toLowerCase().trim();

      let member = await ctx.prisma.member.findUnique({
        where: { email: normalizedEmail },
      });

      if (member?.passwordHash) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A member with this email already exists and has accepted their invite',
        });
      }

      // Existing member who never set a password → re-invite (fresh token)
      // instead of erroring, matching invitations.create semantics.
      if (!member) {
        member = await ctx.prisma.member.create({
          data: {
            email: normalizedEmail,
            name: input.name,
            role: input.role,
          },
        });
      }

      // Enroll into the target season (default: active season) so the invitee
      // shows up on the season-scoped /admin/members grid right away.
      const seasonId =
        input.seasonId ??
        (await ctx.prisma.season.findFirst({
          where: { isActive: true },
          select: { id: true },
        }))?.id;
      if (seasonId) {
        await ctx.prisma.seasonMember.upsert({
          where: { seasonId_memberId: { seasonId, memberId: member.id } },
          update: {},
          create: { seasonId, memberId: member.id, status: 'INTERESTED' },
        });
      }

      const inviteToken = signInviteToken(member.id);

      logger.info(`Member invited: ${member.email} by ${ctx.user.email}`);

      try {
        await sendInviteEmail(member.email, ctx.user.name, inviteToken);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to send invite email to ${member.email}: ${message}`);
      }

      return { member, inviteToken };
    }),

  /** Update a member's role (admin only) */
  updateRole: leadProcedure
    .input(z.object({
      memberId: z.string().uuid('Invalid member ID'),
      role: z.enum(['LEAD', 'MANAGER', 'STAFF', 'MEMBER']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.memberId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot change your own role' });
      }

      const member = await ctx.prisma.member.findUnique({
        where: { id: input.memberId },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const updated = await ctx.prisma.member.update({
        where: { id: input.memberId },
        data: { role: input.role },
        select: { id: true, email: true, name: true, role: true },
      });

      logger.info(`Role changed for ${member.email}: ${member.role} -> ${input.role} by ${ctx.user.email}`);

      return updated;
    }),

  /**
   * Grant or revoke per-area admin scopes. LEAD only — a manager granting
   * scopes could mint themselves reach they do not otherwise have.
   */
  setAdminScopes: leadProcedure
    .input(z.object({
      memberId: z.string().uuid('Invalid member ID'),
      adminScopes: z.array(z.enum(['INVENTORY', 'SHIFTS'])).max(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findUnique({
        where: { id: input.memberId },
        select: { id: true, email: true, name: true, adminScopes: true },
      });
      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      const updated = await ctx.prisma.member.update({
        where: { id: input.memberId },
        data: { adminScopes: { set: input.adminScopes } },
        select: { id: true, email: true, name: true, role: true, adminScopes: true },
      });

      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'ADMIN_SCOPES_CHANGED',
          entityType: 'Member',
          entityId: member.id,
          details: {
            subject: member.email,
            before: member.adminScopes,
            after: input.adminScopes,
          },
        },
      });

      logger.security(
        `Admin scopes for ${member.email}: [${member.adminScopes.join(',')}] -> [${input.adminScopes.join(',')}] by ${ctx.user.email}`,
      );

      return updated;
    }),

  /** Deactivate a member (admin only) */
  deactivate: leadProcedure
    .input(z.object({
      memberId: z.string().uuid('Invalid member ID'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.memberId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot deactivate your own account' });
      }

      const member = await ctx.prisma.member.findUnique({
        where: { id: input.memberId },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (!member.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Member is already deactivated' });
      }

      const updated = await ctx.prisma.member.update({
        where: { id: input.memberId },
        data: { isActive: false },
        select: { id: true, email: true, name: true, isActive: true },
      });

      logger.info(`Member deactivated: ${member.email} by ${ctx.user.email}`);

      return updated;
    }),

  /** Reactivate a deactivated member (admin only) */
  reactivate: leadProcedure
    .input(z.object({
      memberId: z.string().uuid('Invalid member ID'),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findUnique({
        where: { id: input.memberId },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (member.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Member is already active' });
      }

      const updated = await ctx.prisma.member.update({
        where: { id: input.memberId },
        data: { isActive: true },
        select: { id: true, email: true, name: true, isActive: true },
      });

      logger.info(`Member reactivated: ${member.email} by ${ctx.user.email}`);

      return updated;
    }),

  /** Permanently delete a member and all related data (admin only) */
  delete: leadProcedure
    .input(z.object({
      memberId: z.string().uuid('Invalid member ID'),
      confirmEmail: z.string().email('Must confirm with member email'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.memberId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot delete your own account' });
      }

      const member = await ctx.prisma.member.findUnique({
        where: { id: input.memberId },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      if (member.email !== input.confirmEmail.toLowerCase().trim()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Email confirmation does not match. Deletion cancelled.' });
      }

      await ctx.prisma.member.delete({
        where: { id: input.memberId },
      });

      logger.info(`Member permanently deleted: ${member.email} by ${ctx.user.email}`);

      return { success: true, deletedEmail: member.email };
    }),

  /** Admin update of a member's profile fields (admin only) */
  adminUpdate: leadProcedure
    .input(z.object({
      id: z.string().uuid('Invalid member ID'),
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().max(255).optional(),
      phone: z.string().max(20).nullable().optional(),
      playaName: z.string().max(100).nullable().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY']).nullable().optional(),
      emergencyContactName: z.string().max(100).nullable().optional(),
      emergencyContactPhone: z.string().max(20).nullable().optional(),
      dietaryRestrictions: z.string().max(500).nullable().optional(),
  allergies: z.string().max(500).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const member = await ctx.prisma.member.findUnique({
        where: { id },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return ctx.prisma.member.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          playaName: true,
          phone: true,
          gender: true,
          role: true,
          isActive: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          dietaryRestrictions: true,
          allergies: true,
          notes: true,
        },
      });
    }),

  /** Update admin notes on a member (manager+) */
  updateNotes: managerProcedure
    .input(z.object({
      memberId: z.string().uuid('Invalid member ID'),
      notes: z.string().max(2000).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findUnique({
        where: { id: input.memberId },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' });
      }

      return ctx.prisma.member.update({
        where: { id: input.memberId },
        data: { notes: input.notes },
        select: { id: true, name: true, notes: true },
      });
    }),

  /** Get current user's profile */
  getMyProfile: memberProcedure
    .query(async ({ ctx }) => {
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
          isActive: true,
          emailVerified: true,
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

  /** Update current user's own profile */
  updateMyProfile: memberProcedure
    .input(memberProfileInput)
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

  /**
   * Member-facing directory: any logged-in member can view.
   * Returns ONLY safe fields (no email, phone, emergency contact, notes,
   * dietary restrictions, etc.). Only active members. `joinedYear` is
   * derived from the earliest SeasonMember row.
   */
  getDirectory: memberProcedure
    .input(
      z.object({
        search: z.string().max(200).optional(),
        role: z.enum(['LEAD', 'MANAGER', 'STAFF', 'MEMBER']).optional(),
      }).optional().default({}),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.MemberWhereInput = { isActive: true };
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { playaName: { contains: input.search, mode: 'insensitive' } },
        ];
      }
      if (input.role) where.role = input.role;

      const members = await ctx.prisma.member.findMany({
        where,
        select: {
          id: true,
          name: true,
          playaName: true,
          role: true,
          hasAvatar: true,
          seasonMembers: {
            select: { season: { select: { year: true } } },
            orderBy: { season: { year: 'asc' } },
            take: 1,
          },
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });

      return members.map((m) => ({
        id: m.id,
        name: m.name,
        playaName: m.playaName,
        role: m.role as 'LEAD' | 'MANAGER' | 'MEMBER',
        hasAvatar: m.hasAvatar,
        joinedYear: m.seasonMembers[0]?.season.year ?? null,
      }));
    }),

  /** Get total member count by status (manager+) */
  getCounts: managerProcedure
    .query(async ({ ctx }) => {
      const [total, active, inactive, byRole] = await Promise.all([
        ctx.prisma.member.count(),
        ctx.prisma.member.count({ where: { isActive: true } }),
        ctx.prisma.member.count({ where: { isActive: false } }),
        ctx.prisma.member.groupBy({
          by: ['role'],
          _count: true,
        }),
      ]);

      const roleMap: Record<string, number> = {};
      for (const r of byRole) {
        roleMap[r.role] = r._count;
      }

      return { total, active, inactive, byRole: roleMap };
    }),

  /**
   * Find duplicate Member candidates for admin review.
   * Mirrors the heuristics in scripts/audit-member-data.js.
   *   - exactNameDups: groups with identical norm(name)
   *   - softDups: groups with same first+last name token (different middle/spelling)
   *   - emailInPreviousEmails: rows where another Member's current email
   *     appears inside this Member's previousEmails (signals an already-merged
   *     duplicate that got re-created somehow).
   * Lead-only.
   */
  findDuplicateCandidates: leadProcedure
    .query(async ({ ctx }) => {
      const members = await ctx.prisma.member.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          playaName: true,
          phone: true,
          role: true,
          previousEmails: true,
          seasonMembers: {
            select: { season: { select: { year: true } } },
          },
        },
        orderBy: { name: 'asc' },
      });

      type Candidate = {
        id: string;
        name: string;
        email: string;
        playaName: string | null;
        phone: string | null;
        role: 'LEAD' | 'MANAGER' | 'MEMBER';
        previousEmails: string[];
        seasonYears: number[];
        seasonCount: number;
      };

      const toCandidate = (m: typeof members[number]): Candidate => {
        const years = m.seasonMembers
          .map((sm) => sm.season.year)
          .sort((a, b) => a - b);
        return {
          id: m.id,
          name: m.name,
          email: m.email,
          playaName: m.playaName,
          phone: m.phone,
          role: m.role as Candidate['role'],
          previousEmails: m.previousEmails,
          seasonYears: years,
          seasonCount: years.length,
        };
      };

      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

      // 1. Exact name duplicates
      const byName = new Map<string, Candidate[]>();
      for (const m of members) {
        const k = norm(m.name);
        if (!k) continue;
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k)!.push(toCandidate(m));
      }
      const exactNameDups = [...byName.values()].filter((g) => g.length > 1);

      // 2. Soft duplicates (first+last token), excluding groups already covered
      // by exact-name matches.
      const exactKeys = new Set(
        exactNameDups.map((g) => norm(g[0].name)),
      );
      const byFirstLast = new Map<string, Candidate[]>();
      for (const m of members) {
        const tokens = norm(m.name).split(/\s+/).filter(Boolean);
        if (tokens.length < 2) continue;
        const k = `${tokens[0]}|${tokens[tokens.length - 1]}`;
        if (!byFirstLast.has(k)) byFirstLast.set(k, []);
        byFirstLast.get(k)!.push(toCandidate(m));
      }
      const softDups = [...byFirstLast.values()].filter((g) => {
        if (g.length < 2) return false;
        // Skip if every row in the group also shares the same norm(name)
        // (those are already in exactNameDups)
        const names = new Set(g.map((c) => norm(c.name)));
        if (names.size === 1 && exactKeys.has([...names][0])) return false;
        return true;
      });

      // 3. emailInPreviousEmails: member A's current email appears in member B's previousEmails
      const emailToMember = new Map<string, Candidate>();
      for (const m of members) {
        if (m.email) emailToMember.set(m.email.toLowerCase(), toCandidate(m));
      }
      const emailInPreviousEmails: Array<{ holder: Candidate; matchedEmail: string; other: Candidate }> = [];
      for (const m of members) {
        for (const prev of m.previousEmails) {
          const lower = prev.toLowerCase();
          const other = emailToMember.get(lower);
          if (other && other.id !== m.id) {
            emailInPreviousEmails.push({
              holder: toCandidate(m),
              matchedEmail: prev,
              other,
            });
          }
        }
      }

      return {
        exactNameDups,
        softDups,
        emailInPreviousEmails,
      };
    }),

  /**
   * Merge a source Member into a target Member. The source row is deleted.
   * Lifted from scripts/merge-duplicate-members.js.
   *
   * - SeasonMember rows for seasons the target already has are deleted on source side
   * - Other SeasonMembers move to target.memberId
   * - Ticket, Announcement, AuditLog, Application.sponsor + .reviewer reassigned
   * - source.email + source.previousEmails appended to target.previousEmails
   * - optional finalName overrides target.name
   * Lead-only.
   */
  mergeMembers: leadProcedure
    .input(z.object({
      sourceId: z.string().uuid('Invalid source ID'),
      targetId: z.string().uuid('Invalid target ID'),
      finalName: z.string().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.sourceId === input.targetId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Source and target must be different members' });
      }
      if (input.sourceId === ctx.user.id || input.targetId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot merge your own account' });
      }

      const [source, target] = await Promise.all([
        ctx.prisma.member.findUnique({
          where: { id: input.sourceId },
          include: { seasonMembers: true },
        }),
        ctx.prisma.member.findUnique({
          where: { id: input.targetId },
          include: { seasonMembers: true },
        }),
      ]);

      if (!source) throw new TRPCError({ code: 'NOT_FOUND', message: 'Source member not found' });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Target member not found' });

      const targetSeasonIds = new Set(target.seasonMembers.map((sm) => sm.seasonId));

      const result = await ctx.prisma.$transaction(async (tx) => {
        // 1. SeasonMember handling
        let moved = 0;
        let deleted = 0;
        for (const sm of source.seasonMembers) {
          if (targetSeasonIds.has(sm.seasonId)) {
            await tx.seasonMember.delete({ where: { id: sm.id } });
            deleted++;
          } else {
            await tx.seasonMember.update({
              where: { id: sm.id },
              data: { memberId: target.id },
            });
            moved++;
          }
        }

        // 2. Other FK reassignments
        await tx.ticket.updateMany({
          where: { memberId: source.id },
          data: { memberId: target.id },
        });
        await tx.announcement.updateMany({
          where: { authorId: source.id },
          data: { authorId: target.id },
        });
        await tx.auditLog.updateMany({
          where: { memberId: source.id },
          data: { memberId: target.id },
        });
        await tx.application.updateMany({
          where: { sponsorMemberId: source.id },
          data: { sponsorMemberId: target.id },
        });
        await tx.application.updateMany({
          where: { reviewedByMemberId: source.id },
          data: { reviewedByMemberId: target.id },
        });

        // 3. Email history
        const newHistory = [...new Set([
          ...target.previousEmails,
          ...source.previousEmails,
          source.email,
        ])].filter((e) => e && e !== target.email);

        // 4. Update target
        const updates: { previousEmails: string[]; name?: string } = { previousEmails: newHistory };
        const finalName = input.finalName?.trim();
        if (finalName && finalName !== target.name) {
          updates.name = finalName;
        }
        const updated = await tx.member.update({
          where: { id: target.id },
          data: updates,
          select: { id: true, name: true, previousEmails: true },
        });

        // 5. Delete source
        await tx.member.delete({ where: { id: source.id } });

        return {
          keptId: updated.id,
          movedSeasons: moved,
          deletedSeasons: deleted,
          finalName: updated.name,
          previousEmailsCount: updated.previousEmails.length,
        };
      });

      logger.info(
        `Merged member ${source.email} (${source.id}) → ${target.email} (${target.id}) by ${ctx.user.email}: moved ${result.movedSeasons}, deleted ${result.deletedSeasons}`,
      );

      return result;
    }),
});
