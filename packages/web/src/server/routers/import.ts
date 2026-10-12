import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, leadProcedure } from '../trpc';
import * as XLSX from 'xlsx';

// ─── Enum mapping helpers ────────────────────────────────────────────

function mapHousingType(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    RV: 'RV',
    TENT: 'TENT',
    SHIFTPOD: 'SHIFTPOD',
    'SHIFT POD': 'SHIFTPOD',
    DORM: 'DORM',
    SHARED: 'SHARED',
    TRAILER: 'TRAILER',
    HEXAYURT: 'HEXAYURT',
  };
  return map[v] ?? 'OTHER';
}

function mapGender(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'MALE';
  if (v === 'F' || v === 'FEMALE') return 'FEMALE';
  return null;
}

function mapStatus(raw: string | undefined): string {
  if (!raw) return 'INTERESTED';
  const v = raw.trim().toUpperCase();
  if (v === 'Y' || v === 'YES' || v === 'CONFIRMED') return 'CONFIRMED';
  if (v === 'MAYBE') return 'MAYBE';
  if (v === 'WAITLISTED') return 'WAITLISTED';
  if (v === 'CANCELLED' || v === 'CANCELED') return 'CANCELLED';
  return 'INTERESTED';
}

function mapPreApproval(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === 'YES' || v === 'Y') return 'YES';
  if (v === 'MAYBE') return 'MAYBE';
  if (v === 'NO' || v === 'N') return 'NO';
  return null;
}

function mapPaymentType(raw: string | undefined): string {
  if (!raw) return 'OTHER';
  const v = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    DUES: 'DUES',
    GRID: 'GRID',
    FOOD: 'FOOD',
    DONATION: 'DONATION',
    'RV VOUCHER': 'RV_VOUCHER',
    RV_VOUCHER: 'RV_VOUCHER',
    'BEER FUND': 'BEER_FUND',
    BEER_FUND: 'BEER_FUND',
    BEER: 'BEER_FUND',
    TENT: 'TENT',
    TICKET: 'TICKET',
    'STRIKE DONATION': 'STRIKE_DONATION',
    STRIKE_DONATION: 'STRIKE_DONATION',
    STRIKE: 'STRIKE_DONATION',
    FUNDRAISING: 'FUNDRAISING',
    DORM: 'OTHER',
  };
  return map[v] ?? 'OTHER';
}

function mapPaymentMethod(raw: string | undefined): string {
  if (!raw) return 'OTHER';
  const v = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    VENMO: 'VENMO',
    ZELLE: 'ZELLE',
    CASH: 'CASH',
    ACH: 'ACH',
    CARD: 'CARD',
    BANK: 'ACH',
    'BANK ACCOUNT': 'ACH',
    PAYPAL: 'PAYPAL',
  };
  return map[v] ?? 'OTHER';
}

function parseYesNo(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toUpperCase();
  return v === 'Y' || v === 'YES';
}

/** Try to parse a date from Excel serial number or string */
function parseDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return new Date(d.y, d.m - 1, d.d);
    return null;
  }
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

/** Parse dollar amount to cents (integer) */
function parseDollarsToCents(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,]/g, ''));
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

// ─── Row-parsing types ───────────────────────────────────────────────

interface ParsedMember {
  name: string;
  email: string;
  status: string;
  addedToWhatsApp: boolean;
  housingType: string | null;
  housingSize: string | null;
  gridCode: string | null;
  rideDetails: string | null;
  arrivalDate: Date | null;
  departureDate: Date | null;
  dietaryRestrictions: string | null;
  preApprovalForm: string | null;
  gender: string | null;
  buildCrew: boolean;
  strikeCrew: boolean;
  isCampVirgin: boolean;
  isBMVirgin: boolean;
  mapObject: string | null;
  duesPaid: boolean;
}

interface ParsedPayment {
  memberName: string;
  type: string;
  date: Date | null;
  amountCents: number;
  method: string;
  notes: string | null;
  paidTo: string | null;
}

export interface ParseError {
  sheet: string;
  row: number;
  message: string;
}

// ─── Sheet parsing ──────────────────────────────────────────────────

function parseMembersSheet(wb: XLSX.WorkBook): { members: ParsedMember[]; errors: ParseError[] } {
  const members: ParsedMember[] = [];
  const errors: ParseError[] = [];
  const seen = new Map<string, number>(); // email (lower) -> index in members array

  const sheet = wb.Sheets['Members'] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    errors.push({ sheet: 'Members', row: 0, message: 'Sheet "Members" not found' });
    return { members, errors };
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const name = String(row[2] ?? '').trim();
    const email = String(row[3] ?? '').trim().toLowerCase();

    if (!name) continue; // blank row

    if (!email) {
      errors.push({ sheet: 'Members', row: i + 1, message: `Skipped "${name}": no email` });
      continue;
    }

    // Deduplicate by email
    if (seen.has(email)) {
      errors.push({ sheet: 'Members', row: i + 1, message: `Duplicate email "${email}" for "${name}", using first occurrence` });
      continue;
    }

    const member: ParsedMember = {
      name,
      email,
      status: mapStatus(String(row[0] ?? '')),
      addedToWhatsApp: parseYesNo(String(row[1] ?? '')),
      housingType: mapHousingType(String(row[6] ?? '')),
      housingSize: String(row[7] ?? '').trim() || null,
      gridCode: String(row[5] ?? '').trim() || null,
      rideDetails: String(row[9] ?? '').trim() || null,
      arrivalDate: parseDate(row[10]),
      departureDate: parseDate(row[11]),
      dietaryRestrictions: String(row[12] ?? '').trim() || null,
      preApprovalForm: mapPreApproval(String(row[14] ?? '')),
      gender: mapGender(String(row[15] ?? '')),
      buildCrew: parseYesNo(String(row[17] ?? '')),
      strikeCrew: parseYesNo(String(row[18] ?? '')),
      isCampVirgin: parseYesNo(String(row[19] ?? '')),
      isBMVirgin: parseYesNo(String(row[20] ?? '')),
      mapObject: String(row[21] ?? '').trim() || null,
      duesPaid: String(row[4] ?? '').trim().toUpperCase() === 'Y' || String(row[4] ?? '').trim().toUpperCase() === 'YES',
    };

    seen.set(email, members.length);
    members.push(member);
  }

  return { members, errors };
}

function parseDuesSheet(wb: XLSX.WorkBook): { payments: ParsedPayment[]; errors: ParseError[] } {
  const payments: ParsedPayment[] = [];
  const errors: ParseError[] = [];

  // Try to find the dues sheet by partial name match
  const sheetName = wb.SheetNames.find(
    (s) => s.toLowerCase().includes('dues') || s.toLowerCase().includes('fee') || s.toLowerCase().includes('paid'),
  );
  const sheet = sheetName ? wb.Sheets[sheetName] : wb.Sheets[wb.SheetNames[1]];

  if (!sheet) {
    errors.push({ sheet: 'Dues', row: 0, message: 'Dues sheet not found' });
    return { payments, errors };
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const memberName = String(row[2] ?? '').trim();
    const typeRaw = String(row[1] ?? '').trim();
    const amountRaw = row[4];

    // Skip rows without a member name or amount
    if (!memberName) continue;

    const amountCents = parseDollarsToCents(amountRaw);
    if (amountCents == null) {
      errors.push({
        sheet: sheetName ?? 'Dues',
        row: i + 1,
        message: `Skipped payment for "${memberName}": invalid amount "${amountRaw}"`,
      });
      continue;
    }

    payments.push({
      memberName,
      type: mapPaymentType(typeRaw),
      date: parseDate(row[3]),
      amountCents,
      method: mapPaymentMethod(String(row[5] ?? '')),
      notes: String(row[6] ?? '').trim() || null,
      paidTo: String(row[7] ?? '').trim() || null,
    });
  }

  return { payments, errors };
}

// ─── Fuzzy name matching ─────────────────────────────────────────────

/**
 * Find a member by name (case-insensitive contains match).
 * Returns the email of the best match, or null.
 */
function fuzzyMatchMember(
  paymentName: string,
  membersByName: Map<string, string>,
): string | null {
  const lower = paymentName.toLowerCase().trim();

  // Exact match
  if (membersByName.has(lower)) return membersByName.get(lower)!;

  // Contains match (check if payment name contains member name or vice versa)
  for (const [name, email] of membersByName) {
    if (lower.includes(name) || name.includes(lower)) {
      return email;
    }
  }

  return null;
}

// ─── Router ─────────────────────────────────────────────────────────

const importInput = z.object({
  fileBase64: z.string().max(5 * 1024 * 1024, 'File size must not exceed 5MB'),
  seasonId: z.string().uuid(),
});

export const importRouter = router({
  preview: leadProcedure
    .input(importInput)
    .mutation(async ({ ctx, input }) => {
      // Verify season exists
      const season = await ctx.prisma.season.findUnique({
        where: { id: input.seasonId },
        select: { id: true, year: true, name: true },
      });
      if (!season) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
      }

      // Parse Excel file
      const buf = Buffer.from(input.fileBase64, 'base64');
      let wb: XLSX.WorkBook;
      try {
        wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not parse Excel file' });
      }

      const { members: parsedMembers, errors: memberErrors } = parseMembersSheet(wb);
      const { payments: parsedPayments, errors: paymentErrors } = parseDuesSheet(wb);

      // Look up existing members by email
      const emails = parsedMembers.map((m) => m.email);
      const existingMembers = await ctx.prisma.member.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: { id: true, email: true, name: true },
      });
      const existingEmailSet = new Set(existingMembers.map((m) => m.email.toLowerCase()));

      // Classify new vs existing
      const newMembers = parsedMembers.filter((m) => !existingEmailSet.has(m.email));
      const existingMatches = parsedMembers.filter((m) => existingEmailSet.has(m.email));

      // Check existing enrollments
      const existingEnrollments = await ctx.prisma.seasonMember.findMany({
        where: {
          seasonId: input.seasonId,
          member: { email: { in: emails, mode: 'insensitive' } },
        },
        include: { member: { select: { email: true } } },
      });
      const enrolledEmailSet = new Set(existingEnrollments.map((e) => e.member.email.toLowerCase()));

      // Build name->email map for payment matching
      const membersByName = new Map<string, string>();
      for (const m of parsedMembers) {
        membersByName.set(m.name.toLowerCase(), m.email);
      }
      for (const m of existingMembers) {
        membersByName.set(m.name.toLowerCase(), m.email.toLowerCase());
      }

      // Count matchable payments
      let matchedPayments = 0;
      let unmatchedPayments = 0;
      const unmatchedNames: string[] = [];

      for (const p of parsedPayments) {
        const email = fuzzyMatchMember(p.memberName, membersByName);
        if (email) {
          matchedPayments++;
        } else {
          unmatchedPayments++;
          if (!unmatchedNames.includes(p.memberName)) {
            unmatchedNames.push(p.memberName);
          }
        }
      }

      return {
        season: { id: season.id, year: season.year, name: season.name },
        sheets: wb.SheetNames,
        members: {
          total: parsedMembers.length,
          new: newMembers.length,
          existing: existingMatches.length,
          alreadyEnrolled: enrolledEmailSet.size,
          newEnrollments: parsedMembers.length - enrolledEmailSet.size,
          names: parsedMembers.map((m) => ({
            name: m.name,
            email: m.email,
            isNew: !existingEmailSet.has(m.email),
            alreadyEnrolled: enrolledEmailSet.has(m.email),
            status: m.status,
          })),
        },
        payments: {
          total: parsedPayments.length,
          matched: matchedPayments,
          unmatched: unmatchedPayments,
          unmatchedNames,
        },
        errors: [...memberErrors, ...paymentErrors],
      };
    }),

  execute: leadProcedure
    .input(importInput)
    .mutation(async ({ ctx, input }) => {
      // Verify season exists
      const season = await ctx.prisma.season.findUnique({
        where: { id: input.seasonId },
        select: { id: true, year: true, name: true },
      });
      if (!season) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
      }

      // Parse Excel file
      const buf = Buffer.from(input.fileBase64, 'base64');
      let wb: XLSX.WorkBook;
      try {
        wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not parse Excel file' });
      }

      const { members: parsedMembers, errors: memberErrors } = parseMembersSheet(wb);
      const { payments: parsedPayments, errors: paymentErrors } = parseDuesSheet(wb);
      const errors: ParseError[] = [...memberErrors, ...paymentErrors];

      // Stats tracking
      let membersCreated = 0;
      let membersUpdated = 0;
      let enrollmentsCreated = 0;
      let enrollmentsUpdated = 0;
      let paymentsCreated = 0;
      let paymentsSkipped = 0;
      let paymentsUnmatched = 0;

      // ─── 1. Create or update members ──────────────────────────

      const emailToMemberId = new Map<string, string>();

      for (const pm of parsedMembers) {
        const existing = await ctx.prisma.member.findFirst({
          where: { email: { equals: pm.email, mode: 'insensitive' } },
        });

        if (existing) {
          // Update fields that are not already set
          const updateData: Record<string, unknown> = {};
          if (!existing.gender && pm.gender) updateData.gender = pm.gender;
          if (!existing.dietaryRestrictions && pm.dietaryRestrictions) {
            updateData.dietaryRestrictions = pm.dietaryRestrictions;
          }

          if (Object.keys(updateData).length > 0) {
            await ctx.prisma.member.update({
              where: { id: existing.id },
              data: updateData,
            });
            membersUpdated++;
          }

          emailToMemberId.set(pm.email, existing.id);
        } else {
          const created = await ctx.prisma.member.create({
            data: {
              email: pm.email,
              name: pm.name,
              gender: pm.gender as any,
              dietaryRestrictions: pm.dietaryRestrictions,
              role: 'MEMBER',
            },
          });
          membersCreated++;
          emailToMemberId.set(pm.email, created.id);
        }
      }

      // ─── 2. Create or update season enrollments ───────────────

      const emailToSeasonMemberId = new Map<string, string>();

      for (const pm of parsedMembers) {
        const memberId = emailToMemberId.get(pm.email);
        if (!memberId) continue;

        const existing = await ctx.prisma.seasonMember.findUnique({
          where: { seasonId_memberId: { seasonId: input.seasonId, memberId } },
        });

        const enrollmentData = {
          status: pm.status as any,
          housingType: pm.housingType as any,
          housingSize: pm.housingSize,
          arrivalDate: pm.arrivalDate,
          departureDate: pm.departureDate,
          rideDetails: pm.rideDetails,
          preApprovalForm: pm.preApprovalForm as any,
          mapObject: pm.mapObject,
          buildCrew: pm.buildCrew,
          strikeCrew: pm.strikeCrew,
          isCampVirgin: pm.isCampVirgin,
          isBMVirgin: pm.isBMVirgin,
          addedToWhatsApp: pm.addedToWhatsApp,
        };

        if (existing) {
          await ctx.prisma.seasonMember.update({
            where: { id: existing.id },
            data: enrollmentData,
          });
          enrollmentsUpdated++;
          emailToSeasonMemberId.set(pm.email, existing.id);
        } else {
          const created = await ctx.prisma.seasonMember.create({
            data: {
              seasonId: input.seasonId,
              memberId,
              ...enrollmentData,
            },
          });
          enrollmentsCreated++;
          emailToSeasonMemberId.set(pm.email, created.id);
        }
      }

      // ─── 3. Import payments ───────────────────────────────────

      // Build name->email map
      const membersByName = new Map<string, string>();
      for (const pm of parsedMembers) {
        membersByName.set(pm.name.toLowerCase(), pm.email);
      }
      // Also include existing members from DB for broader matching
      const allMembers = await ctx.prisma.member.findMany({
        select: { name: true, email: true },
      });
      for (const m of allMembers) {
        if (!membersByName.has(m.name.toLowerCase())) {
          membersByName.set(m.name.toLowerCase(), m.email.toLowerCase());
        }
      }

      for (const pp of parsedPayments) {
        const email = fuzzyMatchMember(pp.memberName, membersByName);
        if (!email) {
          paymentsUnmatched++;
          errors.push({
            sheet: 'Dues',
            row: 0,
            message: `Payment for "${pp.memberName}" ($${(pp.amountCents / 100).toFixed(2)}): no matching member`,
          });
          continue;
        }

        const seasonMemberId = emailToSeasonMemberId.get(email);
        if (!seasonMemberId) {
          // Member exists but not enrolled in this season -- try to find via DB
          const memberId = emailToMemberId.get(email);
          if (!memberId) {
            // Try DB lookup
            const dbMember = await ctx.prisma.member.findFirst({
              where: { email: { equals: email, mode: 'insensitive' } },
            });
            if (!dbMember) {
              paymentsUnmatched++;
              errors.push({
                sheet: 'Dues',
                row: 0,
                message: `Payment for "${pp.memberName}": member found by name but not in DB`,
              });
              continue;
            }

            // Auto-enroll in season
            const sm = await ctx.prisma.seasonMember.upsert({
              where: { seasonId_memberId: { seasonId: input.seasonId, memberId: dbMember.id } },
              create: { seasonId: input.seasonId, memberId: dbMember.id, status: 'INTERESTED' },
              update: {},
            });
            emailToSeasonMemberId.set(email, sm.id);
          } else {
            // Auto-enroll
            const sm = await ctx.prisma.seasonMember.upsert({
              where: { seasonId_memberId: { seasonId: input.seasonId, memberId } },
              create: { seasonId: input.seasonId, memberId, status: 'INTERESTED' },
              update: {},
            });
            emailToSeasonMemberId.set(email, sm.id);
          }
        }

        const smId = emailToSeasonMemberId.get(email);
        if (!smId) {
          paymentsUnmatched++;
          continue;
        }

        const paidAt = pp.date ?? new Date();

        // Check for duplicate payment (same member, type, amount, date)
        const duplicate = await ctx.prisma.payment.findFirst({
          where: {
            seasonMemberId: smId,
            type: pp.type as any,
            amount: pp.amountCents,
            paidAt,
          },
        });

        if (duplicate) {
          paymentsSkipped++;
          continue;
        }

        await ctx.prisma.payment.create({
          data: {
            seasonMemberId: smId,
            type: pp.type as any,
            amount: pp.amountCents,
            method: pp.method as any,
            paidTo: pp.paidTo,
            paidAt,
            notes: pp.notes,
            recordedBy: `Excel Import by ${ctx.user.name}`,
          },
        });
        paymentsCreated++;
      }

      // ─── 4. Create audit log ──────────────────────────────────

      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'EXCEL_IMPORT',
          entityType: 'Season',
          entityId: input.seasonId,
          details: {
            seasonName: season.name,
            membersCreated,
            membersUpdated,
            enrollmentsCreated,
            enrollmentsUpdated,
            paymentsCreated,
            paymentsSkipped,
            paymentsUnmatched,
            errorCount: errors.length,
          },
        },
      });

      return {
        success: true,
        stats: {
          membersCreated,
          membersUpdated,
          enrollmentsCreated,
          enrollmentsUpdated,
          paymentsCreated,
          paymentsSkipped,
          paymentsUnmatched,
        },
        errors,
      };
    }),
});
