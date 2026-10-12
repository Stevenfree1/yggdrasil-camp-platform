import { LodgingUnitKind } from './types';

export const VALID_LODGING_KINDS = new Set<LodgingUnitKind>([
  'TENT', 'RV', 'SHIFTPOD', 'TRAILER', 'DORM', 'STRUCTURE', 'BOUNDARY', 'STREET_LABEL', 'POWER_BOX',
  'SHADE_SAIL', 'TEXT_LABEL', 'CONTAINER', 'DINING_TENT', 'BOX_TRUCK', 'MAHAL_TENT', 'CANOPY', 'SHADE_CLOTH',
  'PLUG_15A', 'PLUG_30A', 'PLUG_50A', 'PLUG_L21_30',
]);

export interface ParsedCsvRow {
  lineNum: number;
  memberName?: string;
  kind: LodgingUnitKind;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  partnerCamp?: string;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  errors: string[];
}

function parseCsvRows(text: string): string[][] {
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

export function parseLodgingCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const rows: ParsedCsvRow[] = [];
  const csvRows = parseCsvRows(text);
  if (csvRows.length === 0) return { rows, errors: ['No data'] };

  const header = csvRows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const required = ['kind', 'w', 'h', 'x', 'y'];
  for (const r of required) {
    if (idx(r) === -1) errors.push(`Missing required column: "${r}"`);
  }
  if (errors.length) return { rows, errors };

  for (let i = 1; i < csvRows.length; i++) {
    const lineNum = i + 1;
    const cells = csvRows[i];
    const kindRaw = cells[idx('kind')]?.toUpperCase();
    if (!kindRaw || !VALID_LODGING_KINDS.has(kindRaw as LodgingUnitKind)) {
      errors.push(`Line ${lineNum}: invalid kind "${kindRaw}"`);
      continue;
    }

    const w = Number(cells[idx('w')]);
    const h = Number(cells[idx('h')]);
    const x = Number(cells[idx('x')]);
    const y = Number(cells[idx('y')]);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
      errors.push(`Line ${lineNum}: invalid w/h`);
      continue;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(`Line ${lineNum}: invalid x/y`);
      continue;
    }

    const rotation = idx('rotation') !== -1 ? Number(cells[idx('rotation')] || '0') : 0;
    rows.push({
      lineNum,
      memberName: idx('membername') !== -1 ? cells[idx('membername')] || undefined : undefined,
      kind: kindRaw as LodgingUnitKind,
      label: idx('label') !== -1 ? cells[idx('label')] || undefined : undefined,
      w,
      h,
      x,
      y,
      rotation: Number.isFinite(rotation) ? rotation : 0,
      partnerCamp: idx('partnercamp') !== -1 ? cells[idx('partnercamp')] || undefined : undefined,
    });
  }

  return { rows, errors };
}
