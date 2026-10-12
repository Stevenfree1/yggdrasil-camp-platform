import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router, memberProcedure, leadProcedure } from '../trpc';
import logger from '../lib/logger';

// --- Validation schemas ---

const priorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

const createAnnouncementInput = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(10000),
  priority: priorityEnum.optional().default('NORMAL'),
  isPublished: z.boolean().optional().default(true),
  expiresAt: z.string().datetime({ message: 'Invalid expiration date' }).optional(),
});

const updateAnnouncementInput = z.object({
  id: z.string().uuid('Invalid announcement ID'),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  priority: priorityEnum.optional(),
  isPublished: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// --- Router ---

export const announcementsRouter = router({
  /** List published, non-expired announcements for members */
  list: memberProcedure
    .input(z.object({
      includeExpired: z.boolean().optional().default(false),
      includeUnpublished: z.boolean().optional().default(false),
      limit: z.number().int().min(1).max(100).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const where: Prisma.AnnouncementWhereInput = {};

      // Non-admin members only see published, non-expired announcements
      const isManager = ctx.user.role === 'LEAD' || ctx.user.role === 'MANAGER';

      if (!isManager || !input.includeUnpublished) {
        where.isPublished = true;
      }

      if (!isManager || !input.includeExpired) {
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ];
      }

      const [announcements, total] = await Promise.all([
        ctx.prisma.announcement.findMany({
          where,
          include: {
            author: { select: { id: true, name: true, playaName: true } },
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.announcement.count({ where }),
      ]);

      return { announcements, total };
    }),

  /** Get a single announcement by ID */
  getById: memberProcedure
    .input(z.object({ id: z.string().uuid('Invalid announcement ID') }))
    .query(async ({ ctx, input }) => {
      const announcement = await ctx.prisma.announcement.findUnique({
        where: { id: input.id },
        include: {
          author: { select: { id: true, name: true, playaName: true } },
        },
      });

      if (!announcement) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' });
      }

      // Non-admin members can only see published announcements
      const isManager = ctx.user.role === 'LEAD' || ctx.user.role === 'MANAGER';
      if (!isManager && !announcement.isPublished) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' });
      }

      return announcement;
    }),

  /** Create a new announcement (admin only) */
  create: leadProcedure
    .input(createAnnouncementInput)
    .mutation(async ({ ctx, input }) => {
      const announcement = await ctx.prisma.announcement.create({
        data: {
          title: input.title,
          content: input.content,
          authorId: ctx.user.id,
          priority: input.priority,
          isPublished: input.isPublished,
          publishedAt: input.isPublished ? new Date() : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
        include: {
          author: { select: { id: true, name: true, playaName: true } },
        },
      });

      logger.info(`Announcement created: "${input.title}" by ${ctx.user.email}`);

      return announcement;
    }),

  /** Update an existing announcement (admin only) */
  update: leadProcedure
    .input(updateAnnouncementInput)
    .mutation(async ({ ctx, input }) => {
      const { id, expiresAt, isPublished, ...rest } = input;

      const existing = await ctx.prisma.announcement.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' });
      }

      const data: Prisma.AnnouncementUpdateInput = { ...rest };

      if (expiresAt !== undefined) {
        data.expiresAt = expiresAt ? new Date(expiresAt) : null;
      }

      if (isPublished !== undefined) {
        data.isPublished = isPublished;
        // Set publishedAt when publishing for the first time
        if (isPublished && !existing.publishedAt) {
          data.publishedAt = new Date();
        }
      }

      const updated = await ctx.prisma.announcement.update({
        where: { id },
        data,
        include: {
          author: { select: { id: true, name: true, playaName: true } },
        },
      });

      logger.info(`Announcement updated: "${updated.title}" by ${ctx.user.email}`);

      return updated;
    }),

  /** Delete an announcement (admin only) */
  delete: leadProcedure
    .input(z.object({ id: z.string().uuid('Invalid announcement ID') }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.announcement.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' });
      }

      await ctx.prisma.announcement.delete({ where: { id: input.id } });

      logger.info(`Announcement deleted: "${existing.title}" by ${ctx.user.email}`);

      return { success: true };
    }),
});
