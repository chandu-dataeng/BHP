/**
 * Excel I/O for bulk property import — builds the template workbook and reads an uploaded one into RawRows.
 * ExcelJS is loaded on demand so it only ships to staff who open the import screen.
 */
import type { Workbook, Worksheet, CellValue as XlCell, Fill, Font } from 'exceljs';
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

const loadExcel = async () => {
  const m = await import('exceljs');
  return (m as unknown as { default?: typeof m }).default ?? m;   // CommonJS bundle: the API sits on `default`
};

const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const NEED_STYLE: Record<Need, { fill: string; font: string }> = {
  key:  { fill: 'FFDCE8FF', font: 'FF0B3D91' },
  new:  { fill: 'FFFDE2E1', font: 'FF9B1C1C' },
  cond: { fill: 'FFFFF1D6', font: 'FF8A5600' },
  opt:  { fill: 'FFF1F3F5', font: 'FF4A5568' },
  info: { fill: 'FFE9ECEF', font: 'FF6B7280' },
};
const headerText = (c: ColumnDef) => c.header + (c.need === 'new' ? ' *' : c.need === 'cond' ? ' (*)' : '');

/* ======================= template / export ======================= */

/**
 * Sheet 1 "Properties": row 1 says for every column whether it is required and what it is for, row 2 is the header,
 * data starts on row 3. Plus "Instructions" and "Lists" (dropdown sources).
 * Pass `records` to pre-fill one row per property (bulk update: download → edit → upload).
 */
export async function buildWorkbook(ctx: ImportContext, records: PropertyRecord[] = []): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BHP Admin';
  wb.created = new Date();

  const ws = wb.addWorksheet(SHEET, { views: [{ state: 'frozen', xSplit: 1, ySplit: HEADER_ROW, zoomScale: 90 }] });
  const lists = addListsSheet(wb, ctx);
  addInstructionsSheet(wb, ctx);

  ws.columns = COLUMNS.map(c => ({ key: c.key, width: c.width }));

  const guide = ws.getRow(GUIDE_ROW);
  const head = ws.getRow(HEADER_ROW);
  COLUMNS.forEach((c, i) => {
    const s = NEED_STYLE[c.need];
    const g = guide.getCell(i + 1);
    g.value = `${NEED_LABEL[c.need].toUpperCase()}\n${c.purpose}`;
    g.fill = solid(s.fill);
    g.font = { size: 9, color: { argb: s.font }, bold: false };
    g.alignment = { wrapText: true, vertical: 'top' };
    g.border = { bottom: { style: 'thin', color: { argb: 'FFCBD2DC' } }, right: { style: 'hair', color: { argb: 'FFCBD2DC' } } };

    const h = head.getCell(i + 1);
    h.value = headerText(c);
    h.fill = solid(c.need === 'info' ? 'FF6B7280' : 'FF0C2A4C');
    h.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 } as Partial<Font>;
    h.alignment = { vertical: 'middle', wrapText: true };
    h.note = `${c.header} — ${NEED_LABEL[c.need]}\n\n${c.purpose}\n\nAllowed: ${c.allowed}\nExample: ${c.example}`;
  });
  guide.height = 118;
  head.height = 30;
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: COLUMNS.length } };

  records.forEach((r, i) => {
    const cells = recordToCells(r, ctx);
    const row = ws.getRow(FIRST_DATA_ROW + i);
    COLUMNS.forEach((c, j) => {
      const v = cells[c.key];
      row.getCell(j + 1).value = c.kind === 'date' && typeof v === 'string' ? new Date(v.slice(0, 10) + 'T00:00:00Z') : v;
    });
    row.getCell(COLUMNS.findIndex(c => c.key === 'status') + 1).font = { italic: true, color: { argb: 'FF6B7280' } };
  });

  const lastRow = FIRST_DATA_ROW + Math.max(TEMPLATE_ROWS, records.length + 200) - 1;
  COLUMNS.forEach((c, j) => {
    const col = ws.getColumn(j + 1);
    const letter = col.letter;
    const range = `${letter}${FIRST_DATA_ROW}:${letter}${lastRow}`;
    if (c.kind === 'date') col.numFmt = 'yyyy-mm-dd';
    if (['propertyId', 'tower', 'flatNo', 'ownerPhone'].includes(c.key)) col.numFmt = '@';   // keep leading zeros / long numbers as text
    if (['description', 'photoUrls'].includes(c.key)) col.alignment = { wrapText: true, vertical: 'top' };
    const v = validationFor(c, lists);
    // ExcelJS supports range addresses here, though the typings don't declare `dataValidations`
    if (v) (ws as unknown as { dataValidations: { add(a: string, v: object): void } }).dataValidations.add(range, v);
  });
  // re-apply row 1/2 formats the column formats above would otherwise override
  [GUIDE_ROW, HEADER_ROW].forEach(n => ws.getRow(n).eachCell(cell => { cell.numFmt = 'General'; }));

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

type ListRanges = Record<ListName, string>;

function addListsSheet(wb: Workbook, ctx: ImportContext): ListRanges {
  const ws = wb.addWorksheet('Lists', { views: [{ state: 'frozen', ySplit: 1 }] });
  const cols: { name: ListName; title: string; values: string[]; extra?: { title: string; values: string[] } }[] = [
    { name: 'societies', title: 'Society', values: ctx.societies.map(societyOption),
      extra: { title: 'Locality', values: ctx.societies.map(s => s.locality) } },
    { name: 'sources', title: 'Source', values: ctx.sources.map(sourceOption) },
    { name: 'furnishing', title: 'Furnishing', values: FURNISHINGS },
    { name: 'facing', title: 'Facing', values: FACINGS },
    { name: 'tenantType', title: 'Tenants', values: TENANT_TYPES },
    { name: 'yesNo', title: 'Yes / No', values: ['Yes', 'No'] },
    { name: 'authStatus', title: 'Authorization', values: [...AUTH_STATUSES] },
    { name: 'authMethod', title: 'Authorization Method', values: Object.keys(AUTH_METHODS) },
  ];
  const ranges = {} as ListRanges;
  let col = 1;
  for (const c of cols) {
    const put = (title: string, values: string[], at: number, width: number) => {
      const h = ws.getCell(1, at);
      h.value = title; h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.fill = solid('FF0C2A4C');
      values.forEach((v, i) => { ws.getCell(i + 2, at).value = v; });
      ws.getColumn(at).width = width;
    };
    put(c.title, c.values.length ? c.values : ['—'], col, Math.max(14, ...c.values.map(v => v.length + 2)));
    const letter = ws.getColumn(col).letter;
    ranges[c.name] = `Lists!$${letter}$2:$${letter}$${Math.max(2, c.values.length + 1)}`;
    if (c.extra) { col++; put(c.extra.title, c.extra.values, col, 18); }
    col += 2;   // blank spacer column
  }
  return ranges;
}

function validationFor(c: ColumnDef, lists: ListRanges): object | undefined {
  const base = { allowBlank: true, showErrorMessage: true, errorStyle: 'warning', errorTitle: c.header, error: `Allowed: ${c.allowed}`,
    showInputMessage: true, promptTitle: c.header.slice(0, 32), prompt: `${NEED_LABEL[c.need]}. ${c.allowed}`.slice(0, 250) };
  if (c.list) return { ...base, type: 'list', formulae: [lists[c.list]] };
  switch (c.key) {
    case 'bhk': return { ...base, type: 'whole', operator: 'between', formulae: [1, 5] };
    case 'floor': return { ...base, type: 'whole', operator: 'between', formulae: [0, 100] };
    case 'totalFloors': return { ...base, type: 'whole', operator: 'between', formulae: [1, 100] };
    case 'areaSqft': return { ...base, type: 'decimal', operator: 'between', formulae: [200, 20000] };
    case 'rent': return { ...base, type: 'decimal', operator: 'between', formulae: [1000, 1000000] };
    case 'maintenance': return { ...base, type: 'decimal', operator: 'between', formulae: [0, 200000] };
    case 'depositMonths': return { ...base, type: 'decimal', operator: 'between', formulae: [1, 12] };
    case 'sourceSharePct': return { ...base, type: 'decimal', operator: 'between', formulae: [0, 100] };
    case 'ownerPhone': return { ...base, type: 'textLength', operator: 'equal', formulae: [10] };
    default: return c.kind === 'date' ? { ...base, type: 'date', operator: 'greaterThan', formulae: [new Date(Date.UTC(2000, 0, 1))] } : undefined;
  }
}

function addInstructionsSheet(wb: Workbook, ctx: ImportContext) {
  const ws = wb.addWorksheet('Instructions');
  ws.columns = [{ width: 26 }, { width: 24 }, { width: 70 }, { width: 40 }, { width: 28 }];
  const title = ws.getCell('A1');
  title.value = 'BHP — Bulk property import';
  title.font = { bold: true, size: 16, color: { argb: 'FF0C2A4C' } };

  const steps = [
    'How to use this file',
    `1. Fill one row per flat on the "${SHEET}" sheet, starting at row ${FIRST_DATA_ROW}. Do not change rows 1–2 or rename the columns.`,
    '2. NEW property: leave "Property ID" blank and fill every column marked * (red in row 1).',
    '3. UPDATE a property: put its Property ID (e.g. FF-001245) and fill ONLY the cells you want to change — blank cells keep their current value.',
    '   Tip: in BHP Admin use "Download current properties" to get a sheet already filled in, edit it, and upload it back.',
    '4. Use the dropdowns for Society, Source and the other list columns (values are on the "Lists" sheet).',
    '5. Upload the file on Admin → Properties → Bulk import. You will see a preview with any errors before anything is saved.',
    '',
    'Rules',
    '• New properties are saved as drafts (or submitted for verification if you choose) — nothing goes live without verification and a manager\'s approval.',
    '• A rent change on a live listing is sent to Approvals; the public price changes only after a manager approves it.',
    '• Society and Source can\'t be changed on an existing property. Closed (rented) listings can\'t be edited.',
    '• An owner with the same mobile number is linked automatically instead of being created twice.',
    '• Rows that look like an existing flat are flagged as possible duplicates and need your confirmation.',
    `• Up to ${MAX_ROWS} rows per file. Dates: YYYY-MM-DD or DD-MM-YYYY.`,
    ctx.canSetCommercial ? '• Commercial columns (brokerage, source share, negotiation floor) are restricted — keep this file confidential.'
      : '• Commercial columns are ignored for your role — the source\'s agreed defaults are applied.',
  ];
  steps.forEach((s, i) => {
    const cell = ws.getCell(3 + i, 1);
    cell.value = s;
    if (s === 'How to use this file' || s === 'Rules') cell.font = { bold: true, size: 12, color: { argb: 'FF0C2A4C' } };
  });

  const start = 3 + steps.length + 2;
  ws.getCell(start - 1, 1).value = 'Columns';
  ws.getCell(start - 1, 1).font = { bold: true, size: 12, color: { argb: 'FF0C2A4C' } };
  const head = ws.getRow(start);
  ['Column', 'Required?', 'What it is for', 'Allowed values', 'Example'].forEach((t, i) => {
    const c = head.getCell(i + 1);
    c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = solid('FF0C2A4C');
  });
  COLUMNS.forEach((c, i) => {
    const row = ws.getRow(start + 1 + i);
    row.values = [headerText(c), NEED_LABEL[c.need], c.purpose, c.allowed, c.example];
    const s = NEED_STYLE[c.need];
    row.getCell(2).fill = solid(s.fill);
    row.getCell(2).font = { bold: true, color: { argb: s.font } };
    row.eachCell(cell => { cell.alignment = { wrapText: true, vertical: 'top' }; });
  });
}

/* ======================= upload ======================= */

export interface ReadResult { rows: RawRow[]; unknownHeaders: string[]; missingHeaders: string[]; }

export async function readWorkbook(file: File): Promise<ReadResult> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('This file could not be read. Save it as an Excel workbook (.xlsx) and try again.');
  }
  const ws = wb.getWorksheet(SHEET) ?? wb.worksheets.find(w => w.state !== 'hidden' && w.name !== 'Lists' && w.name !== 'Instructions');
  if (!ws) throw new Error(`No "${SHEET}" sheet found in this workbook.`);

  const headerRowNo = findHeaderRow(ws);
  if (!headerRowNo) throw new Error('Could not find the header row (Property ID, Society, Tower / Block…). Use the BHP template.');

  const colKey = new Map<number, ColKey>();
  const unknownHeaders: string[] = [];
  ws.getRow(headerRowNo).eachCell((cell, col) => {
    const text = String(plain(cell.value) ?? '').trim(); if (!text) return;
    const key = HEADER_INDEX.get(normHeader(text));
    if (key && key !== 'status') colKey.set(col, key);
    else if (!key) unknownHeaders.push(text);
  });
  const present = new Set(colKey.values());
  const missingHeaders = COLUMNS.filter(c => c.need === 'new' && !present.has(c.key)).map(c => c.header);

  const rows: RawRow[] = [];
  const last = Math.min(ws.rowCount, headerRowNo + MAX_ROWS * 3);
  for (let n = headerRowNo + 1; n <= last; n++) {
    const row = ws.getRow(n);
    const cells: RawRow['cells'] = {};
    let filled = false;
    colKey.forEach((key, col) => {
      const v = plain(row.getCell(col).value);
      if (v !== null && !(typeof v === 'string' && !v.trim())) { cells[key] = v; filled = true; }
    });
    if (!filled) continue;
    rows.push({ rowNo: n, cells });
    if (rows.length > MAX_ROWS) throw new Error(`Too many rows — the limit is ${MAX_ROWS} per file. Split it into smaller files.`);
  }
  return { rows, unknownHeaders, missingHeaders };
}

/** The header is the first row (of the first 6) where at least 3 cells are known column names. */
function findHeaderRow(ws: Worksheet): number | null {
  for (let n = 1; n <= 6; n++) {
    let hits = 0;
    ws.getRow(n).eachCell(cell => { if (HEADER_INDEX.has(normHeader(String(plain(cell.value) ?? '')))) hits++; });
    if (hits >= 3) return n;
  }
  return null;
}

/** ExcelJS cell → plain value (formulas → result, rich text / hyperlinks → text). */
function plain(v: XlCell): CellValue {
  if (v == null) return null;
  if (v instanceof Date || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map(t => t.text).join('');
    if ('result' in v) return plain((v.result ?? null) as XlCell);
    if ('hyperlink' in v) return typeof v.text === 'string' ? v.text : v.hyperlink;
    if ('error' in v) return null;
  }
  return String(v);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
