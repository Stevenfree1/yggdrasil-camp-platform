import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, memberProcedure, managerProcedure, leadProcedure } from '../trpc';
import { parseRosterCsv } from './roster-csv';
import { duesRemainingCents, openChargesTotalCents, tabBalanceCents } from '../lib/billing';

export const seasonMembersRouter = router({
  list: managerProcedure
    .input(z.object({
      seasonId: z.string().uuid().optional(),
      status: z.enum(['INTERESTED', 'MAYBE', 'CONFIRMED', 'WAITLISTED', 'CANCELLED']).optional(),
      housingType: z.enum(['TENT', 'SHIFTPOD', 'RV', 'TRAILER', 'DORM', 'SHARED', 'HEXAYURT', 'OTHER']).optional(),
      buildCrew: z.boolean().optional(),
      strikeCrew: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).optional().default(50),
      offset: z.number().min(0).optional().default(0),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      // Default to active season if no seasonId provided
      let seasonId = input.seasonId;
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

      const where: any = { seasonId };

      if (input.status) where.status = input.status;
      if (input.housingType) where.housingType = input.housingType;
      if (input.buildCrew !== undefined) where.buildCrew = input.buildCrew;
      if (input.strikeCrew !== undefined) where.strikeCrew = input.strikeCrew;

      if (input.search) {
        where.member = {
          OR: [
            { name: { contains: input.search, mode: 'insensitive' } },
            { email: { contains: input.search, mode: 'insensitive' } },
            { playaName: { contains: input.search, mode: 'insensitive' } },
          ],
        };
      }

      const [seasonMembers, total] = await Promise.all([
        ctx.prisma.seasonMember.findMany({
          where,
          include: {
            member: {
              select: { id: true, email: true, name: true, playaName: true, phone: true, role: true, hasAvatar: true },
            },
          },
          orderBy: { member: { name: 'asc' } },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.seasonMember.count({ where }),
      ]);

      return { seasonMembers, total };
    }),

  /**
   * Rich roster read for the `/admin/roster` management grid — a dedicated read
   * (not a reuse of `list`, which under-selects the member sub-fields the grid
   * needs and overfetches nothing useful here). Returns dues/activation/housing
   * scalars plus the most-recent payment for the "last payment" column.
   *
   * Server-side preset filters power the toolbar pills (dues unpaid, invited-
   * not-active, build/strike crew, etc.). All SeasonMember scalars
   * (duesStatus/duesNote/duesUpdatedById/duesUpdatedAt/activatedAt/housingType/
   * housingSize/gridPower/buildCrew/strikeCrew/isCampVirgin/isBMVirgin/
   * addedToWhatsApp) come back by default — only relations are include-selected.
   *
   * Note: duesUpdatedById is a plain string (no FK), so it is NOT resolved to a
   * name here; the UI shows duesNote text and leaves the editor-name lookup out
   * of scope.
   */
  roster: managerProcedure
    .input(z.object({
      seasonId: z.string().uuid().optional(),
      search: z.string().optional(),
      status: z.enum(['INTERESTED', 'MAYBE', 'CONFIRMED', 'WAITLISTED', 'CANCELLED']).optional(),
      housingType: z.enum(['TENT', 'SHIFTPOD', 'RV', 'TRAILER', 'DORM', 'SHARED', 'HEXAYURT', 'OTHER']).optional(),
      gridPower: z.enum(['NONE', 'AMP_15', 'AMP_30', 'AMP_50']).optional(),
      buildCrew: z.boolean().optional(),
      strikeCrew: z.boolean().optional(),
      duesStatus: z.enum(['UNPAID', 'PAID', 'WAIVED']).optional(),
      invitedNotActive: z.boolean().optional(),
      limit: z.number().min(1).max(200).optional().default(200),
      offset: z.number().min(0).optional().default(0),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      // Default to active season if no seasonId provided
      let seasonId = input.seasonId;
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

      const where: any = { seasonId };

      // Default view excludes CANCELLED drop-outs so they don't count as
      // current members; pass status='CANCELLED' explicitly to list them.
      where.status = input.status ?? { not: 'CANCELLED' };
      if (input.housingType) where.housingType = input.housingType;
      if (input.gridPower) where.gridPower = input.gridPower;
      if (input.buildCrew !== undefined) where.buildCrew = input.buildCrew;
      if (input.strikeCrew !== undefined) where.strikeCrew = input.strikeCrew;
      if (input.duesStatus) where.duesStatus = input.duesStatus;
      // "Invited, not active" => never activated (no post-invite login yet).
      if (input.invitedNotActive) where.activatedAt = null;

      if (input.search) {
        where.member = {
          OR: [
            { name: { contains: input.search, mode: 'insensitive' } },
            { email: { contains: input.search, mode: 'insensitive' } },
            { playaName: { contains: input.search, mode: 'insensitive' } },
          ],
        };
      }

      const [seasonMembers, total] = await Promise.all([
        ctx.prisma.seasonMember.findMany({
          where,
          include: {
            member: {
              select: {
                id: true, email: true, name: true, playaName: true, phone: true,
                role: true, hasAvatar: true, emergencyContactName: true,
                emergencyContactPhone: true, dietaryRestrictions: true,
                allergies: true, gender: true,
              },
            },
            // Most-recent payment for the "last payment" column.
            payments: {
              take: 1,
              orderBy: { paidAt: 'desc' },
              select: { id: true, type: true, amount: true, method: true, paidAt: true },
            },
          },
          orderBy: { member: { name: 'asc' } },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.seasonMember.count({ where }),
      ]);

      return { seasonMembers, total };
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sm = await ctx.prisma.seasonMember.findUnique({
        where: { id: input.id },
        include: {
          member: {
            select: {
              id: true, email: true, name: true, playaName: true, phone: true,
              gender: true, role: true, emergencyContactName: true,
              emergencyContactPhone: true, dietaryRestrictions: true,
            },
          },
          payments: { orderBy: { paidAt: 'desc' } },
          season: { select: { id: true, year: true, name: true } },
        },
      });

      if (!sm) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season member not found' });
      }

      return sm;
    }),

  enroll: leadProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      memberId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check for existing enrollment
      const existing = await ctx.prisma.seasonMember.findUnique({
        where: { seasonId_memberId: { seasonId: input.seasonId, memberId: input.memberId } },
      });

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Member already enrolled in this season' });
      }

      return ctx.prisma.seasonMember.create({
        data: {
          seasonId: input.seasonId,
          memberId: input.memberId,
          status: 'INTERESTED',
        },
        include: {
          member: { select: { id: true, name: true, email: true } },
        },
      });
    }),

  bulkEnroll: leadProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      memberIds: z.array(z.string().uuid()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Find existing enrollments to skip
      const existing = await ctx.prisma.seasonMember.findMany({
        where: {
          seasonId: input.seasonId,
          memberId: { in: input.memberIds },
        },
        select: { memberId: true },
      });

      const existingIds = new Set(existing.map((e) => e.memberId));
      const newIds = input.memberIds.filter((id) => !existingIds.has(id));

      if (newIds.length === 0) {
        return { created: 0, skipped: input.memberIds.length };
      }

      await ctx.prisma.seasonMember.createMany({
        data: newIds.map((memberId) => ({
          seasonId: input.seasonId,
          memberId,
          status: 'INTERESTED' as const,
        })),
      });

      return { created: newIds.length, skipped: existingIds.size };
    }),

  updateStatus: managerProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['INTERESTED', 'MAYBE', 'CONFIRMED', 'WAITLISTED', 'CANCELLED']),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.seasonMember.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  updateHousing: managerProcedure
    .input(z.object({
      id: z.string().uuid(),
      housingType: z.enum(['TENT', 'SHIFTPOD', 'RV', 'TRAILER', 'DORM', 'SHARED', 'HEXAYURT', 'OTHER']).nullable().optional(),
      housingSize: z.string().nullable().optional(),
      gridPower: z.enum(['NONE', 'AMP_15', 'AMP_30', 'AMP_50']).optional(),
      sharedWithId: z.string().uuid().nullable().optional(),
      mapObject: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.seasonMember.update({
        where: { id },
        data,
      });
    }),

  /**
   * Set a season member's dues status. The single admin setter for the dues
   * flag (replaces the application "Mark dues paid" flag). A WAIVED status
   * should carry a free-text note (who/when waived) — encouraged, not enforced.
   */
  setDuesStatus: managerProcedure
    .input(z.object({
      id: z.string().uuid(),
      duesStatus: z.enum(['UNPAID', 'PAID', 'WAIVED']),
      note: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.seasonMember.update({
        where: { id: input.id },
        data: {
          duesStatus: input.duesStatus,
          duesNote: input.note ?? null,
          duesUpdatedById: ctx.user.id,
          duesUpdatedAt: new Date(),
        },
      });
    }),

  /**
   * Set or clear a member's custom dues amount (partial discount). null clears
   * back to the season default. Stamps the dues editor/timestamp like
   * setDuesStatus and writes an audit row.
   */
  setDuesOverride: managerProcedure
    .input(z.object({
      id: z.string().uuid(),
      amountCents: z.number().int().min(0).max(100_000_00).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.prisma.seasonMember.update({
        where: { id: input.id },
        data: {
          duesOverrideCents: input.amountCents,
          duesUpdatedById: ctx.user.id,
          duesUpdatedAt: new Date(),
        },
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id, action: 'DUES_OVERRIDE_SET', entityType: 'SeasonMember', entityId: input.id,
          details: { amountCents: input.amountCents },
        },
      });
      return updated;
    }),

  /**
   * Manual admin override for the Invited↔Active toggle. Setting activated=true
   * stamps activatedAt (Active); activated=false clears it back to Invited.
   * Auto-flip on first post-invite login is wired separately in auth.ts.
   */
  setActivation: managerProcedure
    .input(z.object({
      id: z.string().uuid(),
      activated: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.seasonMember.update({
        where: { id: input.id },
        data: { activatedAt: input.activated ? new Date() : null },
      });
    }),

  /**
   * SAFE, validated roster CSV import — upsert-only, never create/delete.
   *
   * Two-phase: dryRun=true (default) returns a preview diff with NO writes;
   * dryRun=false applies the changes best-effort per row and returns counts.
   *
   * Safety invariants (do NOT relax):
   *  - Each row resolves to an EXISTING active-season SeasonMember by
   *    member.id (row.memberId) or member.email (insensitive). Rows that match
   *    neither are rejected into `errors` and SKIPPED — never created.
   *  - Only the safe field set is writable: dues (duesStatus + duesNote, stamped
   *    with the editor + timestamp like setDuesStatus), activation (activatedAt,
   *    like setActivation), and housing (housingType / housingSize / gridPower).
   *  - Member name/email are intentionally NOT importable (identity-drift guard).
   *  - Never touches passwords. Never creates Payment rows — dues=PAID is set
   *    via the duesStatus flag directly, NOT a fake DUES ledger entry.
   */
  importRoster: managerProcedure
    .input(z.object({
      fileBase64: z.string().max(5 * 1024 * 1024, 'File size must not exceed 5MB'),
      dryRun: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Resolve the active season — the roster import only ever targets it.
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true, year: true, name: true },
      });
      if (!activeSeason) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
      }

      // Decode + parse the CSV (dependency-free; quote/CRLF aware).
      let text: string;
      try {
        text = Buffer.from(input.fileBase64, 'base64').toString('utf8');
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not decode file' });
      }
      const { rows, errors: parseErrors } = parseRosterCsv(text);
      const errors: string[] = [...parseErrors];

      // Load all active-season SeasonMembers once for in-memory resolution.
      const seasonMembers = await ctx.prisma.seasonMember.findMany({
        where: { seasonId: activeSeason.id },
        include: {
          member: { select: { id: true, email: true, name: true } },
        },
      });
      const byMemberId = new Map<string, (typeof seasonMembers)[number]>();
      const byEmail = new Map<string, (typeof seasonMembers)[number]>();
      for (const sm of seasonMembers) {
        byMemberId.set(sm.member.id, sm);
        byEmail.set(sm.member.email.toLowerCase(), sm);
      }

      interface RosterChange {
        memberId: string;
        seasonMemberId: string;
        name: string;
        field: string;
        from: string | null;
        to: string | null;
      }

      const changes: RosterChange[] = [];
      // Per-resolved-SeasonMember accumulated update payload (applied in phase 2).
      const updates = new Map<string, { sm: (typeof seasonMembers)[number]; data: Record<string, unknown> }>();
      let matched = 0;
      let unmatched = 0;

      const fmt = (v: unknown): string | null =>
        v == null ? null : v instanceof Date ? v.toISOString() : String(v);

      for (const row of rows) {
        // Resolve to an existing active-season SeasonMember (id first, then email).
        const sm =
          (row.memberId ? byMemberId.get(row.memberId) : undefined) ??
          (row.email ? byEmail.get(row.email.toLowerCase()) : undefined);

        if (!sm) {
          unmatched++;
          const key = row.memberId || row.email || '(blank)';
          errors.push(`row ${row.lineNum}: no member matches id/email ${key}`);
          continue;
        }
        matched++;

        // Accumulate this row's diffs onto the resolved SeasonMember.
        const bucket = updates.get(sm.id) ?? { sm, data: {} as Record<string, unknown> };

        // ── Dues (duesStatus + duesNote, stamped like setDuesStatus) ──
        if (row.duesStatus !== null && row.duesStatus !== sm.duesStatus) {
          changes.push({
            memberId: sm.member.id, seasonMemberId: sm.id, name: sm.member.name,
            field: 'duesStatus', from: fmt(sm.duesStatus), to: fmt(row.duesStatus),
          });
          bucket.data.duesStatus = row.duesStatus;
          bucket.data.duesUpdatedById = ctx.user.id;
          bucket.data.duesUpdatedAt = new Date();
        }
        // A duesNote is only applied alongside an explicit note cell.
        if (row.duesNote !== undefined && (row.duesNote || null) !== sm.duesNote) {
          changes.push({
            memberId: sm.member.id, seasonMemberId: sm.id, name: sm.member.name,
            field: 'duesNote', from: fmt(sm.duesNote), to: fmt(row.duesNote),
          });
          bucket.data.duesNote = row.duesNote || null;
          // Stamp the editor if not already stamped by the dues-status change.
          if (bucket.data.duesUpdatedById === undefined) {
            bucket.data.duesUpdatedById = ctx.user.id;
            bucket.data.duesUpdatedAt = new Date();
          }
        }

        // ── Activation (activatedAt, like setActivation) ──
        if (row.activated !== null) {
          const isActive = sm.activatedAt != null;
          if (row.activated && !isActive) {
            changes.push({
              memberId: sm.member.id, seasonMemberId: sm.id, name: sm.member.name,
              field: 'activatedAt', from: null, to: 'now',
            });
            bucket.data.activatedAt = new Date();
          } else if (!row.activated && isActive) {
            changes.push({
              memberId: sm.member.id, seasonMemberId: sm.id, name: sm.member.name,
              field: 'activatedAt', from: fmt(sm.activatedAt), to: null,
            });
            bucket.data.activatedAt = null;
          }
        }

        // ── Housing (housingType / housingSize / gridPower) ──
        if (row.housingType !== null && row.housingType !== sm.housingType) {
          changes.push({
            memberId: sm.member.id, seasonMemberId: sm.id, name: sm.member.name,
            field: 'housingType', from: fmt(sm.housingType), to: fmt(row.housingType),
          });
          bucket.data.housingType = row.housingType;
        }
        if (row.housingSize !== undefined && (row.housingSize || null) !== sm.housingSize) {
          changes.push({
            memberId: sm.member.id, seasonMemberId: sm.id, name: sm.member.name,
            field: 'housingSize', from: fmt(sm.housingSize), to: fmt(row.housingSize),
          });
          bucket.data.housingSize = row.housingSize || null;
        }
        if (row.gridPower !== null && row.gridPower !== sm.gridPower) {
          changes.push({
            memberId: sm.member.id, seasonMemberId: sm.id, name: sm.member.name,
            field: 'gridPower', from: fmt(sm.gridPower), to: fmt(row.gridPower),
          });
          bucket.data.gridPower = row.gridPower;
        }

        if (Object.keys(bucket.data).length > 0) {
          updates.set(sm.id, bucket);
        }
      }

      // ── Phase 1: dry-run — return the preview, write nothing. ──
      if (input.dryRun) {
        return {
          dryRun: true,
          season: { id: activeSeason.id, year: activeSeason.year, name: activeSeason.name },
          matched,
          unmatched,
          rowsWithChanges: updates.size,
          changeCount: changes.length,
          errors,
          changes: changes.map((c) => ({
            memberId: c.memberId, name: c.name, field: c.field, from: c.from, to: c.to,
          })),
        };
      }

      // ── Phase 2: apply — best-effort per resolved SeasonMember. ──
      let updated = 0;
      let failed = 0;
      for (const { sm, data } of updates.values()) {
        try {
          await ctx.prisma.seasonMember.update({ where: { id: sm.id }, data });
          updated++;
        } catch (e) {
          failed++;
          errors.push(`failed to update ${sm.member.email}: ${e instanceof Error ? e.message : 'unknown error'}`);
        }
      }

      // Audit the import (mirror the Excel-import audit pattern).
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'ROSTER_CSV_IMPORT',
          entityType: 'Season',
          entityId: activeSeason.id,
          details: {
            seasonName: activeSeason.name,
            matched,
            unmatched,
            updated,
            failed,
            changeCount: changes.length,
            errorCount: errors.length,
          },
        },
      });

      return {
        dryRun: false,
        season: { id: activeSeason.id, year: activeSeason.year, name: activeSeason.name },
        matched,
        unmatched,
        updated,
        failed,
        changeCount: changes.length,
        errors,
      };
    }),

  getMySeasonStatus: memberProcedure
    .query(async ({ ctx }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true, year: true, name: true, duesAmount: true, startDate: true, endDate: true },
      });
      if (!activeSeason) return null;

      const include = {
        payments: { orderBy: { paidAt: 'desc' as const } },
        charges: { where: { status: 'OPEN' as const }, orderBy: { createdAt: 'asc' as const } },
      };
      const sm =
        (await ctx.prisma.seasonMember.findUnique({
          where: { seasonId_memberId: { seasonId: activeSeason.id, memberId: ctx.user.id } },
          include,
        })) ??
        (await ctx.prisma.seasonMember.findFirst({
          where: { seasonId: activeSeason.id, member: { email: { equals: ctx.user.email, mode: 'insensitive' } } },
          include,
        }));
      if (!sm) return null;

      const duesPaidCents = sm.payments.filter((p) => p.type === 'DUES').reduce((s, p) => s + p.amount, 0);
      const duesRemaining = duesRemainingCents({
        duesStatus: sm.duesStatus,
        duesOverrideCents: sm.duesOverrideCents,
        seasonDuesCents: activeSeason.duesAmount,
        duesPaidCents,
      });
      const openCharges = openChargesTotalCents(sm.charges);
      return {
        ...sm,
        season: activeSeason,
        tab: {
          duesRemainingCents: duesRemaining,
          openChargesTotalCents: openCharges,
          balanceCents: tabBalanceCents({ duesRemainingCents: duesRemaining, openChargesTotalCents: openCharges }),
        },
      };
    }),

  /**
   * Member-facing housing self-service. The portal has always shown a
   * "Housing" readiness row but there was no way for a member to complete it,
   * which is why most of the roster's housing was blank. Fields all already
   * exist on SeasonMember — this only opens the write path.
   */
  updateMyHousing: memberProcedure
    .input(z.object({
      housingType: z.enum(['TENT', 'SHIFTPOD', 'RV', 'TRAILER', 'DORM', 'SHARED', 'HEXAYURT', 'OTHER']).nullable().optional(),
      housingSize: z.string().max(60).nullable().optional(),
      gridPower: z.enum(['NONE', 'AMP_15', 'AMP_30', 'AMP_50']).optional(),
      sharedWithId: z.string().uuid().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      if (!activeSeason) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
      }

      const sm = await ctx.prisma.seasonMember.findFirst({
        where: {
          seasonId: activeSeason.id,
          OR: [
            { memberId: ctx.user.id },
            { member: { email: { equals: ctx.user.email, mode: 'insensitive' } } },
          ],
        },
        select: { id: true },
      });
      if (!sm) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'You are not on the roster for this season' });
      }

      // A shared-with target must be a real season member, and never yourself.
      if (input.sharedWithId) {
        if (input.sharedWithId === sm.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot share with yourself' });
        }
        const mate = await ctx.prisma.seasonMember.findFirst({
          where: { id: input.sharedWithId, seasonId: activeSeason.id },
          select: { id: true },
        });
        if (!mate) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'That camp mate is not on this season roster' });
        }
      }

      return ctx.prisma.seasonMember.update({
        where: { id: sm.id },
        data: {
          ...(input.housingType !== undefined ? { housingType: input.housingType } : {}),
          ...(input.housingSize !== undefined ? { housingSize: input.housingSize } : {}),
          ...(input.gridPower !== undefined ? { gridPower: input.gridPower } : {}),
          ...(input.sharedWithId !== undefined ? { sharedWithId: input.sharedWithId } : {}),
        },
        select: { id: true, housingType: true, housingSize: true, gridPower: true, sharedWithId: true },
      });
    }),

  /**
   * Admin travel roll-up: who arrives when, who has cargo room, who still
   * needs a ride, and who hasn't answered at all.
   */
  travelSummary: managerProcedure
    .query(async ({ ctx }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      if (!activeSeason) return null;
      const rows = await ctx.prisma.seasonMember.findMany({
        where: { seasonId: activeSeason.id, status: { not: 'CANCELLED' } },
        select: {
          id: true,
          arrivalDate: true,
          departureDate: true,
          arrivalWindow: true,
          departureWindow: true,
          travelMode: true,
          rideStatus: true,
          rideDetails: true,
          travelUpdatedAt: true,
          member: { select: { name: true, playaName: true, email: true } },
        },
        orderBy: { arrivalDate: 'asc' },
      });
      return {
        answered: rows.filter((r) => r.travelUpdatedAt),
        unanswered: rows
          .filter((r) => !r.travelUpdatedAt)
          .map((r) => ({ id: r.id, member: r.member })),
      };
    }),

  /**
   * Member-facing travel self-service (same pattern as updateMyHousing).
   * Arrival/departure are calendar dates stored at noon UTC per the date-only
   * convention in src/lib/dates.ts. Submitting stamps travelUpdatedAt, which
   * is what unlocks the wallpaper gift in the portal.
   */
  updateMyTravel: memberProcedure
    .input(z.object({
      arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      arrivalWindow: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']).nullable().optional(),
      departureWindow: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']).nullable().optional(),
      travelMode: z.enum(['CAR', 'RV', 'CARPOOL', 'FLYING', 'BURNER_EXPRESS', 'OTHER']),
      rideStatus: z.enum(['HAVE_ROOM', 'NEED_RIDE', 'SORTED']),
      rideDetails: z.string().max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.departureDate < input.arrivalDate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Departure cannot be before arrival' });
      }
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      if (!activeSeason) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
      }
      const sm = await ctx.prisma.seasonMember.findFirst({
        where: {
          seasonId: activeSeason.id,
          OR: [
            { memberId: ctx.user.id },
            { member: { email: { equals: ctx.user.email, mode: 'insensitive' } } },
          ],
        },
        select: { id: true },
      });
      if (!sm) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'You are not on the roster for this season' });
      }
      return ctx.prisma.seasonMember.update({
        where: { id: sm.id },
        data: {
          arrivalDate: new Date(`${input.arrivalDate}T12:00:00.000Z`),
          departureDate: new Date(`${input.departureDate}T12:00:00.000Z`),
          arrivalWindow: input.arrivalWindow ?? null,
          departureWindow: input.departureWindow ?? null,
          travelMode: input.travelMode,
          rideStatus: input.rideStatus,
          rideDetails: input.rideDetails?.trim() || null,
          travelUpdatedAt: new Date(),
        },
        select: {
          id: true,
          arrivalDate: true,
          departureDate: true,
          arrivalWindow: true,
          departureWindow: true,
          travelMode: true,
          rideStatus: true,
          rideDetails: true,
          travelUpdatedAt: true,
        },
      });
    }),

  /**
   * Type-ahead over this season's roster so a member can name who they are
   * sharing housing with. Returns only what the member directory already
   * shows other members.
   */
  searchMySeasonMates: memberProcedure
    .input(z.object({ search: z.string().max(80) }))
    .query(async ({ ctx, input }) => {
      const q = input.search.trim();
      if (q.length < 2) return [];
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      if (!activeSeason) return [];

      const rows = await ctx.prisma.seasonMember.findMany({
        where: {
          seasonId: activeSeason.id,
          status: 'CONFIRMED',
          member: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { playaName: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        select: { id: true, member: { select: { name: true, playaName: true } } },
        orderBy: { member: { name: 'asc' } },
        take: 8,
      });
      return rows.map((r) => ({ id: r.id, name: r.member.name, playaName: r.member.playaName }));
    }),

  updateMyArrival: memberProcedure
    .input(z.object({
      arrivalDate: z.string().datetime().nullable().optional(),
      departureDate: z.string().datetime().nullable().optional(),
      rideDetails: z.string().nullable().optional(),
      specialRequests: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true },
      });

      if (!activeSeason) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
      }

      const sm = await ctx.prisma.seasonMember.findUnique({
        where: {
          seasonId_memberId: {
            seasonId: activeSeason.id,
            memberId: ctx.user.id,
          },
        },
      }) ?? await ctx.prisma.seasonMember.findFirst({
        where: {
          seasonId: activeSeason.id,
          member: { email: { equals: ctx.user.email, mode: 'insensitive' } },
        },
      });

      if (!sm) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'You are not enrolled in the current season' });
      }

      const data: any = {};
      if (input.arrivalDate !== undefined) data.arrivalDate = input.arrivalDate ? new Date(input.arrivalDate) : null;
      if (input.departureDate !== undefined) data.departureDate = input.departureDate ? new Date(input.departureDate) : null;
      if (input.rideDetails !== undefined) data.rideDetails = input.rideDetails;
      if (input.specialRequests !== undefined) data.specialRequests = input.specialRequests;

      return ctx.prisma.seasonMember.update({
        where: { id: sm.id },
        data,
      });
    }),
});
