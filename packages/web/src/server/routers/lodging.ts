import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { LodgingUnitKind, MapColorMode, Prisma } from '@prisma/client';
import { router, memberProcedure, managerProcedure } from '../trpc';
import logger from '../lib/logger';
import { resolveSeasonId, seasonRef } from '../lib/season';
import {
  applyOps,
  diffDocuments,
  dbUnitsToDocument,
  type MapOp,
  type MapDocument,
} from '../../components/lodging/document';

const LODGING_KINDS = [
  'TENT', 'RV', 'SHIFTPOD', 'TRAILER', 'DORM', 'STRUCTURE',
  'BOUNDARY', 'STREET_LABEL', 'POWER_BOX', 'SHADE_SAIL', 'TEXT_LABEL',
  'CONTAINER', 'DINING_TENT', 'BOX_TRUCK', 'MAHAL_TENT', 'CANOPY', 'SHADE_CLOTH',
  'PLUG_15A', 'PLUG_30A', 'PLUG_50A', 'PLUG_L21_30', 'BIKE_PARKING',
  'WATER_TANK', 'POD', 'HITCH',
] as const satisfies readonly LodgingUnitKind[];

const COLOR_MODES = ['HOUSEHOLD', 'GRID_POWER'] as const satisfies readonly MapColorMode[];
const ASSIGNABLE_KINDS = new Set<LodgingUnitKind>(['TENT', 'RV', 'SHIFTPOD', 'TRAILER', 'DORM', 'POD']);

const unitInput = z.object({
  id: z.string().uuid().optional(), // omit for create, include for update
  kind: z.enum(LODGING_KINDS),
  label: z.string().max(120).nullable().optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().positive().max(500),
  h: z.number().positive().max(500),
  rotation: z.number().finite().min(-360).max(360).optional().default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  partnerCamp: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  opacity: z.number().min(0).max(1).optional().default(1),
});

// A full unit as carried by an `addUnit` op (caller supplies the id).
const mapUnitSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(LODGING_KINDS),
  label: z.string().max(120).nullable(),
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().positive().max(500),
  h: z.number().positive().max(500),
  rotation: z.number().finite().min(-360).max(360),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  partnerCamp: z.string().max(120).nullable(),
  notes: z.string().max(1000).nullable(),
  sortOrder: z.number().int(),
  opacity: z.number().min(0).max(1),
});

const uuid = z.string().uuid();

// The agent-facing edit vocabulary (mirrors MapOp in components/lodging/document.ts).
const mapOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addUnit'), unit: mapUnitSchema }),
  z.object({ type: z.literal('updateUnit'), id: uuid, patch: mapUnitSchema.omit({ id: true }).partial() }),
  z.object({ type: z.literal('moveUnit'), id: uuid, x: z.number().finite(), y: z.number().finite() }),
  z.object({ type: z.literal('resizeUnit'), id: uuid, w: z.number().positive().max(500), h: z.number().positive().max(500) }),
  z.object({ type: z.literal('rotateUnit'), id: uuid, rotation: z.number().finite().min(-360).max(360) }),
  z.object({ type: z.literal('relabelUnit'), id: uuid, label: z.string().max(120).nullable() }),
  z.object({ type: z.literal('recolorUnit'), id: uuid, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable() }),
  z.object({ type: z.literal('reorderUnit'), id: uuid, dir: z.enum(['front', 'back', 'forward', 'backward']) }),
  z.object({ type: z.literal('deleteUnit'), id: uuid }),
]);

// A stored map snapshot (validated on restore).
const mapDocumentSchema = z.object({ units: z.array(mapUnitSchema) });

export const lodgingRouter = router({
  /**
   * Returns the full canvas state for a season: units + their assignments
   * (with linked member data), the map config, and the list of confirmed
   * SeasonMembers who don't yet have a unit assigned.
   */
  getMap: managerProcedure
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);

      const [units, assignments, config, season, unplaced, applications] = await Promise.all([
        ctx.prisma.lodgingUnit.findMany({
          where: { seasonId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
        ctx.prisma.lodgingAssignment.findMany({
          where: { lodgingUnit: { seasonId } },
          include: {
            seasonMember: {
              select: {
                id: true,
                housingType: true,
                housingSize: true,
                gridPower: true,
                sharedWithId: true,
                member: { select: { id: true, name: true, playaName: true, email: true } },
              },
            },
          },
        }),
        ctx.prisma.seasonMapConfig.findUnique({ where: { seasonId } }),
        ctx.prisma.season.findUnique({ where: { id: seasonId }, select: { id: true, year: true, name: true } }),
        ctx.prisma.seasonMember.findMany({
          where: {
            seasonId,
            status: { in: ['CONFIRMED', 'MAYBE'] },
            lodgingAssignment: null,
          },
          select: {
            id: true,
            housingType: true,
            housingSize: true,
            gridPower: true,
            status: true,
            member: { select: { id: true, name: true, playaName: true } },
          },
          orderBy: { member: { name: 'asc' } },
        }),
        // Applications carry householdId; we'll resolve household per assigned member by email.
        ctx.prisma.application.findMany({
          where: { seasonId, householdId: { not: null } },
          select: { email: true, householdId: true, household: { select: { id: true, name: true } } },
        }),
      ]);

      // Build email -> householdId map from Applications.
      const householdByEmail = new Map<string, { id: string; name: string | null }>();
      for (const app of applications) {
        if (!app.householdId || !app.household) continue;
        householdByEmail.set(app.email.toLowerCase(), app.household);
      }
      // Resolve household per assignment.
      const assignmentsWithHousehold = assignments.map((a) => ({
        ...a,
        household: householdByEmail.get(a.seasonMember.member.email.toLowerCase()) ?? null,
      }));

      return { season, units, assignments: assignmentsWithHousehold, config, unplacedMembers: unplaced };
    }),

  /** Create or update a single unit. Used by drag/resize, properties panel, and manual add. */
  upsertUnit: managerProcedure
    .input(z.object({ seasonId: z.string().uuid(), unit: unitInput }))
    .mutation(async ({ ctx, input }) => {
      const { seasonId, unit } = input;
      const data = {
        seasonId,
        kind: unit.kind,
        label: unit.label ?? null,
        x: unit.x,
        y: unit.y,
        w: unit.w,
        h: unit.h,
        rotation: unit.rotation ?? 0,
        color: unit.color ?? null,
        partnerCamp: unit.partnerCamp ?? null,
        notes: unit.notes ?? null,
        sortOrder: unit.sortOrder ?? 0,
        opacity: unit.opacity ?? 1,
      };
      if (unit.id) {
        const existing = await ctx.prisma.lodgingUnit.findUnique({
          where: { id: unit.id },
          select: { seasonId: true },
        });
        if (!existing || existing.seasonId !== seasonId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lodging unit not found for this season' });
        }
        const updated = await ctx.prisma.lodgingUnit.update({
          where: { id: unit.id },
          data,
        });
        return updated;
      }
      const created = await ctx.prisma.lodgingUnit.create({ data });
      logger.info({ id: created.id, seasonId, kind: created.kind }, 'lodging unit created');
      return created;
    }),

  /** Bulk save: replaces positions/dimensions for many units in one transaction. */
  saveUnits: managerProcedure
    .input(z.object({ seasonId: z.string().uuid(), units: z.array(unitInput).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { seasonId, units } = input;
      // Validate ownership of all existing units up front in ONE query. Doing a
      // per-unit findUnique *inside* the transaction adds a round-trip per unit,
      // which blows the interactive-transaction timeout on a high-latency DB
      // connection ("Transaction not found / already closed").
      const existingIds = units.map((u) => u.id).filter((id): id is string => !!id);
      const stale = new Set<string>();
      if (existingIds.length) {
        const owned = await ctx.prisma.lodgingUnit.findMany({
          where: { id: { in: existingIds } },
          select: { id: true, seasonId: true },
        });
        const seasonById = new Map(owned.map((o) => [o.id, o.seasonId]));
        for (const id of existingIds) {
          const owner = seasonById.get(id);
          // Gone entirely: the row was deleted after this editor loaded — an
          // importer re-created the pods, someone else removed it. That is not
          // this caller's fault and must not sink the whole batch, or one stale
          // id costs every unsaved move in the session. Skip it and report it.
          if (owner === undefined) { stale.add(id); continue; }
          // Exists but belongs to another season: still a hard error.
          if (owner !== seasonId) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Lodging unit not found for this season' });
          }
        }
      }
      const result = await ctx.prisma.$transaction(async (tx) => {
        let created = 0;
        let updated = 0;
        // ids aligned 1:1 with the input order so the client can adopt the
        // server id of each newly-created unit without re-hydrating the map.
        // A skipped (stale) unit contributes null so the alignment holds.
        const ids: (string | null)[] = [];
        for (const u of units) {
          if (u.id && stale.has(u.id)) { ids.push(null); continue; }
          const data = {
            seasonId,
            kind: u.kind,
            label: u.label ?? null,
            x: u.x,
            y: u.y,
            w: u.w,
            h: u.h,
            rotation: u.rotation ?? 0,
            color: u.color ?? null,
            partnerCamp: u.partnerCamp ?? null,
            notes: u.notes ?? null,
            sortOrder: u.sortOrder ?? 0,
            opacity: u.opacity ?? 1,
          };
          if (u.id) {
            await tx.lodgingUnit.update({ where: { id: u.id }, data });
            ids.push(u.id);
            updated++;
          } else {
            const c = await tx.lodgingUnit.create({ data, select: { id: true } });
            ids.push(c.id);
            created++;
          }
        }
        return { created, updated, ids, skipped: [...stale] };
      }, { timeout: 20000, maxWait: 8000 });
      logger.info({ seasonId, ...result }, 'lodging units bulk save');
      return result;
    }),

  /**
   * Apply a sequence of structured map operations and persist the result.
   *
   * This is the canonical, agent-drivable edit surface: the same MapOp
   * vocabulary the editor uses (add/move/resize/rotate/relabel/recolor/
   * reorder/delete). It loads the season's units into a MapDocument, applies
   * the ops purely, then writes only the minimal create/update/delete diff in
   * one transaction. A future natural-language editing layer or MCP tool calls
   * straight through here.
   */
  applyOps: managerProcedure
    .input(z.object({ seasonId: z.string().uuid(), ops: z.array(mapOpSchema).min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const { seasonId, ops } = input;
      const existing = await ctx.prisma.lodgingUnit.findMany({ where: { seasonId } });
      const before = dbUnitsToDocument(existing);

      let after;
      try {
        after = applyOps(before, ops as MapOp[]);
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: (e as Error).message });
      }
      const diff = diffDocuments(before, after);

      await ctx.prisma.$transaction(async (tx) => {
        for (const u of diff.created) {
          await tx.lodgingUnit.create({
            data: {
              id: u.id, seasonId, kind: u.kind, label: u.label,
              x: u.x, y: u.y, w: u.w, h: u.h, rotation: u.rotation,
              color: u.color, partnerCamp: u.partnerCamp, notes: u.notes, sortOrder: u.sortOrder, opacity: u.opacity,
            },
          });
        }
        for (const u of diff.updated) {
          await tx.lodgingUnit.update({
            where: { id: u.id },
            data: {
              kind: u.kind, label: u.label,
              x: u.x, y: u.y, w: u.w, h: u.h, rotation: u.rotation,
              color: u.color, partnerCamp: u.partnerCamp, notes: u.notes, sortOrder: u.sortOrder, opacity: u.opacity,
            },
          });
        }
        if (diff.deletedIds.length) {
          await tx.lodgingUnit.deleteMany({ where: { id: { in: diff.deletedIds }, seasonId } });
        }
      });

      const result = { created: diff.created.length, updated: diff.updated.length, deleted: diff.deletedIds.length };
      logger.info({ seasonId, ...result }, 'lodging applyOps');
      return result;
    }),

  /**
   * Bulk-create units from a CSV import. Each row creates a new unit; if
   * `memberName` is provided and a confirmed SeasonMember matches by name
   * (case-insensitive), the unit is assigned to them in the same transaction.
   * Used to seed an initial layout from a spreadsheet.
   */
  importCsv: managerProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      rows: z.array(z.object({
        memberName: z.string().optional(),
        kind: z.enum(LODGING_KINDS),
        label: z.string().optional(),
        x: z.number().finite(),
        y: z.number().finite(),
        w: z.number().positive(),
        h: z.number().positive(),
        rotation: z.number().finite().optional(),
        partnerCamp: z.string().optional(),
      })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const { seasonId, rows } = input;
      // Pre-load all confirmed/maybe SeasonMembers for the season for name matching.
      const sms = await ctx.prisma.seasonMember.findMany({
        where: { seasonId, status: { in: ['CONFIRMED', 'MAYBE'] } },
        select: {
          id: true,
          lodgingAssignment: { select: { id: true } },
          member: { select: { name: true, playaName: true } },
        },
      });
      const byName = new Map<string, string>(); // normalized name -> seasonMember.id
      for (const sm of sms) {
        if (sm.lodgingAssignment) continue; // already placed
        byName.set(sm.member.name.trim().toLowerCase(), sm.id);
        if (sm.member.playaName) byName.set(sm.member.playaName.trim().toLowerCase(), sm.id);
      }
      const result = await ctx.prisma.$transaction(async (tx) => {
        let created = 0;
        let assigned = 0;
        const unmatched: string[] = [];
        for (const r of rows) {
          const unit = await tx.lodgingUnit.create({
            data: {
              seasonId,
              kind: r.kind,
              label: r.label ?? null,
              x: r.x,
              y: r.y,
              w: r.w,
              h: r.h,
              rotation: r.rotation ?? 0,
              partnerCamp: r.partnerCamp ?? null,
            },
          });
          created++;
          if (r.memberName) {
            const smId = byName.get(r.memberName.trim().toLowerCase());
            if (smId) {
              await tx.lodgingAssignment.create({
                data: { lodgingUnitId: unit.id, seasonMemberId: smId },
              });
              byName.delete(r.memberName.trim().toLowerCase()); // prevent double-assign
              assigned++;
            } else {
              unmatched.push(r.memberName);
            }
          }
        }
        return { created, assigned, unmatched };
      });
      logger.info({ seasonId, ...result }, 'lodging CSV import');
      return result;
    }),

  /** Delete a unit. Cascades its assignments. */
  deleteUnit: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.lodgingUnit.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  /** Assign a SeasonMember to a unit; removes any prior assignment they had. */
  assignMember: managerProcedure
    .input(z.object({
      lodgingUnitId: z.string().uuid(),
      seasonMemberId: z.string().uuid(),
      isPrimary: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const [unit, seasonMember] = await Promise.all([
        ctx.prisma.lodgingUnit.findUnique({
          where: { id: input.lodgingUnitId },
          select: { seasonId: true, kind: true },
        }),
        ctx.prisma.seasonMember.findUnique({
          where: { id: input.seasonMemberId },
          select: { seasonId: true },
        }),
      ]);

      if (!unit) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lodging unit not found' });
      }
      if (!seasonMember) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season member not found' });
      }
      if (unit.seasonId !== seasonMember.seasonId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot assign a member to a unit from another season' });
      }
      if (!ASSIGNABLE_KINDS.has(unit.kind)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `${unit.kind} units cannot have lodging occupants` });
      }

      // Upsert by unique seasonMemberId — moves member if they were in another unit.
      const assignment = await ctx.prisma.lodgingAssignment.upsert({
        where: { seasonMemberId: input.seasonMemberId },
        create: {
          lodgingUnitId: input.lodgingUnitId,
          seasonMemberId: input.seasonMemberId,
          isPrimary: input.isPrimary ?? true,
        },
        update: {
          lodgingUnitId: input.lodgingUnitId,
          isPrimary: input.isPrimary ?? true,
        },
      });
      return assignment;
    }),

  unassignMember: managerProcedure
    .input(z.object({ seasonMemberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.lodgingAssignment.deleteMany({
        where: { seasonMemberId: input.seasonMemberId },
      });
      return { ok: true };
    }),

  /** Upsert the per-season map config (grid size, color mode, viewport, background). */
  upsertConfig: managerProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      viewportX: z.number().finite().optional(),
      viewportY: z.number().finite().optional(),
      viewportScale: z.number().positive().optional(),
      gridSizeFt: z.number().positive().optional(),
      colorMode: z.enum(COLOR_MODES).optional(),
      // Background image: either a data URL (base64) up to ~3MB or a hosted URL.
      // Stored as TEXT so accepting both via a permissive string check.
      backgroundUrl: z.string().max(4_000_000).nullable().optional(),
      backgroundOpacity: z.number().min(0).max(1).optional(),
      backgroundScale: z.number().positive().max(20).optional(),
      backgroundX: z.number().finite().optional(),
      backgroundY: z.number().finite().optional(),
      // Degrees clockwise about the image centre; aerials are never shot square.
      backgroundRotation: z.number().finite().optional(),
      // Locked street-anchored site frame.
      siteWidthFt: z.number().positive().max(5000).nullable().optional(),
      siteDepthFt: z.number().positive().max(5000).nullable().optional(),
      streetTop: z.string().max(80).nullable().optional(),
      streetBottom: z.string().max(80).nullable().optional(),
      // True bearing (deg) the map-top/frontage faces; drives the wind/sun layer.
      frontageBearing: z.number().min(0).max(360).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { seasonId, ...patch } = input;
      const config = await ctx.prisma.seasonMapConfig.upsert({
        where: { seasonId },
        create: { seasonId, ...patch },
        update: patch,
      });
      return config;
    }),

  /**
   * Member portal read: returns the logged-in member's lodging unit (if any),
   * co-occupants, and the full season's units so the canvas can render them
   * dimmed around the member's own.
   */
  getMyUnit: memberProcedure
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const seasonMember = await ctx.prisma.seasonMember.findFirst({
        where: { seasonId, memberId: ctx.user.id },
        select: { id: true },
      });
      if (!seasonMember) {
        return { unit: null, occupants: [], assignments: [], allUnits: [], config: null };
      }
      const assignment = await ctx.prisma.lodgingAssignment.findUnique({
        where: { seasonMemberId: seasonMember.id },
        include: {
          lodgingUnit: {
            include: {
              assignments: {
                include: {
                  seasonMember: {
                    select: {
                      id: true,
                      member: { select: { id: true, name: true, playaName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const [allUnits, allAssignments, config] = await Promise.all([
        ctx.prisma.lodgingUnit.findMany({ where: { seasonId }, orderBy: { sortOrder: 'asc' } }),
        ctx.prisma.lodgingAssignment.findMany({
          where: { lodgingUnit: { seasonId } },
          select: {
            lodgingUnitId: true,
            seasonMember: {
              select: {
                id: true,
                member: { select: { id: true, name: true, playaName: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
        ctx.prisma.seasonMapConfig.findUnique({ where: { seasonId } }),
      ]);
      return {
        unit: assignment?.lodgingUnit ?? null,
        occupants:
          assignment?.lodgingUnit.assignments.map((a) => ({
            id: a.seasonMember.id,
            name: a.seasonMember.member.name,
            playaName: a.seasonMember.member.playaName,
          })) ?? [],
        assignments: allAssignments,
        allUnits,
        config,
      };
    }),

  /**
   * Returns just the list of confirmed SeasonMembers (with member info) for
   * the autocomplete in the AssignmentPanel — separate from getMap so the
   * panel can refresh independently.
   */
  searchMembers: managerProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      query: z.string().max(80).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const q = input.query?.trim().toLowerCase() ?? '';
      const rows = await ctx.prisma.seasonMember.findMany({
        where: {
          seasonId: input.seasonId,
          status: { in: ['CONFIRMED', 'MAYBE'] },
          ...(q
            ? {
                OR: [
                  { member: { name: { contains: q, mode: 'insensitive' } } },
                  { member: { playaName: { contains: q, mode: 'insensitive' } } },
                  { member: { email: { contains: q, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          housingType: true,
          gridPower: true,
          status: true,
          member: { select: { id: true, name: true, playaName: true, email: true } },
          lodgingAssignment: { select: { lodgingUnitId: true } },
        },
        orderBy: { member: { name: 'asc' } },
        take: 50,
      });
      return rows;
    }),

  /** Snapshot the season's current units as a named version. */
  saveVersion: managerProcedure
    .input(z.object({ seasonId: z.string().uuid(), name: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const units = await ctx.prisma.lodgingUnit.findMany({ where: { seasonId: input.seasonId } });
      const doc = dbUnitsToDocument(units);
      const version = await ctx.prisma.lodgingMapVersion.create({
        data: {
          seasonId: input.seasonId,
          name: input.name,
          unitCount: doc.units.length,
          data: doc as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, name: true, unitCount: true, createdAt: true },
      });
      logger.info({ seasonId: input.seasonId, versionId: version.id, units: version.unitCount }, 'lodging version saved');
      return version;
    }),

  /** List a season's saved versions (newest first), without their unit data. */
  listVersions: managerProcedure
    .input(z.object({ seasonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.lodgingMapVersion.findMany({
        where: { seasonId: input.seasonId },
        select: { id: true, name: true, unitCount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * Restore a saved version by syncing the live units to the snapshot via an
   * id-matched diff: surviving units are updated in place (assignments kept),
   * missing ones recreated, extras removed.
   */
  restoreVersion: managerProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.prisma.lodgingMapVersion.findUnique({ where: { id: input.versionId } });
      if (!version) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' });
      }
      const parsed = mapDocumentSchema.safeParse(version.data);
      if (!parsed.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Stored version data is invalid' });
      }
      const after = parsed.data as unknown as MapDocument;
      const existing = await ctx.prisma.lodgingUnit.findMany({ where: { seasonId: version.seasonId } });
      const diff = diffDocuments(dbUnitsToDocument(existing), after);

      await ctx.prisma.$transaction(async (tx) => {
        for (const u of diff.created) {
          await tx.lodgingUnit.create({
            data: {
              id: u.id, seasonId: version.seasonId, kind: u.kind, label: u.label,
              x: u.x, y: u.y, w: u.w, h: u.h, rotation: u.rotation,
              color: u.color, partnerCamp: u.partnerCamp, notes: u.notes, sortOrder: u.sortOrder, opacity: u.opacity,
            },
          });
        }
        for (const u of diff.updated) {
          await tx.lodgingUnit.update({
            where: { id: u.id },
            data: {
              kind: u.kind, label: u.label,
              x: u.x, y: u.y, w: u.w, h: u.h, rotation: u.rotation,
              color: u.color, partnerCamp: u.partnerCamp, notes: u.notes, sortOrder: u.sortOrder, opacity: u.opacity,
            },
          });
        }
        if (diff.deletedIds.length) {
          await tx.lodgingUnit.deleteMany({ where: { id: { in: diff.deletedIds }, seasonId: version.seasonId } });
        }
      });

      const result = { created: diff.created.length, updated: diff.updated.length, deleted: diff.deletedIds.length };
      logger.info({ versionId: input.versionId, ...result }, 'lodging version restored');
      return result;
    }),

  deleteVersion: managerProcedure
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.lodgingMapVersion.delete({ where: { id: input.versionId } });
      return { id: input.versionId };
    }),
});
