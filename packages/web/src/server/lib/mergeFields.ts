import type { Recipient } from './recipients';

/**
 * Substitute every {{key}} placeholder in `text` with the matching value from
 * `context`. Unknown or empty placeholders are stripped — sent mail never
 * contains a literal {{…}}. Whitespace inside the braces is tolerated.
 */
export function renderMergeFields(text: string, context: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key: string) => context[key] ?? '');
}

/** Format integer cents as a dollar string: 120000 → "$1,200", 125050 → "$1,250.50". */
function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString('en-US')}`
    : `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Build the per-recipient merge context: shared fields (e.g. seasonName) plus
 * the recipient-specific firstName and duesAmount. firstName is the first
 * whitespace token of the member's name, falling back to "there".
 * duesAmount is the member's effective dues (override ?? season default).
 */
export function buildRecipientContext(
  recipient: Recipient,
  shared: Record<string, string>,
  seasonDuesCents: number,
): Record<string, string> {
  const firstName = recipient.name?.trim().split(/\s+/)[0] || 'there';
  const duesAmount = formatDollars(recipient.duesOverrideCents ?? seasonDuesCents);
  return { ...shared, firstName, duesAmount };
}
