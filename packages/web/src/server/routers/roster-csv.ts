/**
 * Roster CSV helpers — parse + validate the dues/activation/housing roster
 * CSV produced by the `/admin/roster` "Export CSV" button (round-trips back in
 * through `seasonMembers.importRoster`).
 *
 * Dependency-free: reuses the same quote/CRLF-aware row tokenizer shape as
 * `components/lodging/csv.ts` (xlsx is overkill for a flat roster CSV). The
 * import surface is deliberately SAFE — it only ever resolves to existing
 * SeasonMembers and only sets dues / activation / housing. It never creates or
 * deletes members and never writes payments. Profile name/email are excluded
 * to avoid identity drift.
 */

import type { DuesStatus, HousingType, GridPower } from '@prisma/client';

// ─── Low-level CSV tokenizer (mirrors lodging/csv.ts parseCsvRows) ──────

/**
 * Tokenize CSV text into rows of trimmed cells. Handles double-quoted cells
 * (with "" escaping), commas inside quotes, and CRLF/CR/LF line endings.
 * Blank lines are dropped.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += ch;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

// ─── Enum / value mappers (mirror import.ts patterns) ──────────────────

/** Map a raw dues cell to a DuesStatus, or null if blank/unrecognized. */
export function mapDuesStatus(raw: string | undefined): DuesStatus | null {
  if (raw == null) return null;
  const v = raw.trim().toUpperCase();
  if (v === '') return null;
  if (v === 'UNPAID') return 'UNPAID';
  if (v === 'PAID') return 'PAID';
  if (v === 'WAIVED') return 'WAIVED';
  return null;
}

/**
 * Map a raw "activated" cell to a tristate:
 *   true  => activate (set activatedAt if currently null)
 *   false => deactivate (clear activatedAt if currently set)
 *   null  => leave untouched (blank / unrecognized)
 */
export function mapActivated(raw: string | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toUpperCase();
  if (v === '') return null;
  if (v === 'Y' || v === 'YES' || v === 'TRUE' || v === 'ACTIVE') return true;
  if (v === 'N' || v === 'NO' || v === 'FALSE' || v === 'INVITED') return false;
  return null;
}

/** Map a raw housing-type cell to a HousingType, or null if blank/unrecognized. */
export function mapHousingType(raw: string | undefined): HousingType | null {
  if (raw == null) return null;
  const v = raw.trim().toUpperCase();
  if (v === '') return null;
  const map: Record<string, HousingType> = {
    TENT: 'TENT',
    SHIFTPOD: 'SHIFTPOD',
    'SHIFT POD': 'SHIFTPOD',
    RV: 'RV',
    TRAILER: 'TRAILER',
    DORM: 'DORM',
    SHARED: 'SHARED',
    HEXAYURT: 'HEXAYURT',
    OTHER: 'OTHER',
  };
  return map[v] ?? null;
}

/** Map a raw grid-power cell to a GridPower, or null if blank/unrecognized. */
export function mapGridPower(raw: string | undefined): GridPower | null {
  if (raw == null) return null;
  const v = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (v === '') return null;
  if (v === 'NONE') return 'NONE';
  if (v === 'AMP_15' || v === '15' || v === '15AMP' || v === '15_AMP') return 'AMP_15';
  if (v === 'AMP_30' || v === '30' || v === '30AMP' || v === '30_AMP') return 'AMP_30';
  if (v === 'AMP_50' || v === '50' || v === '50AMP' || v === '50_AMP') return 'AMP_50';
  return null;
}

// ─── Header-mapped row parsing ─────────────────────────────────────────

/**
 * A single parsed roster CSV row, keyed by the header columns the exporter
 * emits. Only the resolution keys (memberId / email) and the safe-to-import
 * fields are surfaced; everything else in the CSV is ignored on import.
 */
export interface ParsedRosterRow {
  lineNum: number;
  memberId?: string;
  email?: string;
  duesStatus: DuesStatus | null;
  duesNote?: string;
  activated: boolean | null;
  housingType: HousingType | null;
  housingSize?: string;
  gridPower: GridPower | null;
}

export interface RosterCsvParseResult {
  rows: ParsedRosterRow[];
  errors: string[];
}

/**
 * Parse roster CSV text into header-mapped rows. Requires at least one of the
 * resolution-key columns (memberId / email) to be present in the header. Each
 * data row must carry a memberId or email to be importable; rows missing both
 * are pushed to `errors` and dropped.
 */
export function parseRosterCsv(text: string): RosterCsvParseResult {
  const errors: string[] = [];
  const rows: ParsedRosterRow[] = [];

  const csvRows = parseCsvRows(text);
  if (csvRows.length === 0) {
    return { rows, errors: ['No data: the file is empty'] };
  }

  const header = csvRows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());

  const memberIdCol = idx('memberId');
  const emailCol = idx('email');
  if (memberIdCol === -1 && emailCol === -1) {
    errors.push('Missing required key column: at least one of "memberId" or "email" must be present');
    return { rows, errors };
  }

  const duesStatusCol = idx('duesStatus');
  const duesNoteCol = idx('duesNote');
  const activatedCol = idx('activated');
  const housingTypeCol = idx('housingType');
  const housingSizeCol = idx('housingSize');
  const gridPowerCol = idx('gridPower');

  const cellAt = (cells: string[], col: number): string | undefined =>
    col !== -1 ? cells[col] : undefined;

  for (let i = 1; i < csvRows.length; i++) {
    const lineNum = i + 1;
    const cells = csvRows[i];

    const memberId = cellAt(cells, memberIdCol)?.trim() || undefined;
    const email = cellAt(cells, emailCol)?.trim() || undefined;

    if (!memberId && !email) {
      errors.push(`Line ${lineNum}: row has no memberId or email — skipped`);
      continue;
    }

    const duesStatusRaw = cellAt(cells, duesStatusCol);
    const housingTypeRaw = cellAt(cells, housingTypeCol);
    const gridPowerRaw = cellAt(cells, gridPowerCol);
    const activatedRaw = cellAt(cells, activatedCol);

    // Validate enum cells that are present-but-unrecognized (blank is fine).
    if (duesStatusRaw && duesStatusRaw.trim() && mapDuesStatus(duesStatusRaw) === null) {
      errors.push(`Line ${lineNum}: invalid duesStatus "${duesStatusRaw.trim()}" (expected UNPAID/PAID/WAIVED)`);
    }
    if (housingTypeRaw && housingTypeRaw.trim() && mapHousingType(housingTypeRaw) === null) {
      errors.push(`Line ${lineNum}: invalid housingType "${housingTypeRaw.trim()}"`);
    }
    if (gridPowerRaw && gridPowerRaw.trim() && mapGridPower(gridPowerRaw) === null) {
      errors.push(`Line ${lineNum}: invalid gridPower "${gridPowerRaw.trim()}" (expected NONE/AMP_15/AMP_30/AMP_50)`);
    }
    if (activatedRaw && activatedRaw.trim() && mapActivated(activatedRaw) === null) {
      errors.push(`Line ${lineNum}: invalid activated "${activatedRaw.trim()}" (expected Y/N)`);
    }

    const duesNote = cellAt(cells, duesNoteCol)?.trim();
    const housingSize = cellAt(cells, housingSizeCol)?.trim();

    rows.push({
      lineNum,
      memberId,
      email,
      duesStatus: mapDuesStatus(duesStatusRaw),
      duesNote: duesNote || undefined,
      activated: mapActivated(activatedRaw),
      housingType: mapHousingType(housingTypeRaw),
      housingSize: housingSize || undefined,
      gridPower: mapGridPower(gridPowerRaw),
    });
  }

  return { rows, errors };
}
