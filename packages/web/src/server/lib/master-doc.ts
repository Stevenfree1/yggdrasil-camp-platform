import type { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import type { SheetData, SheetValue } from './google-sheets';
import {
  effectiveDuesCents,
  duesRemainingCents,
  openChargesTotalCents,
  tabBalanceCents,
} from './billing';

/**
 * Builds the "Master Document" — the camp's traditional season spreadsheet —
 * entirely from the database. One row-builder per tab, all pure (data in,
 * rows out) so they stay unit-testable; `buildMasterDocument` does the
 * Prisma queries and assembles the workbook data.
 *
 * Consumed by the export router (xlsx download + Google Sheets sync), the
 * backup cron route, and the local CLI (`scripts/export-master-doc.ts`).
 */

export class SeasonNotFoundError extends Error {
  constructor(seasonId: string) {
    super(`Season not found: ${seasonId}`);
    this.name = 'SeasonNotFoundError';
  }
}

// ─── Label helpers (enum -> spreadsheet-friendly strings) ────────────

export function housingLabel(v: string | null): string {
  if (!v) return '';
  const map: Record<string, string> = {
    TENT: 'Tent',
    SHIFTPOD: 'Shiftpod',
    RV: 'RV',
    TRAILER: 'Trailer',
    DORM: 'Dorm',
    SHARED: 'Shared',
    HEXAYURT: 'Hexayurt',
    OTHER: 'Other',
  };
  return map[v] ?? v;
}

export function genderLabel(v: string | null): string {
  if (!v) return '';
  if (v === 'MALE') return 'M';
  if (v === 'FEMALE') return 'F';
  return '';
}

export function statusLabel(v: string): string {
  if (v === 'CONFIRMED') return 'Y';
  return '';
}

export function preApprovalLabel(v: string | null): string {
  if (!v) return '';
  const map: Record<string, string> = { YES: 'Yes', MAYBE: 'Maybe', NO: 'No' };
  return map[v] ?? '';
}

export function ynBool(v: boolean): string {
  return v ? 'Y' : '';
}

export function paymentTypeLabel(v: string): string {
  const map: Record<string, string> = {
    DUES: 'Dues',
    GRID: 'Grid',
    FOOD: 'Food',
    DONATION: 'Donation',
    RV_VOUCHER: 'RV Voucher',
    BEER_FUND: 'Beer',
    TENT: 'Tent',
    TICKET: 'Ticket',
    STRIKE_DONATION: 'Strike Donation',
    FUNDRAISING: 'Fundraising',
    OTHER: 'Other',
  };
  return map[v] ?? v;
}

export function paymentMethodLabel(v: string): string {
  const map: Record<string, string> = {
    VENMO: 'Venmo',
    ZELLE: 'Zelle',
    CASH: 'Cash',
    ACH: 'ACH',
    CARD: 'Card',
    PAYPAL: 'Paypal',
    OTHER: 'Other',
  };
  return map[v] ?? v;
}

const ENUM_ACRONYMS = new Set(['DGS', 'RV', 'AC', 'BM', 'WAP', 'ACH']);

/** 'PURCHASED_CONFIRMED' -> 'Purchased Confirmed'; acronyms stay uppercase ('DGS_DIRECT' -> 'DGS Direct') */
export function prettyEnum(v: string | null): string {
  if (!v) return '';
  return v
    .split('_')
    .map((w) => (ENUM_ACRONYMS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

export function formatDate(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Like formatDate but with the year — for tabs that span time (charges, expenses). */
export function formatDateYear(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dollars(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

// ─── Row builders (pure) ─────────────────────────────────────────────

export interface MemberRowInput {
  status: string;
  addedToWhatsApp: boolean;
  mapObject: string | null;
  housingType: string | null;
  housingSize: string | null;
  rideDetails: string | null;
  arrivalDate: Date | null;
  departureDate: Date | null;
  preApprovalForm: string | null;
  buildCrew: boolean;
  strikeCrew: boolean;
  isCampVirgin: boolean;
  isBMVirgin: boolean;
  member: {
    name: string;
    email: string;
    gender: string | null;
    dietaryRestrictions: string | null;
  };
  payments: Array<{ type: string }>;
}

export function buildMemberRows(seasonMembers: MemberRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Confirmed',
    'WhatsApp',
    'Name',
    'Email',
    'Dues Paid',
    'Grid Code',
    'Housing',
    'Housing Size',
    '',
    'Ride',
    'Arrival',
    'Departure',
    'Dietary',
    '',
    'Pre-Approval',
    'Gender',
    '',
    'Build Crew',
    'Strike Crew',
    'Camp Virgin',
    'BM Virgin',
    'Map Object',
  ]];

  for (const sm of seasonMembers) {
    const hasDues = sm.payments.some((p) => p.type === 'DUES');
    rows.push([
      statusLabel(sm.status),
      ynBool(sm.addedToWhatsApp),
      sm.member.name,
      sm.member.email,
      hasDues ? 'Y' : '',
      sm.mapObject ?? '',
      housingLabel(sm.housingType),
      sm.housingSize ?? '',
      '',
      sm.rideDetails ?? '',
      formatDate(sm.arrivalDate),
      formatDate(sm.departureDate),
      sm.member.dietaryRestrictions ?? '',
      '',
      preApprovalLabel(sm.preApprovalForm),
      genderLabel(sm.member.gender),
      '',
      ynBool(sm.buildCrew),
      ynBool(sm.strikeCrew),
      ynBool(sm.isCampVirgin),
      ynBool(sm.isBMVirgin),
      sm.mapObject ?? '',
    ]);
  }

  return rows;
}

export interface PaymentRowInput {
  memberName: string;
  type: string;
  paidAt: Date;
  amount: number;
  method: string;
  notes: string | null;
  paidTo: string | null;
}

export function buildDuesRows(payments: PaymentRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    '',
    'Type',
    'Name',
    'Date',
    'Amount',
    'Method',
    'Notes',
    'Paid To',
  ]];

  const sorted = [...payments].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

  for (const p of sorted) {
    rows.push([
      '',
      paymentTypeLabel(p.type),
      p.memberName,
      formatDate(p.paidAt),
      dollars(p.amount),
      paymentMethodLabel(p.method),
      p.notes ?? '',
      p.paidTo ?? '',
    ]);
  }

  return rows;
}

export interface TabBalanceInput {
  status: string;
  duesStatus: 'UNPAID' | 'PAID' | 'WAIVED';
  duesOverrideCents: number | null;
  member: { name: string; email: string };
  payments: Array<{ type: string; amount: number }>;
  charges: Array<{ amountCents: number; status: 'OPEN' | 'PAID' | 'VOID' }>;
}

export function buildTabBalancesRows(
  seasonMembers: TabBalanceInput[],
  seasonDuesCents: number,
): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Name',
    'Email',
    'Status',
    'Dues Status',
    'Dues Expected',
    'Dues Paid',
    'Dues Remaining',
    'Open Charges',
    'Total Owed',
  ]];

  for (const sm of seasonMembers) {
    const duesPaid = sm.payments
      .filter((p) => p.type === 'DUES')
      .reduce((sum, p) => sum + p.amount, 0);
    const expected = effectiveDuesCents(sm.duesStatus, sm.duesOverrideCents, seasonDuesCents);
    const remaining = duesRemainingCents({
      duesStatus: sm.duesStatus,
      duesOverrideCents: sm.duesOverrideCents,
      seasonDuesCents,
      duesPaidCents: duesPaid,
    });
    const openCharges = openChargesTotalCents(sm.charges);
    const total = tabBalanceCents({
      duesRemainingCents: remaining,
      openChargesTotalCents: openCharges,
    });

    rows.push([
      sm.member.name,
      sm.member.email,
      prettyEnum(sm.status),
      prettyEnum(sm.duesStatus),
      dollars(expected),
      dollars(duesPaid),
      dollars(remaining),
      dollars(openCharges),
      dollars(total),
    ]);
  }

  return rows;
}

export interface ChargeRowInput {
  memberName: string;
  label: string;
  amountCents: number;
  status: string;
  source: string;
  createdAt: Date;
  paidAt: Date | null;
  voidedAt: Date | null;
  note: string | null;
}

export function buildChargesRows(charges: ChargeRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Member',
    'Charge',
    'Amount',
    'Status',
    'Source',
    'Created',
    'Paid',
    'Voided',
    'Note',
  ]];

  for (const c of charges) {
    rows.push([
      c.memberName,
      c.label,
      dollars(c.amountCents),
      prettyEnum(c.status),
      prettyEnum(c.source),
      formatDateYear(c.createdAt),
      formatDateYear(c.paidAt),
      formatDateYear(c.voidedAt),
      c.note ?? '',
    ]);
  }

  return rows;
}

export interface TicketRowInput {
  type: string;
  quantity: number;
  status: string;
  source: string;
  vehiclePass: boolean;
  purchaseConfirmed: boolean;
  purchasedAt: Date | null;
  notes: string | null;
  placeholderName: string | null;
  placeholderEmail: string | null;
  member: { name: string; email: string } | null;
}

export function buildDgsRows(tickets: TicketRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Name',
    'Email',
    'Type',
    '# of Tix',
    'Status',
    'Vehicle Pass',
    'Purchase Confirmed',
    'Purchased',
    'Source',
    'Notes',
  ]];

  for (const t of tickets) {
    rows.push([
      t.member?.name ?? t.placeholderName ?? '',
      t.member?.email ?? t.placeholderEmail ?? '',
      prettyEnum(t.type),
      t.quantity,
      prettyEnum(t.status),
      ynBool(t.vehiclePass),
      ynBool(t.purchaseConfirmed),
      formatDateYear(t.purchasedAt),
      prettyEnum(t.source),
      t.notes ?? '',
    ]);
  }

  return rows;
}

export interface WaitlistRowInput {
  position: number;
  name: string;
  email: string | null;
  quantityRequested: number;
  fulfilledAt: Date | null;
  notes: string | null;
}

export function buildWaitlistRows(entries: WaitlistRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Position',
    'Name',
    'Email',
    '# Requested',
    'Fulfilled',
    'Notes',
  ]];

  for (const e of entries) {
    rows.push([
      e.position,
      e.name,
      e.email ?? '',
      e.quantityRequested,
      formatDateYear(e.fulfilledAt),
      e.notes ?? '',
    ]);
  }

  return rows;
}

export interface EarlyArrivalRowInput {
  arrivalDate: Date;
  passId: string | null;
  notes: string | null;
  seasonMember: { member: { name: string; email: string } };
}

export function buildEarlyArrivalRows(passes: EarlyArrivalRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Member',
    'Email',
    'Arrival',
    'Pass ID',
    'Notes',
  ]];

  for (const p of passes) {
    rows.push([
      p.seasonMember.member.name,
      p.seasonMember.member.email,
      formatDate(p.arrivalDate),
      p.passId ?? '',
      p.notes ?? '',
    ]);
  }

  return rows;
}

export interface BuildDayRowInput {
  name: string;
  date: Date;
  assignments: Array<{
    wapTicketId: string | null;
    team: string | null;
    notes: string | null;
    seasonMember: { member: { name: string; email: string } };
  }>;
}

export function buildBuildRows(buildDays: BuildDayRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Build Day',
    'Date',
    'Member',
    'Email',
    'WAP Ticket',
    'Team',
    'Notes',
  ]];

  for (const day of buildDays) {
    for (const a of day.assignments) {
      rows.push([
        day.name,
        formatDate(day.date),
        a.seasonMember.member.name,
        a.seasonMember.member.email,
        a.wapTicketId ?? '',
        a.team ?? '',
        a.notes ?? '',
      ]);
    }
  }

  return rows;
}

export interface StrikeRowInput {
  departureDate: Date | null;
  team: string | null;
  notes: string | null;
  seasonMember: { member: { name: string; email: string } };
}

export function buildStrikeRows(assignments: StrikeRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Member',
    'Email',
    'Departure',
    'Team',
    'Notes',
  ]];

  for (const a of assignments) {
    rows.push([
      a.seasonMember.member.name,
      a.seasonMember.member.email,
      formatDate(a.departureDate),
      a.team ?? '',
      a.notes ?? '',
    ]);
  }

  return rows;
}

export interface ShiftRowInput {
  name: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string | null;
  assignments: Array<{
    status: string;
    notes: string | null;
    seasonMember: { member: { name: string } };
  }>;
}

export function buildShiftsRows(shifts: ShiftRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Shift',
    'Date',
    'Time',
    'Location',
    'Member',
    'Status',
    'Notes',
  ]];

  for (const shift of shifts) {
    for (const a of shift.assignments) {
      rows.push([
        shift.name,
        formatDate(shift.date),
        `${shift.startTime}–${shift.endTime}`,
        shift.location ?? '',
        a.seasonMember.member.name,
        prettyEnum(a.status),
        a.notes ?? '',
      ]);
    }
  }

  return rows;
}

export interface InventoryRowInput {
  category: string;
  name: string;
  quantity: number;
  dimensions: string | null;
  condition: string | null;
  storageLocation: string | null;
  notes: string | null;
}

export function buildInventoryRows(items: InventoryRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Category',
    'Item',
    'Qty',
    'Dimensions',
    'Condition',
    'Storage Location',
    'Notes',
  ]];

  for (const i of items) {
    rows.push([
      prettyEnum(i.category),
      i.name,
      i.quantity,
      i.dimensions ?? '',
      i.condition ?? '',
      i.storageLocation ?? '',
      i.notes ?? '',
    ]);
  }

  return rows;
}

export interface BudgetRowInput {
  category: string;
  description: string | null;
  estimatedAmount: number;
  actualAmount: number | null;
  notes: string | null;
}

export function buildBudgetRows(lines: BudgetRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Category',
    'Description',
    'Estimated',
    'Actual',
    'Notes',
  ]];

  for (const l of lines) {
    rows.push([
      prettyEnum(l.category),
      l.description ?? '',
      dollars(l.estimatedAmount),
      l.actualAmount === null ? '' : dollars(l.actualAmount),
      l.notes ?? '',
    ]);
  }

  return rows;
}

export interface ExpenseRowInput {
  date: Date;
  description: string;
  category: string | null;
  amount: number;
  paidBy: string;
  needsReimbursement: boolean;
  reimbursed: boolean;
  notes: string | null;
}

export function buildExpensesRows(expenses: ExpenseRowInput[]): SheetValue[][] {
  const rows: SheetValue[][] = [[
    'Date',
    'Description',
    'Category',
    'Amount',
    'Paid By',
    'Needs Reimbursement',
    'Reimbursed',
    'Notes',
  ]];

  for (const e of expenses) {
    rows.push([
      formatDateYear(e.date),
      e.description,
      e.category ?? '',
      dollars(e.amount),
      e.paidBy,
      ynBool(e.needsReimbursement),
      ynBool(e.reimbursed),
      e.notes ?? '',
    ]);
  }

  return rows;
}

// ─── XLSX serialization ──────────────────────────────────────────────

/** Column widths sized to content so every tab is readable without manual tuning. */
function autoColumnWidths(sheet: SheetData): Array<{ wch: number }> {
  const widths: number[] = [];
  for (const row of sheet.rows) {
    row.forEach((cell, i) => {
      const len = cell === null ? 0 : String(cell).length;
      widths[i] = Math.max(widths[i] ?? 0, len);
    });
  }
  return widths.map((w) => ({ wch: Math.min(40, Math.max(8, w + 2)) }));
}

export function masterDocumentToXlsxBuffer(sheets: SheetData[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    ws['!cols'] = autoColumnWidths(sheet);
    XLSX.utils.book_append_sheet(wb, ws, sheet.title);
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

// ─── Assembler ───────────────────────────────────────────────────────

export interface MasterDocument {
  season: { id: string; year: number; name: string };
  sheets: SheetData[];
  memberCount: number;
  paymentCount: number;
}

export async function buildMasterDocument(
  prisma: PrismaClient,
  seasonId: string,
): Promise<MasterDocument> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, year: true, name: true, duesAmount: true },
  });
  if (!season) {
    throw new SeasonNotFoundError(seasonId);
  }

  const [
    seasonMembers,
    tickets,
    waitlistEntries,
    earlyArrivalPasses,
    buildDays,
    strikeAssignments,
    shifts,
    inventoryItems,
    budgetLines,
    expenses,
  ] = await Promise.all([
    prisma.seasonMember.findMany({
      where: { seasonId },
      include: {
        member: {
          select: { id: true, name: true, email: true, gender: true, dietaryRestrictions: true },
        },
        payments: { orderBy: { paidAt: 'asc' } },
        charges: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { member: { name: 'asc' } },
    }),
    prisma.ticket.findMany({
      where: { seasonId },
      include: { member: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.waitlistEntry.findMany({
      where: { seasonId },
      orderBy: { position: 'asc' },
    }),
    prisma.earlyArrivalPass.findMany({
      where: { seasonId },
      include: { seasonMember: { include: { member: { select: { name: true, email: true } } } } },
      orderBy: { arrivalDate: 'asc' },
    }),
    prisma.buildDay.findMany({
      where: { seasonId },
      include: {
        assignments: {
          include: { seasonMember: { include: { member: { select: { name: true, email: true } } } } },
          orderBy: { seasonMember: { member: { name: 'asc' } } },
        },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.strikeAssignment.findMany({
      where: { seasonId },
      include: { seasonMember: { include: { member: { select: { name: true, email: true } } } } },
      orderBy: { seasonMember: { member: { name: 'asc' } } },
    }),
    prisma.shift.findMany({
      where: { seasonId },
      include: {
        assignments: {
          include: { seasonMember: { include: { member: { select: { name: true } } } } },
          orderBy: { seasonMember: { member: { name: 'asc' } } },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.inventoryItem.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.budgetLine.findMany({
      where: { seasonId },
      orderBy: { category: 'asc' },
    }),
    prisma.expense.findMany({
      where: { seasonId },
      orderBy: { date: 'asc' },
    }),
  ]);

  const allPayments: PaymentRowInput[] = seasonMembers.flatMap((sm) =>
    sm.payments.map((p) => ({
      memberName: sm.member.name,
      type: p.type,
      paidAt: p.paidAt,
      amount: p.amount,
      method: p.method,
      notes: p.notes,
      paidTo: p.paidTo,
    })),
  );

  const allCharges: ChargeRowInput[] = seasonMembers.flatMap((sm) =>
    sm.charges.map((c) => ({
      memberName: sm.member.name,
      label: c.label,
      amountCents: c.amountCents,
      status: c.status,
      source: c.source,
      createdAt: c.createdAt,
      paidAt: c.paidAt,
      voidedAt: c.voidedAt,
      note: c.note,
    })),
  );

  const sheets: SheetData[] = [
    { title: 'Members', rows: buildMemberRows(seasonMembers) },
    { title: 'Dues + Fees Paid', rows: buildDuesRows(allPayments) },
    { title: 'Tab Balances', rows: buildTabBalancesRows(seasonMembers, season.duesAmount) },
    { title: 'Charges', rows: buildChargesRows(allCharges) },
    { title: 'DGS', rows: buildDgsRows(tickets) },
    { title: 'DGS Waitlist', rows: buildWaitlistRows(waitlistEntries) },
    { title: 'Early Arrival Passes', rows: buildEarlyArrivalRows(earlyArrivalPasses) },
    { title: 'Build', rows: buildBuildRows(buildDays) },
    { title: 'Strike', rows: buildStrikeRows(strikeAssignments) },
    { title: 'Shifts', rows: buildShiftsRows(shifts) },
    { title: 'Inventory', rows: buildInventoryRows(inventoryItems) },
    { title: 'Budget', rows: buildBudgetRows(budgetLines) },
    { title: 'Expenses', rows: buildExpensesRows(expenses) },
  ];

  return {
    season: { id: season.id, year: season.year, name: season.name },
    sheets,
    memberCount: seasonMembers.length,
    paymentCount: allPayments.length,
  };
}
