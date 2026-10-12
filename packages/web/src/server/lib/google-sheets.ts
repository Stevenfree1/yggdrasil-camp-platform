import { google } from 'googleapis';

export type SheetValue = string | number | boolean | null;

export interface SheetData {
  title: string;
  rows: SheetValue[][];
}

export interface GoogleSheetsSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  updatedSheets: Array<{ title: string; rows: number }>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function quotedSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function getAuth() {
  return new google.auth.JWT({
    email: requireEnv('GOOGLE_SHEETS_CLIENT_EMAIL'),
    key: requireEnv('GOOGLE_SHEETS_PRIVATE_KEY').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function syncSheetsToGoogle(
  sheetsToSync: SheetData[],
  spreadsheetId = process.env.GOOGLE_SHEETS_BACKUP_SPREADSHEET_ID,
): Promise<GoogleSheetsSyncResult> {
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_BACKUP_SPREADSHEET_ID is not configured');
  }

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });

  let metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(
    metadata.data.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)) ?? [],
  );

  const missing = sheetsToSync.filter((sheet) => !existingTitles.has(sheet.title));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((sheet) => ({
          addSheet: {
            properties: {
              title: sheet.title,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        })),
      },
    });
    metadata = await sheets.spreadsheets.get({ spreadsheetId });
  }

  const sheetIdsByTitle = new Map<string, number>();
  for (const sheet of metadata.data.sheets ?? []) {
    const title = sheet.properties?.title;
    const sheetId = sheet.properties?.sheetId;
    if (title && sheetId !== undefined && sheetId !== null) {
      sheetIdsByTitle.set(title, sheetId);
    }
  }

  const updatedSheets: Array<{ title: string; rows: number }> = [];

  for (const sheet of sheetsToSync) {
    const quoted = quotedSheetTitle(sheet.title);
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${quoted}!A:ZZ`,
    });

    if (sheet.rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${quoted}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: sheet.rows },
      });
    }

    updatedSheets.push({ title: sheet.title, rows: sheet.rows.length });
  }

  const formatRequests = sheetsToSync
    .map((sheet) => sheetIdsByTitle.get(sheet.title))
    .filter((sheetId): sheetId is number => sheetId !== undefined)
    .flatMap((sheetId) => [
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      },
      {
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 26 },
        },
      },
    ]);

  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    updatedSheets,
  };
}
