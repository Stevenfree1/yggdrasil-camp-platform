import { readFileSync } from 'fs';
import { join } from 'path';
import { parseBrcWeatherCsv, FRESH_WINDOW_MS } from '@/server/lib/brc-weather';

// Real sheet captured 2026-08-10 06:00 PDT. If BM restructures the sheet,
// re-capture with:
//   curl -sL "https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=0"
const fixture = readFileSync(
  join(__dirname, '__fixtures__', 'brc-weather.csv'),
  'utf8',
);

describe('parseBrcWeatherCsv', () => {
  const parsed = parseBrcWeatherCsv(fixture)!;

  it('parses the fixture at all', () => {
    expect(parsed).not.toBeNull();
  });

  it('reads the update stamp as Pacific time', () => {
    // B3 = "2026-08-10 8:00:04" → 08:00 PDT → 15:00 UTC
    expect(parsed.updatedAt.toISOString()).toBe('2026-08-10T15:00:04.000Z');
  });

  it('finds no advisories — both slots have expirations but no text', () => {
    // At capture time the morning heat advisory had just expired and BM
    // cleared its text, leaving the expiration cells behind. An expiration
    // without text is not an advisory.
    expect(parsed.advisories).toHaveLength(0);
  });

  it('finds an advisory when a slot has both text and an expiration', () => {
    const withAdvisory = fixture.replace(
      ',20260810 0800,',
      '"NWS Heat Advisory in effect until Monday at 8 AM.",20260810 0800,',
    );
    const p = parseBrcWeatherCsv(withAdvisory)!;
    expect(p.advisories).toHaveLength(1);
    expect(p.advisories[0].text).toContain('Heat Advisory');
    // "20260810 0800" PDT → 15:00 UTC
    expect(p.advisories[0].expiresAt.toISOString()).toBe('2026-08-10T15:00:00.000Z');
  });

  it('splits the eight forecast periods in sheet order', () => {
    expect(parsed.periods.map((p) => p.label)).toEqual([
      'Today', 'Tonight',
      'Tuesday', 'Tuesday Night',
      'Wednesday', 'Wednesday Night',
      'Thursday', 'Thursday Night',
    ]);
    // Prose excludes the label line
    expect(parsed.periods[0].text).toMatch(/^Haze and areas of smoke/);
  });

  it('extracts stats where present, leaves them undefined where not', () => {
    const byLabel = Object.fromEntries(parsed.periods.map((p) => [p.label, p]));
    expect(byLabel['Today'].highF).toBe(101);
    expect(byLabel['Today'].gustMph).toBe(20);
    expect(byLabel['Today'].lowF).toBeUndefined();
    expect(byLabel['Tonight'].lowF).toBe(66);
    expect(byLabel['Wednesday'].precipPct).toBe(30);
    // "Possible gusts to 15 mph" phrasing
    expect(byLabel['Thursday'].gustMph).toBe(15);
    expect(byLabel['Tonight'].precipPct).toBeUndefined();
  });

  it('captures the disclaimer', () => {
    expect(parsed.disclaimer).toMatch(/^DISCLAIMER:/);
    expect(parsed.disclaimer).toContain('no warranty');
  });
});

describe('parseBrcWeatherCsv fail-soft', () => {
  it.each([
    ['empty string', ''],
    ['whitespace', '   \n\n  '],
    ['HTML error page', '<html><body><h1>Sorry, unable to open the file</h1></body></html>'],
    ['CSV noise without a stamp', 'a,b,c\nd,e,f\n"Today\nSunny",x,y\n'],
    ['stamp but no periods', ',,\nTitle,,\n"Updated",2026-08-10 6:00:04,note\n'],
  ])('returns null on %s (never throws)', (_name, input) => {
    expect(parseBrcWeatherCsv(input)).toBeNull();
  });

  it('ignores a malformed advisory expiration instead of crashing', () => {
    // The sheet itself warns "must be correct or program crashes" — we differ.
    const mangled = fixture.replace(
      ',20260810 0800,',
      '"Some advisory text",not a date,',
    );
    const parsed = parseBrcWeatherCsv(mangled)!;
    expect(parsed).not.toBeNull();
    expect(parsed.advisories).toHaveLength(0);
    expect(parsed.periods.length).toBe(8);
  });
});

describe('freshness window', () => {
  it('is 48 hours', () => {
    expect(FRESH_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
  });
});
