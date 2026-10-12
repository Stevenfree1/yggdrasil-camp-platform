import { InventoryCategory, Prisma } from '@prisma/client';
import { z } from 'zod';
import { router, leadProcedure, scopedProcedure } from '../trpc';
import logger from '../lib/logger';

const INVENTORY_CATEGORIES = [
  'SHADE',
  'TENT',
  'AC_UNIT',
  'MATTRESS',
  'COT',
  'KITCHEN',
  'BIKE',
  'RUG',
  'CONTAINER',
  'GENERATOR',
  'TOOLS',
  'ELECTRICAL',
  'SOUND',
  'DECOR',
  'FURNITURE',
  'CONSUMABLES',
  'OTHER',
] as const satisfies readonly InventoryCategory[];

const itemFields = z.object({
  category: z.enum(INVENTORY_CATEGORIES),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  quantity: z.number().int().min(0).max(100_000),
  dimensions: z.string().trim().max(120).nullable().optional(),
  condition: z.string().trim().max(120).nullable().optional(),
  storageLocation: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

function needsAttention(item: {
  condition: string | null;
  storageLocation: string | null;
  notes: string | null;
}): boolean {
  const condition = item.condition?.toLowerCase() ?? '';
  const notes = item.notes?.toLowerCase() ?? '';
  return (
    !item.storageLocation ||
    !condition ||
    condition === 'unknown' ||
    condition === 'fair' ||
    condition.includes('replace') ||
    /\b(verify|count|test|discard|uncounted|repair)\b/.test(notes)
  );
}

export const inventoryRouter = router({
  /** Global camp inventory, with filtering and operational headline counts. */
  list: scopedProcedure('INVENTORY', 'MANAGER')
    .input(
      z
        .object({
          search: z.string().trim().max(100).optional(),
          category: z.enum(INVENTORY_CATEGORIES).optional(),
          storageLocation: z.string().trim().max(200).optional(),
          attentionOnly: z.boolean().optional().default(false),
          includeArchived: z.boolean().optional().default(false),
        })
        .optional()
        .default({})
    )
    .query(async ({ ctx, input }) => {
      // Archived rows stay out of every count and list unless asked for, so
      // the working inventory reflects what the camp actually carries.
      const where: Prisma.InventoryItemWhereInput = input.includeArchived
        ? {}
        : { archivedAt: null };
      const baseWhere: Prisma.InventoryItemWhereInput = input.includeArchived
        ? {}
        : { archivedAt: null };
      if (input.category) where.category = input.category;
      if (input.storageLocation) where.storageLocation = input.storageLocation;
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
          { storageLocation: { contains: input.search, mode: 'insensitive' } },
          { notes: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const allMatching = await ctx.prisma.inventoryItem.findMany({
        where,
        orderBy: [{ storageLocation: 'asc' }, { category: 'asc' }, { name: 'asc' }],
      });
      const rows = input.attentionOnly ? allMatching.filter(needsAttention) : allMatching;

      const allItems = await ctx.prisma.inventoryItem.findMany({
        where: baseWhere,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
      const locations = Array.from(
        new Set(
          allItems.map((item) => item.storageLocation).filter((value): value is string => !!value)
        )
      ).sort();
      const byCategory = INVENTORY_CATEGORIES.map((category) => ({
        category,
        rows: allItems.filter((item) => item.category === category).length,
        quantity: allItems
          .filter((item) => item.category === category)
          .reduce((total, item) => total + item.quantity, 0),
      })).filter((entry) => entry.rows > 0);

      return {
        rows: rows.map((item) => ({
          ...item,
          needsAttention: needsAttention(item),
        })),
        stats: {
          rows: allItems.length,
          quantity: allItems.reduce((total, item) => total + item.quantity, 0),
          audited: allItems.filter((item) => /^\d{4} audit\./.test(item.notes ?? '')).length,
          needsAttention: allItems.filter(needsAttention).length,
          byCategory,
          locations,
        },
      };
    }),

  upsert: scopedProcedure('INVENTORY', 'MANAGER')
    .input(itemFields.extend({ id: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;
      const data: Prisma.InventoryItemUncheckedCreateInput = {
        category: input.category,
        name: input.name,
        quantity: input.quantity,
        description: input.description || null,
        dimensions: input.dimensions || null,
        condition: input.condition || null,
        storageLocation: input.storageLocation || null,
        notes: input.notes || null,
      };
      const before = id
        ? await ctx.prisma.inventoryItem.findUnique({ where: { id } })
        : null;
      const item = id
        ? await ctx.prisma.inventoryItem.update({ where: { id }, data })
        : await ctx.prisma.inventoryItem.create({ data });
      // Durable trail: console logs are wiped on every redeploy, and inventory
      // is now editable by scope holders rather than only managers.
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: id ? 'INVENTORY_UPDATED' : 'INVENTORY_CREATED',
          entityType: 'InventoryItem',
          entityId: item.id,
          details: { name: item.name, before: before ?? undefined, after: item },
        },
      });
      logger.info(
        {
          itemId: item.id,
          action: id ? 'updated' : 'created',
          by: ctx.user.email,
        },
        'inventory item saved'
      );
      return item;
    }),

  /**
   * Soft removal, available to scope holders. Separating "take it off the
   * working list" from "destroy the record" is what makes it safe to let a
   * non-lead tidy the inventory.
   */
  archive: scopedProcedure('INVENTORY', 'MANAGER')
    .input(z.object({ id: z.string().uuid(), archived: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.inventoryItem.update({
        where: { id: input.id },
        data: { archivedAt: input.archived ? new Date() : null },
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: input.archived ? 'INVENTORY_ARCHIVED' : 'INVENTORY_RESTORED',
          entityType: 'InventoryItem',
          entityId: item.id,
          details: { name: item.name },
        },
      });
      logger.info(
        { itemId: item.id, name: item.name, archived: input.archived, by: ctx.user.email },
        'inventory item archive toggled'
      );
      return item;
    }),

  delete: leadProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.inventoryItem.delete({
        where: { id: input.id },
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'INVENTORY_DELETED',
          entityType: 'InventoryItem',
          entityId: item.id,
          details: { name: item.name, deleted: item },
        },
      });
      logger.info(
        { itemId: item.id, name: item.name, by: ctx.user.email },
        'inventory item deleted'
      );
      return { id: item.id };
    }),
});
