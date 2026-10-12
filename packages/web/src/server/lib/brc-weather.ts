/**
 * Burning Man's official Black Rock City forecast, via brcweather.com.
 *
 * brcweather.com is a bare 302 to a public Google Sheet maintained by BM's
 * weather team (updated twice daily during the event). We resolve the sheet ID
 * from that redirect so the integration survives BM rotating the sheet between
 * seasons, fetch the CSV export (no auth, no key), and parse it fail-soft:
 * the sheet is positional and human-edited — its own cells warn "must be
 * correct or program crashes" — so every surprise here degrades to `null`,
 * which the portal renders as "no card".
 *
 * Everything happens at request time behind a module-scope cache; forecast
 * updates never require a rebuild or redeploy.
 */

export interface WeatherPeriod {
  label: string;
  text: string;
  highF?: number;
  lowF?: number;
  gustMph?: number;
  precipPct?: number;
}

export interface WeatherAdvisory {
  text: string;
  expiresAt: Date;
}

export interface BrcWeather {
  updatedAt: Date;
  /** All unexpired-or-not advisories as parsed; filter by expiresAt at serve time. */
  advisories: WeatherAdvisory[];
  periods: WeatherPeriod[];
  disclaimer: string | null;
}

/** Sheet's stated validity is 24 h; serve up to 48 h so a missed morning
 *  update doesn't blank the card mid-event. Past that it's off-season noise. */
export const FRESH_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Fallback sheet id, used when the brcweather.com resolver can't be reached. */
const DEFAULT_SHEET_ID = '1AfpmyriBHIFQ_Jymw3wHn9dtAGTgLcAjbnogNPsLvEA';

const RESOLVER_URL = 'http://brcweather.com/';
const SHEET_ID_TTL_MS = 24 * 60 * 60 * 1000;
const RESULT_TTL_MS = 15 * 60 * 1000;
const FAILURE_BACKOFF_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Sheet times are Pacific. The event is always inside PDT (UTC-7); a fixed
 * offset is off by an hour in winter, when the 48 h freshness gate has long
 * since hidden the card anyway.
 */
const PACIFIC_OFFSET_HOURS = 7;

/** Minimal RFC 4180 parser — forecast cells are quoted with embedded newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** "2026-08-10 6:00:04" (Pacific) → Date, or null. */
function parseStamp(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!m) return null;
  return new Date(
    Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + PACIFIC_OFFSET_HOURS, +m[5], +(m[6] ?? 0)),
  );
}

/** "20260810 0800" (Pacific) → Date, or null. */
function parseExpiration(raw: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + PACIFIC_OFFSET_HOURS, +m[5]));
}

/** First line of a forecast-period cell: "Today", "Tuesday Night", etc. */
const PERIOD_LABEL =
  /^(Today|Tonight|This Afternoon|Overnight|Labor Day|(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day)(?: (?:Night|Afternoon|Evening))?$/;

function extractStats(text: string): Pick<WeatherPeriod, 'highF' | 'lowF' | 'gustMph' | 'precipPct'> {
  const num = (re: RegExp) => {
    const m = re.exec(text);
    return m ? +m[1] : undefined;
  };
  return {
    highF: num(/high near (\d+)/i),
    lowF: num(/low around (\d+)/i),
    gustMph: num(/gusts (?:as high as|to) (\d+)/i),
    precipPct: num(/precipitation is (\d+)\s?%/i),
  };
}

/**
 * Parse the sheet CSV. Positional only where unavoidable (the update stamp);
 * advisories and periods are found by shape, not row number, so cosmetic
 * reshuffles don't break us. Returns null on any structural surprise.
 */
export function parseBrcWeatherCsv(csv: string): BrcWeather | null {
  try {
    const rows = parseCsv(csv);

    // Update stamp: a col-B cell that parses as "YYYY-MM-DD H:MM[:SS]".
    // (Currently B3, but found by shape.)
    let updatedAt: Date | null = null;
    for (const row of rows) {
      updatedAt = parseStamp(row[1] ?? '');
      if (updatedAt) break;
    }
    if (!updatedAt) return null;

    const advisories: WeatherAdvisory[] = [];
    const periods: WeatherPeriod[] = [];
    let disclaimer: string | null = null;

    for (const row of rows) {
      const a = (row[0] ?? '').trim();
      const b = (row[1] ?? '').trim();

      // Advisory: expiration-shaped col B alongside actual text in col A.
      const expiresAt = parseExpiration(b);
      if (expiresAt) {
        if (a) advisories.push({ text: a, expiresAt });
        continue;
      }
      if (!a) continue;

      const newline = a.indexOf('\n');
      const firstLine = (newline === -1 ? a : a.slice(0, newline)).trim();
      if (PERIOD_LABEL.test(firstLine) && newline !== -1) {
        const text = a.slice(newline + 1).trim();
        periods.push({ label: firstLine, text, ...extractStats(text) });
        continue;
      }
      if (a.startsWith('DISCLAIMER:')) disclaimer = a;
    }

    // A forecast with no periods isn't a forecast.
    if (periods.length === 0) return null;

    return { updatedAt, advisories, periods, disclaimer };
  } catch {
    return null;
  }
}

// ── fetch + cache ────────────────────────────────────────────────────────────

let sheetId = { id: DEFAULT_SHEET_ID, resolvedAt: 0 };
let cached: { data: BrcWeather | null; at: number } | null = null;
let lastFailureAt = 0;

/** Follow brcweather.com's 302 to learn the current sheet ID. */
async function resolveSheetId(now: number): Promise<string> {
  if (now - sheetId.resolvedAt < SHEET_ID_TTL_MS) return sheetId.id;
  try {
    const res = await fetch(RESOLVER_URL, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(res.headers.get('location') ?? '');
    if (m) sheetId = { id: m[1], resolvedAt: now };
  } catch {
    // keep the last-known ID
  }
  return sheetId.id;
}

/**
 * The current forecast, or null when unavailable. Cached 15 min; on failure
 * the previous result is served and refetching backs off for 2 min.
 */
export async function getBrcWeather(now: Date = new Date()): Promise<BrcWeather | null> {
  const t = now.getTime();
  if (cached && t - cached.at < RESULT_TTL_MS) return cached.data;
  if (t - lastFailureAt < FAILURE_BACKOFF_MS) return cached?.data ?? null;

  try {
    const id = await resolveSheetId(t);
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`sheet fetch ${res.status}`);
    const data = parseBrcWeatherCsv(await res.text());
    cached = { data, at: t };
    return data;
  } catch {
    lastFailureAt = t;
    return cached?.data ?? null;
  }
}
