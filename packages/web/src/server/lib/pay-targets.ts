/**
 * Codec for the PayPal purchase-unit `custom_id`, which encodes WHAT a unit pays.
 * Format: "dues:<seasonMemberId>" or "charge:<chargeId>".
 * A bare uuid is accepted as a legacy dues target (orders created before the
 * payment path was generalized used a raw seasonMember id as custom_id).
 */
export type PayTarget =
  | { kind: 'dues'; seasonMemberId: string }
  | { kind: 'charge'; chargeId: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatPayTarget(t: PayTarget): string {
  return t.kind === 'dues' ? `dues:${t.seasonMemberId}` : `charge:${t.chargeId}`;
}

export function parsePayTarget(customId: string | undefined): PayTarget | null {
  if (!customId) return null;
  if (UUID_RE.test(customId)) return { kind: 'dues', seasonMemberId: customId };
  const i = customId.indexOf(':');
  if (i <= 0) return null;
  const kind = customId.slice(0, i);
  const id = customId.slice(i + 1);
  if (!id) return null;
  if (kind === 'dues') return { kind: 'dues', seasonMemberId: id };
  if (kind === 'charge') return { kind: 'charge', chargeId: id };
  return null;
}
