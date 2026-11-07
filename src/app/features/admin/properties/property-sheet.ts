/**
 * Google Sheets I/O for bulk property import — creates the template spreadsheet in the admin's Google Drive and reads
 * a filled-in one back into RawRows. Talks to the Sheets REST API directly with a Google Identity Services access
 * token (no client library), so nothing extra ships to staff who never open the import screen.
 *
 * Needs `environment.googleOAuthClientId` (Google Cloud Console → Credentials → OAuth client ID → Web application,
 * with this site's origin under "Authorized JavaScript origins", and the Google Sheets API enabled).
 */
import { environment } from '../../../../environments/environment';
import {
  AUTH_METHODS, AUTH_STATUSES, COLUMNS, CellValue, ColKey, ColumnDef, FACINGS, FURNISHINGS, HEADER_INDEX, ImportContext,
  ListName, NEED_LABEL, Need, RawRow, TENANT_TYPES, normHeader, recordToCells, societyOption, sourceOption,
} from '../../../core/admin/bulk-import';
import { PropertyRecord } from '../../../core/admin/admin.models';

export const SHEET = 'Properties';
export const MAX_ROWS = 2000;
const GUIDE_ROW = 1, HEADER_ROW = 2, FIRST_DATA_ROW = 3;
/** Dropdowns / formats are applied to this many blank rows in the template. */
const TEMPLATE_ROWS = 500;

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

const SHEET_ID = { properties: 1, instructions: 2, lists: 3 } as const;

const NEED_STYLE: Record<Need, { fill: string; font: string }> = {
  key:  { fill: '#DCE8FF', font: '#0B3D91' },
  new:  { fill: '#FDE2E1', font: '#9B1C1C' },
  cond: { fill: '#FFF1D6', font: '#8A5600' },
  opt:  { fill: '#F1F3F5', font: '#4A5568' },
  info: { fill: '#E9ECEF', font: '#6B7280' },
};
const NAVY = '#0C2A4C', WHITE = '#FFFFFF', GRAY = '#6B7280', BORDER = '#CBD2DC';
const headerText = (c: ColumnDef) => c.header + (c.need === 'new' ? ' *' : c.need === 'cond' ? ' (*)' : '');

/* ======================= Google sign-in ======================= */

export const isGoogleConfigured = () => !!environment.googleOAuthClientId;

interface TokenClient { requestAccessToken(o?: { prompt?: string }): void; }
interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string; }
interface GoogleIdentity {
  accounts: { oauth2: { initTokenClient(c: {
    client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string; message?: string }) => void;
  }): TokenClient } };
}

let gisLoad: Promise<GoogleIdentity> | undefined;
const loadGoogleIdentity = (): Promise<GoogleIdentity> => gisLoad ??= new Promise((resolve, reject) => {
  const w = window as unknown as { google?: GoogleIdentity };
  if (w.google?.accounts?.oauth2) return resolve(w.google);
  const s = Object.assign(document.createElement('script'), { src: 'https://accounts.google.com/gsi/client', async: true });
  s.onload = () => resolve((window as unknown as { google: GoogleIdentity }).google);
  s.onerror = () => { gisLoad = undefined; reject(new Error('Could not reach Google sign-in. Check your internet connection and try again.')); };
  document.head.appendChild(s);
});

let token: { value: string; expires: number } | undefined;

/** Access token for the Sheets API — asks the admin to approve once, then reuses it until it expires. */
async function accessToken(): Promise<string> {
  if (!isGoogleConfigured()) {
    throw new Error('Google Sheets is not set up yet: add googleOAuthClientId to src/environments/environment.ts (see the comment there).');
  }
  if (token && token.expires > Date.now() + 30_000) return token.value;
  const google = await loadGoogleIdentity();
  return new Promise<string>((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: environment.googleOAuthClientId,
      scope: SCOPE,
      callback: r => {
        if (!r.access_token) return reject(new Error(r.error_description || 'Google sign-in was not completed.'));
        token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: e => reject(new Error(e.type === 'popup_closed' ? 'Google sign-in was cancelled.' : e.type === 'popup_failed_to_open'
        ? 'The Google sign-in window was blocked — allow pop-ups for this site and try again.' : (e.message || 'Google sign-in failed.'))),
    }).requestAccessToken();
  });
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(API + path, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.ok) return res.json() as Promise<T>;
  if (res.status === 401) token = undefined;
  const msg = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
  if (res.status === 404) throw new Error('That Google Sheet was not found. Check the link.');
  if (res.status === 403) throw new Error(`Google says you don't have access to this sheet${msg ? ` (${msg})` : ''}. Open it with the Google account you signed in with.`);
  throw new Error(msg || `Google Sheets request failed (${res.status}).`);
}

/* ======================= template / export ======================= */

type Json = Record<string, unknown>;

const rgb = (hex: string) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });
const colLetter = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const px = (chars: number) => Math.round(chars * 7 + 10);
/** Days since 1899-12-30 — Sheets' date serial. */
const serial = (iso: string) => Math.round(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') / 86_400_000) + 25569;

interface CellOpts { bold?: boolean; size?: number; color?: string; bg?: string; wrap?: boolean; note?: string; date?: boolean; italic?: boolean; border?: boolean }
function cell(v: CellValue | undefined, o: CellOpts = {}): Json {
  const c: Json = {};
  if (v instanceof Date) v = v.toISOString().slice(0, 10);
  if (typeof v === 'number') c['userEnteredValue'] = { numberValue: v };
  else if (typeof v === 'boolean') c['userEnteredValue'] = { boolValue: v };
  else if (typeof v === 'string' && v !== '') c['userEnteredValue'] = { stringValue: v };
  const f: Json = {};
  if (o.bold || o.size || o.color || o.italic) {
    f['textFormat'] = { ...(o.bold ? { bold: true } : {}), ...(o.italic ? { italic: true } : {}), ...(o.size ? { fontSize: o.size } : {}),
      ...(o.color ? { foregroundColor: rgb(o.color) } : {}) };
  }
  if (o.bg) f['backgroundColor'] = rgb(o.bg);
  if (o.wrap) { f['wrapStrategy'] = 'WRAP'; f['verticalAlignment'] = 'TOP'; }
  if (o.date) f['numberFormat'] = { type: 'DATE', pattern: 'yyyy-mm-dd' };
  if (o.border) f['borders'] = { bottom: { style: 'SOLID', color: rgb(BORDER) } };
  if (Object.keys(f).length) c['userEnteredFormat'] = f;
  if (o.note) c['note'] = o.note;
  return c;
}
const row = (cells: Json[]) => ({ values: cells });

/**
 * Creates a spreadsheet in the admin's Google Drive and returns its link.
 * Sheet 1 "Properties": row 1 says for every column whether it is required and what it is for, row 2 is the header,
 * data starts on row 3. Plus "Instructions" and "Lists" (dropdown sources).
 * Pass `records` to pre-fill one row per property (bulk update: create → edit → load back).
 */
export async function createSpreadsheet(ctx: ImportContext, title: string, records: PropertyRecord[] = []): Promise<{ id: string; url: string }> {
  const dataRows = Math.max(TEMPLATE_ROWS, records.length + 200);
  const lastRow = FIRST_DATA_ROW - 1 + dataRows;

  const lists = buildLists(ctx);
  const listRanges = {} as Record<ListName, string>;
  lists.forEach((l, i) => {
    const L = colLetter(i * 3);
    listRanges[l.name] = `=Lists!$${L}$2:$${L}$${Math.max(2, l.values.length + 1)}`;
  });

  const guide = row(COLUMNS.map(c => {
    const s = NEED_STYLE[c.need];
    return cell(`${NEED_LABEL[c.need].toUpperCase()}\n${c.purpose}`, { size: 9, color: s.font, bg: s.fill, wrap: true, border: true });
  }));
  const header = row(COLUMNS.map(c => cell(headerText(c), {
    bold: true, size: 10, color: WHITE, bg: c.need === 'info' ? GRAY : NAVY, wrap: true,
    note: `${c.header} — ${NEED_LABEL[c.need]}\n\n${c.purpose}\n\nAllowed: ${c.allowed}\nExample: ${c.example}`,
  })));
  const body = records.map(r => {
    const cells = recordToCells(r, ctx);
    return row(COLUMNS.map(c => {
      const v = cells[c.key];
      const isDate = c.kind === 'date' && typeof v === 'string' && v !== '';
      return cell(isDate ? serial(v as string) : v, { date: isDate, italic: c.key === 'status', color: c.key === 'status' ? GRAY : undefined, wrap: c.key === 'photoUrls' || c.key === 'description' });
    }));
  });

  const created = await call<{ spreadsheetId: string; spreadsheetUrl: string }>('', {
    method: 'POST',
    body: {
      properties: { title },
      sheets: [
        { properties: { sheetId: SHEET_ID.properties, title: SHEET, gridProperties: { rowCount: lastRow, columnCount: COLUMNS.length, frozenRowCount: HEADER_ROW, frozenColumnCount: 1 } },
          data: [{ startRow: 0, startColumn: 0, rowData: [guide, header, ...body] }] },
        { properties: { sheetId: SHEET_ID.instructions, title: 'Instructions', gridProperties: { rowCount: 120, columnCount: 5 } },
          data: [{ startRow: 0, startColumn: 0, rowData: instructionRows(ctx) }] },
        { properties: { sheetId: SHEET_ID.lists, title: 'Lists', gridProperties: { rowCount: Math.max(30, ...lists.map(l => l.values.length + 2)), columnCount: lists.length * 3, frozenRowCount: 1 } },
          data: [{ startRow: 0, startColumn: 0, rowData: listRows(lists) }] },
      ],
    },
  });

  const id = created.spreadsheetId;
  const gridOf = (sheetId: number, r0: number, r1: number, c0: number, c1: number) => ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const dims = (sheetId: number, dimension: 'ROWS' | 'COLUMNS', start: number, end: number, pixelSize: number) =>
    ({ updateDimensionProperties: { range: { sheetId, dimension, startIndex: start, endIndex: end }, properties: { pixelSize }, fields: 'pixelSize' } });

  const requests: Json[] = [
    ...COLUMNS.map((c, j) => dims(SHEET_ID.properties, 'COLUMNS', j, j + 1, px(c.width))),
    dims(SHEET_ID.properties, 'ROWS', GUIDE_ROW - 1, GUIDE_ROW, 150),
    dims(SHEET_ID.properties, 'ROWS', HEADER_ROW - 1, HEADER_ROW, 40),
    { setBasicFilter: { filter: { range: gridOf(SHEET_ID.properties, HEADER_ROW - 1, lastRow, 0, COLUMNS.length) } } },
    ...[26, 24, 70, 40, 28].map((w, i) => dims(SHEET_ID.instructions, 'COLUMNS', i, i + 1, px(w))),
    ...lists.flatMap((l, i) => [dims(SHEET_ID.lists, 'COLUMNS', i * 3, i * 3 + 1, px(Math.max(14, ...l.values.map(v => v.length + 2)))),
      ...(l.extra ? [dims(SHEET_ID.lists, 'COLUMNS', i * 3 + 1, i * 3 + 2, px(18))] : [])]),
  ];
  COLUMNS.forEach((c, j) => {
    const range = gridOf(SHEET_ID.properties, FIRST_DATA_ROW - 1, lastRow, j, j + 1);
    const fmt: Json = {}; const fields: string[] = [];
    if (c.kind === 'date') { fmt['numberFormat'] = { type: 'DATE', pattern: 'yyyy-mm-dd' }; fields.push('userEnteredFormat.numberFormat'); }
    if (['propertyId', 'tower', 'flatNo', 'ownerPhone'].includes(c.key)) {   // keep leading zeros / long numbers as text
      fmt['numberFormat'] = { type: 'TEXT' }; fields.push('userEnteredFormat.numberFormat');
    }
    if (['description', 'photoUrls'].includes(c.key)) { fmt['wrapStrategy'] = 'WRAP'; fmt['verticalAlignment'] = 'TOP'; fields.push('userEnteredFormat.wrapStrategy', 'userEnteredFormat.verticalAlignment'); }
    if (fields.length) requests.push({ repeatCell: { range, cell: { userEnteredFormat: fmt }, fields: fields.join(',') } });
    const rule = validationFor(c, listRanges, j);
    if (rule) requests.push({ setDataValidation: { range, rule } });
  });
  await call(`/${id}:batchUpdate`, { method: 'POST', body: { requests } });

  return { id, url: created.spreadsheetUrl };
}

interface ListCol { name: ListName; title: string; values: string[]; extra?: { title: string; values: string[] } }
function buildLists(ctx: ImportContext): ListCol[] {
  const cols: ListCol[] = [
    { name: 'societies', title: 'Society', values: ctx.societies.map(societyOption), extra: { title: 'Locality', values: ctx.societies.map(s => s.locality) } },
    { name: 'sources', title: 'Source', values: ctx.sources.map(sourceOption) },
    { name: 'furnishing', title: 'Furnishing', values: FURNISHINGS },
    { name: 'facing', title: 'Facing', values: FACINGS },
    { name: 'tenantType', title: 'Tenants', values: TENANT_TYPES },
    { name: 'yesNo', title: 'Yes / No', values: ['Yes', 'No'] },
    { name: 'authStatus', title: 'Authorization', values: [...AUTH_STATUSES] },
    { name: 'authMethod', title: 'Authorization Method', values: Object.keys(AUTH_METHODS) },
  ];
  return cols.map(l => ({ ...l, values: l.values.length ? l.values : ['—'] }));
}

/** Each list takes 3 columns: values, optional extra, blank spacer. */
function listRows(lists: ListCol[]): Json[] {
  const depth = Math.max(...lists.map(l => l.values.length)) + 1;
  const head = { bold: true, color: WHITE, bg: NAVY };
  const out: Json[] = [];
  for (let r = 0; r < depth; r++) {
    const cells: Json[] = [];
    for (const l of lists) {
      if (r === 0) cells.push(cell(l.title, head), l.extra ? cell(l.extra.title, head) : cell(undefined), cell(undefined));
      else cells.push(cell(l.values[r - 1]), cell(l.extra?.values[r - 1]), cell(undefined));
    }
    out.push(row(cells));
  }
  return out;
}

function validationFor(c: ColumnDef, lists: Record<ListName, string>, colIndex: number): Json | undefined {
  const base = { strict: false, showCustomUi: true, inputMessage: `${NEED_LABEL[c.need]}. ${c.allowed}`.slice(0, 250) };
  const between = (a: number, b: number): Json => ({ ...base, condition: { type: 'NUMBER_BETWEEN', values: [{ userEnteredValue: String(a) }, { userEnteredValue: String(b) }] } });
  if (c.list) return { ...base, condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: lists[c.list] }] } };
  switch (c.key) {
    case 'bhk': return between(1, 5);
    case 'floor': return between(0, 100);
    case 'totalFloors': return between(1, 100);
    case 'areaSqft': return between(200, 20000);
    case 'rent': return between(1000, 1000000);
    case 'maintenance': return between(0, 200000);
    case 'depositMonths': return between(1, 12);
    case 'sourceSharePct': return between(0, 100);
    case 'minAcceptableRent': return between(1000, 1000000);
    case 'ownerPhone': return { ...base, condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=LEN(${colLetter(colIndex)}${FIRST_DATA_ROW})=10` }] } };
    default: return c.kind === 'date' ? { ...base, condition: { type: 'DATE_IS_VALID' } } : undefined;
  }
}

function instructionRows(ctx: ImportContext): Json[] {
  const h = { bold: true, size: 12, color: NAVY };
  const steps = [
    'How to use this sheet',
    `1. Fill one row per flat on the "${SHEET}" tab, starting at row ${FIRST_DATA_ROW}. Do not change rows 1–2 or rename the columns.`,
    '2. NEW property: leave "Property ID" blank and fill every column marked * (red in row 1).',
    '3. UPDATE a property: put its Property ID (e.g. FF-001245) and fill ONLY the cells you want to change — blank cells keep their current value.',
    '   Tip: in BHP Admin use "Current properties" to get a sheet already filled in, edit it, and load it back.',
    '4. Use the dropdowns for Society, Source and the other list columns (values are on the "Lists" tab).',
    '5. In BHP Admin → Properties → Bulk import, paste this sheet\'s link and click Load. You will see a preview with any errors before anything is saved.',
    '',
    'Rules',
    '• New properties are saved as drafts (or submitted for verification if you choose) — nothing goes live without verification and a manager\'s approval.',
    '• A rent change on a live listing is sent to Approvals; the public price changes only after a manager approves it.',
    '• Society and Source can\'t be changed on an existing property. Closed (rented) listings can\'t be edited.',
    '• An owner with the same mobile number is linked automatically instead of being created twice.',
    '• Rows that look like an existing flat are flagged as possible duplicates and need your confirmation.',
    `• Up to ${MAX_ROWS} rows per sheet. Dates: YYYY-MM-DD or DD-MM-YYYY.`,
    ctx.canSetCommercial ? '• Commercial columns (brokerage, source share, negotiation floor) are restricted — do not share this sheet outside BHP.'
      : '• Commercial columns are ignored for your role — the source\'s agreed defaults are applied.',
  ];
  const rows: Json[] = [row([cell('BHP — Bulk property import', { bold: true, size: 16, color: NAVY })]), row([])];
  steps.forEach(s => rows.push(row([cell(s, s === 'How to use this sheet' || s === 'Rules' ? h : {})])));
  rows.push(row([]), row([cell('Columns', h)]));
  rows.push(row(['Column', 'Required?', 'What it is for', 'Allowed values', 'Example'].map(t => cell(t, { bold: true, color: WHITE, bg: NAVY }))));
  COLUMNS.forEach(c => {
    const s = NEED_STYLE[c.need];
    rows.push(row([cell(headerText(c), { wrap: true }), cell(NEED_LABEL[c.need], { bold: true, color: s.font, bg: s.fill, wrap: true }),
      cell(c.purpose, { wrap: true }), cell(c.allowed, { wrap: true }), cell(c.example, { wrap: true })]));
  });
  return rows;
}

/* ======================= load ======================= */

export interface ReadResult { title: string; rows: RawRow[]; unknownHeaders: string[]; missingHeaders: string[]; }

/** Accepts a full Google Sheets link or a bare spreadsheet ID. */
export function parseSheetId(input: string): string | null {
  const s = input.trim();
  return /\/spreadsheets\/d\/([\w-]{20,})/.exec(s)?.[1] ?? (/^[\w-]{20,}$/.test(s) ? s : null);
}

type GridValue = string | number | boolean | null | undefined;

export async function readSpreadsheet(linkOrId: string): Promise<ReadResult> {
  const id = parseSheetId(linkOrId);
  if (!id) throw new Error('That does not look like a Google Sheets link. Copy it from the browser address bar (docs.google.com/spreadsheets/d/…).');

  const meta = await call<{ properties: { title: string }; sheets: { properties: { title: string; hidden?: boolean } }[] }>(
    `/${id}?fields=properties.title,sheets.properties(title,hidden)`);
  const tab = meta.sheets.find(s => s.properties.title === SHEET)
    ?? meta.sheets.find(s => !s.properties.hidden && !['Lists', 'Instructions'].includes(s.properties.title));
  if (!tab) throw new Error(`No "${SHEET}" tab found in this Google Sheet.`);

  const range = encodeURIComponent(`'${tab.properties.title.replace(/'/g, "''")}'`);
  const data = await call<{ values?: GridValue[][] }>(`/${id}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
  const grid = data.values ?? [];

  const headerIdx = findHeaderRow(grid);
  if (headerIdx < 0) throw new Error('Could not find the header row (Property ID, Society, Tower / Block…). Use the BHP template.');

  const colKey = new Map<number, ColKey>();
  const unknownHeaders: string[] = [];
  grid[headerIdx].forEach((v, col) => {
    const text = String(v ?? '').trim(); if (!text) return;
    const key = HEADER_INDEX.get(normHeader(text));
    if (key && key !== 'status') colKey.set(col, key);
    else if (!key) unknownHeaders.push(text);
  });
  const present = new Set(colKey.values());
  const missingHeaders = COLUMNS.filter(c => c.need === 'new' && !present.has(c.key)).map(c => c.header);

  const rows: RawRow[] = [];
  const last = Math.min(grid.length - 1, headerIdx + MAX_ROWS * 3);
  for (let n = headerIdx + 1; n <= last; n++) {
    const cells: RawRow['cells'] = {};
    let filled = false;
    colKey.forEach((key, col) => {
      const v = grid[n]?.[col];
      if (v !== null && v !== undefined && !(typeof v === 'string' && !v.trim())) { cells[key] = v; filled = true; }
    });
    if (!filled) continue;
    rows.push({ rowNo: n + 1, cells });
    if (rows.length > MAX_ROWS) throw new Error(`Too many rows — the limit is ${MAX_ROWS} per sheet. Split it into smaller sheets.`);
  }
  return { title: meta.properties.title, rows, unknownHeaders, missingHeaders };
}

/** The header is the first row (of the first 6) where at least 3 cells are known column names. */
function findHeaderRow(grid: GridValue[][]): number {
  for (let n = 0; n < Math.min(6, grid.length); n++) {
    if ((grid[n] ?? []).filter(v => HEADER_INDEX.has(normHeader(String(v ?? '')))).length >= 3) return n;
  }
  return -1;
}
