import { z } from 'zod';
import { EmailType, EmailStatus } from '@prisma/client';
import { router, managerProcedure } from '../trpc';
import { getEmailPreviews } from '../lib/email';

const listInput = z
  .object({
    search: z.string().trim().max(200).optional(),
    type: z.nativeEnum(EmailType).optional(),
    status: z.nativeEnum(EmailStatus).optional(),
    openedOnly: z.boolean().optional(),
    memberId: z.string().uuid().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .optional()
  .default({});

export const emailLogRouter = router({
  /**
   * Paginated log of outbound emails, newest first, with the resolved
   * recipient member and the admin who triggered the send (when known).
   */
  list: managerProcedure.input(listInput).query(async ({ ctx, input }) => {
    const { search, type, status, openedOnly, memberId, page, limit } = input;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (memberId) where.memberId = memberId;
    if (openedOnly) where.openedAt = { not: null };
    if (search) {
      where.OR = [
        { to: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { member: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [total, rows] = await Promise.all([
      ctx.prisma.emailLog.count({ where }),
      ctx.prisma.emailLog.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, email: true } },
          triggeredBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      rows,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }),

  /**
   * Headline counts for the log header: total sent, failed, and opened.
   */
  stats: managerProcedure.query(async ({ ctx }) => {
    const [total, sent, failed, opened] = await Promise.all([
      ctx.prisma.emailLog.count(),
      ctx.prisma.emailLog.count({ where: { status: 'SENT' } }),
      ctx.prisma.emailLog.count({ where: { status: 'FAILED' } }),
      ctx.prisma.emailLog.count({ where: { openedAt: { not: null } } }),
    ]);
    return { total, sent, failed, opened };
  }),

  /**
   * Renders every transactional email template with sample data, for the
   * read-only preview gallery. No DB access — pure template rendering.
   */
  previews: managerProcedure.query(async () => {
    return getEmailPreviews();
  }),
});
