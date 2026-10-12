import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, leadProcedure } from '../trpc';
import { isDuesUnpaid } from '../lib/recipients';
import { syncSheetsToGoogle } from '../lib/google-sheets';
import { getCampConfig } from '@/lib/config';
import {
  buildMasterDocument,
  masterDocumentToXlsxBuffer,
  SeasonNotFoundError,
} from '../lib/master-doc';

function notFoundIfMissingSeason(error: unknown): never {
  if (error instanceof SeasonNotFoundError) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
  }
  throw error;
}

/** 'Dust Devil' -> 'Dust_Devil' (safe for a download filename). */
function campSlug(name: string): string {
  return name.trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Camp';
}

// ─── Router ──────────────────────────────────────────────────────────

export const exportRouter = router({
  syncGoogleSheet: leadProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      spreadsheetId: z.string().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = await buildMasterDocument(ctx.prisma, input.seasonId)
        .catch(notFoundIfMissingSeason);
      const result = await syncSheetsToGoogle(data.sheets, input.spreadsheetId);

      return {
        ...result,
        memberCount: data.memberCount,
        paymentCount: data.paymentCount,
        season: data.season,
      };
    }),

  season: leadProcedure
    .input(z.object({ seasonId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const data = await buildMasterDocument(ctx.prisma, input.seasonId)
        .catch(notFoundIfMissingSeason);

      return {
        fileName: `${campSlug(getCampConfig().shortName)}_Master_Document_${data.season.year}.xlsx`,
        base64: masterDocumentToXlsxBuffer(data.sheets).toString('base64'),
        memberCount: data.memberCount,
        paymentCount: data.paymentCount,
      };
    }),

  emailList: leadProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      status: z.enum(['INTERESTED', 'MAYBE', 'CONFIRMED', 'WAITLISTED', 'CANCELLED']).optional(),
      filter: z.enum([
        'all',
        'unpaid_dues',
        'no_ticket',
        'not_on_whatsapp',
        'build_crew',
        'strike_crew',
        'virgins',
        'no_preapproval',
      ]).optional().default('all'),
    }))
    .mutation(async ({ ctx, input }) => {
      const season = await ctx.prisma.season.findUnique({
        where: { id: input.seasonId },
        select: { id: true, year: true, name: true, duesAmount: true },
      });
      if (!season) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
      }

      // Build the base where clause
      const where: Record<string, unknown> = { seasonId: input.seasonId };
      if (input.status) {
        where.status = input.status;
      }

      // Fetch all season members with related data
      const seasonMembers = await ctx.prisma.seasonMember.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, email: true } },
          payments: { select: { type: true, amount: true } },
        },
        orderBy: { member: { name: 'asc' } },
      });

      // Apply filters
      let filtered = seasonMembers;

      switch (input.filter) {
        case 'unpaid_dues': {
          filtered = seasonMembers.filter((sm) =>
            isDuesUnpaid({
              duesStatus: sm.duesStatus,
              duesOverrideCents: sm.duesOverrideCents,
              seasonDuesCents: season.duesAmount ?? 0,
              duesPaidCents: sm.payments
                .filter((p) => p.type === 'DUES')
                .reduce((sum, p) => sum + p.amount, 0),
            }),
          );
          break;
        }
        case 'no_ticket': {
          // Members who haven't paid for a ticket
          filtered = seasonMembers.filter((sm) => {
            return !sm.payments.some((p) => p.type === 'TICKET');
          });
          break;
        }
        case 'not_on_whatsapp': {
          filtered = seasonMembers.filter((sm) => !sm.addedToWhatsApp);
          break;
        }
        case 'build_crew': {
          filtered = seasonMembers.filter((sm) => sm.buildCrew);
          break;
        }
        case 'strike_crew': {
          filtered = seasonMembers.filter((sm) => sm.strikeCrew);
          break;
        }
        case 'virgins': {
          filtered = seasonMembers.filter((sm) => sm.isCampVirgin || sm.isBMVirgin);
          break;
        }
        case 'no_preapproval': {
          filtered = seasonMembers.filter(
            (sm) => !sm.preApprovalForm || sm.preApprovalForm === 'NO',
          );
          break;
        }
        case 'all':
        default:
          break;
      }

      const emails = filtered.map((sm) => ({
        name: sm.member.name,
        email: sm.member.email,
      }));

      const csvString = emails.map((e) => `${e.name},${e.email}`).join('\n');
      const emailOnly = emails.map((e) => e.email).join(', ');

      return {
        count: emails.length,
        emails,
        csvString,
        emailOnly,
      };
    }),
});
