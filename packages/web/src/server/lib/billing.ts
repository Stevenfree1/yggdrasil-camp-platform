import type { ChargeStatus, DuesStatus } from '@prisma/client';

/**
 * Pure money math for a member's "tab" (season dues + open charges).
 * No Prisma calls here — callers pass in already-loaded numbers so this stays
 * unit-testable and reusable across portal, roster, and the payment summary.
 * All amounts are integer cents.
 */

/** Dues a member actually owes for the season: 0 if waived, else override ?? season. */
export function effectiveDuesCents(
  duesStatus: DuesStatus,
  duesOverrideCents: number | null,
  seasonDuesCents: number,
): number {
  if (duesStatus === 'WAIVED') return 0;
  return duesOverrideCents ?? seasonDuesCents;
}

export interface DuesRemainingInputs {
  duesStatus: DuesStatus;
  duesOverrideCents: number | null;
  seasonDuesCents: number;
  duesPaidCents: number;
}

/** Remaining dues after payments; never negative. */
export function duesRemainingCents(inputs: DuesRemainingInputs): number {
  const effective = effectiveDuesCents(inputs.duesStatus, inputs.duesOverrideCents, inputs.seasonDuesCents);
  return Math.max(0, effective - inputs.duesPaidCents);
}

/** Total of OPEN charges only (PAID/VOID excluded). */
export function openChargesTotalCents(
  charges: ReadonlyArray<{ amountCents: number; status: ChargeStatus }>,
): number {
  return charges.reduce((sum, c) => (c.status === 'OPEN' ? sum + c.amountCents : sum), 0);
}

/** Whole-tab balance. */
export function tabBalanceCents(parts: {
  duesRemainingCents: number;
  openChargesTotalCents: number;
}): number {
  return parts.duesRemainingCents + parts.openChargesTotalCents;
}

/**
 * Resolve the amount to charge for a dues payment line.
 * - undefined amount → pay the full remaining
 * - an explicit amount is honored as-is, INCLUDING over-payments — a member may
 *   choose to pay more than they owe. Only positivity is enforced here; the
 *   upper sanity bound is left to the input schema. An over-payment records the
 *   full captured amount and simply drives the remaining to 0 (never negative).
 * - throws on non-positive amounts or when nothing is owed
 */
export function resolveDuesPaymentCents(amountCents: number | undefined, remainingCents: number): number {
  if (remainingCents <= 0) {
    throw new Error('No dues are currently owed');
  }
  if (amountCents === undefined) return remainingCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('Payment amount must be a positive whole number of cents');
  }
  return amountCents;
}
