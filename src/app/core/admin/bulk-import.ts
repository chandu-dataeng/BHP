/**
 * Bulk create / update of properties from a spreadsheet — column contract + row validation.
 * Pure logic (no spreadsheet library): the admin screen reads the Google Sheet into `RawRow`s, this file decides what
 * each row means, and AdminService.bulkImport() applies the result (and re-checks permissions, like the API must).
 */
import { Facing, Furnishing, Society, TenantType } from '../models/rent.models';
import { CommercialTerms, Owner, OwnerAuthorization, PropertyRecord, Source, STATUS_LABEL } from './admin.models';
import { DuplicateMatch } from './duplicates';
import type { NewPropertyInput } from './admin.service';

/* ======================= column contract ======================= */

export type ColKey =
  | 'propertyId' | 'society' | 'tower' | 'flatNo' | 'bhk' | 'areaSqft' | 'floor' | 'totalFloors'
  | 'rent' | 'maintenance' | 'depositMonths' | 'availableFrom' | 'furnishing' | 'facing' | 'tenantType' | 'parking'
  | 'petsAllowed' | 'description' | 'photoUrls' | 'source' | 'ownerName' | 'ownerPhone'
  | 'authStatus' | 'authMethod' | 'authValidTill'
  | 'tenantBrokerage' | 'ownerBrokerage' | 'sourceSharePct' | 'minAcceptableRent' | 'status';

/** key → required for every row · new → required when creating · cond → required in some cases · opt → optional · info → read-only */
export type Need = 'key' | 'new' | 'cond' | 'opt' | 'info';

export type ListName = 'societies' | 'sources' | 'furnishing' | 'facing' | 'tenantType' | 'yesNo' | 'authStatus' | 'authMethod';

export interface ColumnDef {
  key: ColKey;
  header: string;
  need: Need;
  purpose: string;
  allowed: string;
  example: string;
  kind: 'text' | 'int' | 'number' | 'date' | 'list';
  list?: ListName;
  width: number;
}

export const FURNISHINGS: Furnishing[] = ['Furnished', 'Semi Furnished', 'Unfurnished'];
export const FACINGS: Facing[] = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
export const TENANT_TYPES: TenantType[] = ['Both Allowed', 'Family Only', 'Bachelors Only'];
export const AUTH_STATUSES = ['Pending', 'Received'] as const;
export const AUTH_METHODS: Record<string, NonNullable<OwnerAuthorization['method']>> = {
  'Written': 'written', 'WhatsApp': 'whatsapp', 'Recorded call': 'call-recorded', 'Listing agreement': 'agreement',
};

export const COLUMNS: ColumnDef[] = [
  { key: 'propertyId', header: 'Property ID', need: 'key', kind: 'text', width: 14, example: 'FF-001245',
    purpose: 'Leave BLANK to create a new property. Enter an existing BHP Property ID to update that property.',
    allowed: 'Blank, or an existing ID like FF-001245' },
  { key: 'society', header: 'Society', need: 'new', kind: 'list', list: 'societies', width: 24, example: 'Lakeview Heights',
    purpose: 'Society the flat is in. Pick from the dropdown. Cannot be changed on update.', allowed: 'A society from the Lists sheet' },
  { key: 'tower', header: 'Tower / Block', need: 'new', kind: 'text', width: 12, example: 'B', purpose: 'Tower or block name/number.', allowed: 'Text' },
  { key: 'flatNo', header: 'Flat No', need: 'new', kind: 'text', width: 10, example: '902', purpose: 'Flat / door number.', allowed: 'Text' },
  { key: 'bhk', header: 'BHK', need: 'new', kind: 'int', width: 7, example: '3', purpose: 'Number of bedrooms.', allowed: 'Whole number 1–5' },
  { key: 'areaSqft', header: 'Area (sq.ft)', need: 'new', kind: 'number', width: 11, example: '1560', purpose: 'Carpet / super built-up area in sq.ft.', allowed: 'Number 200–20,000' },
  { key: 'floor', header: 'Floor', need: 'opt', kind: 'int', width: 7, example: '9', purpose: 'Floor the flat is on (0 = ground). Default 1.', allowed: 'Whole number 0–100' },
  { key: 'totalFloors', header: 'Total Floors', need: 'opt', kind: 'int', width: 10, example: '14', purpose: 'Floors in the tower. Default 14.', allowed: 'Whole number ≥ Floor' },
  { key: 'rent', header: 'Rent / month', need: 'new', kind: 'number', width: 12, example: '48000',
    purpose: 'Monthly rent in ₹. On a live listing a change is sent to a manager for approval.', allowed: '₹1,000 – ₹10,00,000' },
  { key: 'maintenance', header: 'Maintenance / month', need: 'new', kind: 'number', width: 13, example: '4500', purpose: 'Monthly maintenance in ₹ (0 if included in rent).', allowed: 'Number ≥ 0' },
  { key: 'depositMonths', header: 'Deposit (months)', need: 'new', kind: 'number', width: 11, example: '2', purpose: 'Security deposit as months of rent.', allowed: 'Number 1–12' },
  { key: 'availableFrom', header: 'Available From', need: 'opt', kind: 'date', width: 13, example: '2026-12-01', purpose: 'Move-in date. Default today.', allowed: 'Date (YYYY-MM-DD or DD-MM-YYYY)' },
  { key: 'furnishing', header: 'Furnishing', need: 'opt', kind: 'list', list: 'furnishing', width: 15, example: 'Semi Furnished', purpose: 'Default Semi Furnished.', allowed: FURNISHINGS.join(' / ') },
  { key: 'facing', header: 'Facing', need: 'opt', kind: 'list', list: 'facing', width: 12, example: 'East', purpose: 'Main door facing. Default East.', allowed: FACINGS.join(' / ') },
  { key: 'tenantType', header: 'Tenants', need: 'opt', kind: 'list', list: 'tenantType', width: 14, example: 'Family Only', purpose: 'Who can rent. Default Both Allowed.', allowed: TENANT_TYPES.join(' / ') },
  { key: 'parking', header: 'Parking', need: 'opt', kind: 'text', width: 12, example: '1 Covered', purpose: 'Parking available. Default "1 Covered".', allowed: 'Text' },
  { key: 'petsAllowed', header: 'Pets Allowed', need: 'opt', kind: 'list', list: 'yesNo', width: 10, example: 'No', purpose: 'Default No.', allowed: 'Yes / No' },
  { key: 'description', header: 'Description', need: 'opt', kind: 'text', width: 30, example: 'Corner flat with lake view…', purpose: 'Listing text. A standard one is generated if blank.', allowed: 'Text (max 2000 characters)' },
  { key: 'photoUrls', header: 'Photo URLs', need: 'opt', kind: 'text', width: 30, example: 'https://…/1.jpg, https://…/2.jpg',
    purpose: 'Links to photos, separated by commas or new lines. At least 3 are needed before publishing. On update, replaces all photos.', allowed: 'https:// links' },
  { key: 'source', header: 'Source', need: 'new', kind: 'list', list: 'sources', width: 26, example: 'AGT-000087 | Ramesh Realty',
    purpose: 'Who brought this property (agent, owner direct, referral…). Pick from the dropdown. Cannot be changed on update. Ignored for agents (always your own).', allowed: 'A source from the Lists sheet' },
  { key: 'ownerName', header: 'Owner Name', need: 'new', kind: 'text', width: 18, example: 'Srinivas Rao', purpose: 'Owner\'s full name. Needed for verification.', allowed: 'Text, at least 2 letters' },
  { key: 'ownerPhone', header: 'Owner Mobile', need: 'new', kind: 'text', width: 13, example: '9876543210',
    purpose: 'Owner\'s 10-digit mobile. An existing owner with this number is linked automatically.', allowed: '10 digits starting 6–9' },
  { key: 'authStatus', header: 'Authorization', need: 'opt', kind: 'list', list: 'authStatus', width: 12, example: 'Pending',
    purpose: 'Has the owner authorised BHP to list it? Default Pending (the verifier will obtain it).', allowed: 'Pending / Received' },
  { key: 'authMethod', header: 'Authorization Method', need: 'cond', kind: 'list', list: 'authMethod', width: 16, example: 'WhatsApp',
    purpose: 'How the authorization was given. Required when Authorization is Received.', allowed: Object.keys(AUTH_METHODS).join(' / ') },
  { key: 'authValidTill', header: 'Authorization Valid Till', need: 'opt', kind: 'date', width: 14, example: '2027-02-28',
    purpose: 'Expiry of the authorization. Default 90 days from today when Received.', allowed: 'Future date' },
  { key: 'tenantBrokerage', header: 'Tenant Brokerage', need: 'opt', kind: 'text', width: 14, example: '15 days rent',
    purpose: 'RESTRICTED — only the business owner\'s role can set it; ignored for others. Default "15 days rent".', allowed: 'Text' },
  { key: 'ownerBrokerage', header: 'Owner Brokerage', need: 'opt', kind: 'text', width: 14, example: 'None', purpose: 'RESTRICTED — as above. Default "None".', allowed: 'Text' },
  { key: 'sourceSharePct', header: 'Source Share %', need: 'opt', kind: 'number', width: 10, example: '30', purpose: 'RESTRICTED — share of BHP brokerage paid to the source. Default from the source\'s agreement.', allowed: 'Number 0–100' },
  { key: 'minAcceptableRent', header: 'Negotiation Floor (rent)', need: 'opt', kind: 'number', width: 14, example: '45000', purpose: 'RESTRICTED — lowest rent the owner accepts. Default = Rent.', allowed: '₹ amount ≤ Rent' },
  { key: 'status', header: 'Current Status', need: 'info', kind: 'text', width: 16, example: 'Published',
    purpose: 'Read-only — filled in when you download current properties. Ignored on upload.', allowed: '—' },
];

export const NEED_LABEL: Record<Need, string> = {
  key: 'KEY — blank = new', new: 'REQUIRED for new rows', cond: 'CONDITIONAL', opt: 'Optional', info: 'Read-only',
};

/** "Society *" / "society" / "SOCIETY" all map to the same column — admins re-type headers. */
export const normHeader = (s: string) => s.toLowerCase().replace(/[*()\/%.\s_-]+/g, '');
export const HEADER_INDEX = new Map(COLUMNS.map(c => [normHeader(c.header), c.key]));

/** Society / source dropdown values — "ID | Name", so a pasted name or ID also matches. */
export const societyOption = (s: Society) => s.name;
export const sourceOption = (s: Source) => `${s.id} | ${s.name}`;

/* ======================= row validation ======================= */

export type CellValue = string | number | boolean | Date | null;
export type RawRow = { rowNo: number; cells: Partial<Record<ColKey, CellValue>> };

export interface PropertyPatch {
  tower?: string; flatNo?: string; bhk?: number; areaSqft?: number; floor?: number; totalFloors?: number;
  rent?: number; maintenance?: number; depositMonths?: number; availableFrom?: string;
  furnishing?: Furnishing; facing?: Facing; tenantType?: TenantType; parking?: string; petsAllowed?: boolean;
  description?: string; images?: string[];
  newOwner?: { name: string; phone: string };
  authorization?: OwnerAuthorization;
  commercial?: Partial<CommercialTerms>;
}

export type RowAction = 'create' | 'update' | 'unchanged' | 'error';

export interface ImportRow {
  rowNo: number;
  action: RowAction;
  propertyId?: string;
  /** One-line description of the flat for the preview table. */
  label: string;
  create?: NewPropertyInput;
  patch?: PropertyPatch;
  /** Human-readable changes for an update ("Rent ₹48,000 → ₹50,000"). */
  changes: string[];
  errors: string[];
  warnings: string[];
  duplicates: DuplicateMatch[];
}

export interface ImportContext {
  societies: Society[];
  sources: Source[];
  /** Records this user can see (redacted like everywhere else). */
  properties: PropertyRecord[];
  owners: Owner[];
  agentSourceId?: string;
  canCreate: boolean;
  canEdit: boolean;
  canSetOwner: boolean;
  canSetCommercial: boolean;
  checkDuplicates: (i: Pick<NewPropertyInput, 'societyId' | 'tower' | 'flatNo' | 'bhk' | 'areaSqft' | 'floor' | 'ownerId' | 'newOwner'>) => DuplicateMatch[];
  today?: Date;
}

const LIVE_STATUSES = ['published', 'suspended', 'pending_approval'];
const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
const DAY = 86_400_000;

/** Reads one row's cells. Every getter returns `undefined` for a blank cell and records an error for a bad one. */
class Reader {
  constructor(private cells: RawRow['cells'], readonly errors: string[]) {}

  private label(k: ColKey) { return COLUMNS.find(c => c.key === k)!.header; }

  raw(k: ColKey): CellValue | undefined {
    const v = this.cells[k];
    if (v == null) return undefined;
    if (typeof v === 'string' && !v.trim()) return undefined;
    return v;
  }
  has(k: ColKey) { return this.raw(k) !== undefined; }

  text(k: ColKey, max = 200): string | undefined {
    const v = this.raw(k); if (v === undefined) return undefined;
    const s = (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();
    if (s.length > max) { this.errors.push(`${this.label(k)}: too long (max ${max} characters).`); return undefined; }
    return s;
  }

  num(k: ColKey, min: number, max: number, int = false): number | undefined {
    const v = this.raw(k); if (v === undefined) return undefined;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[₹,\s]/g, '').replace(/k$/i, '000'));
    if (!Number.isFinite(n) || (int && !Number.isInteger(n)) || n < min || n > max) {
      this.errors.push(`${this.label(k)}: "${v}" is not valid — expected ${int ? 'a whole number' : 'a number'} from ${min.toLocaleString('en-IN')} to ${max.toLocaleString('en-IN')}.`);
      return undefined;
    }
    return n;
  }

  date(k: ColKey): string | undefined {
    const v = this.raw(k); if (v === undefined) return undefined;
    const d = toDate(v);
    if (!d) { this.errors.push(`${this.label(k)}: "${v}" is not a date — use YYYY-MM-DD or DD-MM-YYYY.`); return undefined; }
    return d;
  }

  pick<T extends string>(k: ColKey, options: readonly T[]): T | undefined {
    const v = this.text(k); if (v === undefined) return undefined;
    const hit = options.find(o => o.toLowerCase() === v.toLowerCase())
      ?? options.find(o => o.toLowerCase().replace(/[^a-z]/g, '') === v.toLowerCase().replace(/[^a-z]/g, ''));
    if (!hit) this.errors.push(`${this.label(k)}: "${v}" is not allowed — use one of ${options.join(', ')}.`);
    return hit;
  }

  yesNo(k: ColKey): boolean | undefined {
    const v = this.raw(k); if (v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (['yes', 'y', 'true', '1'].includes(s)) return true;
    if (['no', 'n', 'false', '0'].includes(s)) return false;
    this.errors.push(`${this.label(k)}: "${v}" — use Yes or No.`);
    return undefined;
  }
}

/** Sheet dates arrive as serial numbers (Google Sheets / Excel epoch), Date objects, or typed text. → YYYY-MM-DD */
export function toDate(v: CellValue): string | undefined {
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return undefined;
    return new Date(Math.round((v - 25569) * DAY)).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }   // Indian order: DD-MM-YYYY
  else return undefined;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : undefined;
}

function matchSociety(v: string, list: Society[]) {
  const s = v.toLowerCase();
  return list.find(x => x.id.toLowerCase() === s || x.name.toLowerCase() === s || societyOption(x).toLowerCase() === s);
}

function matchSource(v: string, list: Source[]) {
  const s = v.toLowerCase();
  const id = s.split('|')[0].trim();
  return list.find(x => x.id.toLowerCase() === id || sourceOption(x).toLowerCase() === s)
    ?? (list.filter(x => x.name.toLowerCase() === s).length === 1 ? list.find(x => x.name.toLowerCase() === s) : undefined);
}

function parsePhotos(v: string | undefined, errors: string[]): string[] | undefined {
  if (v === undefined) return undefined;
  const urls = v.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  const bad = urls.filter(u => !/^https?:\/\/\S+$/i.test(u));
  if (bad.length) { errors.push(`Photo URLs: ${bad.length} link(s) don't start with http(s):// — e.g. "${bad[0].slice(0, 40)}".`); return undefined; }
  if (urls.length > 30) { errors.push('Photo URLs: at most 30 photos.'); return undefined; }
  return urls;
}

const PHONE = /^[6-9]\d{9}$/;
const cleanPhone = (v: string) => v.replace(/[\s-]/g, '').replace(/^(\+?91)(?=[6-9]\d{9}$)/, '');

/** Validates every row of the sheet. Rows are independent except for duplicates *inside* the file. */
export function validateRows(rows: RawRow[], ctx: ImportContext): ImportRow[] {
  const seenUnits = new Map<string, number>();
  const seenIds = new Map<string, number>();
  return rows.map(row => {
    const r = validateRow(row, ctx);
    // the same flat twice in one file, or the same property updated twice → the later row is an error
    const unit = r.create ? `${r.create.societyId}|${r.create.tower.toUpperCase()}|${r.create.flatNo.toUpperCase()}` : undefined;
    if (unit) {
      if (seenUnits.has(unit)) { r.errors.push(`Same society, tower and flat as row ${seenUnits.get(unit)} of this file.`); r.action = 'error'; }
      else seenUnits.set(unit, row.rowNo);
    }
    if (r.propertyId && r.action !== 'error') {
      if (seenIds.has(r.propertyId)) { r.errors.push(`${r.propertyId} is already updated by row ${seenIds.get(r.propertyId)} of this file.`); r.action = 'error'; }
      else seenIds.set(r.propertyId, row.rowNo);
    }
    return r;
  });
}

function validateRow(row: RawRow, ctx: ImportContext): ImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const x = new Reader(row.cells, errors);
  const id = x.text('propertyId')?.toUpperCase();
  const out = (o: Partial<ImportRow>): ImportRow => ({
    rowNo: row.rowNo, label: '', changes: [], duplicates: [], ...o, errors, warnings,
    action: errors.length ? 'error' : (o.action ?? 'error'),
  });

  if (!id) {
    if (!ctx.canCreate) { errors.push('Your role cannot create properties — only update rows (with a Property ID) are allowed.'); return out({}); }
    return out(validateCreate(x, ctx, warnings));
  }
  if (!ctx.canEdit) { errors.push('Your role cannot update existing properties. Leave Property ID blank to submit new ones.'); return out({ propertyId: id }); }
  const current = ctx.properties.find(p => p.id === id);
  if (!current) { errors.push(`Property ${id} was not found (or isn't visible to you).`); return out({ propertyId: id }); }
  return out({ propertyId: id, ...validateUpdate(x, current, ctx, warnings) });
}

function validateCreate(x: Reader, ctx: ImportContext, warnings: string[]): Partial<ImportRow> {
  const errors = x.errors;
  const need = (k: ColKey) => { if (!x.has(k)) errors.push(`${COLUMNS.find(c => c.key === k)!.header} is required for a new property.`); };
  (['society', 'tower', 'flatNo', 'bhk', 'areaSqft', 'rent', 'maintenance', 'depositMonths', 'ownerName', 'ownerPhone'] as ColKey[]).forEach(need);

  const socText = x.text('society');
  const society = socText ? matchSociety(socText, ctx.societies) : undefined;
  if (socText && !society) errors.push(`Society "${socText}" is not in the list — pick one from the dropdown.`);

  let sourceId = ctx.agentSourceId;
  if (!sourceId) {
    need('source');
    const srcText = x.text('source');
    const src = srcText ? matchSource(srcText, ctx.sources) : undefined;
    if (srcText && !src) errors.push(`Source "${srcText}" is not in the list — pick one from the dropdown.`);
    sourceId = src?.id;
  } else if (x.has('source')) warnings.push('Source column ignored — agents always submit as their own agency.');

  const tower = x.text('tower', 20)?.toUpperCase();
  const flatNo = x.text('flatNo', 20);
  const bhk = x.num('bhk', 1, 5, true);
  const areaSqft = x.num('areaSqft', 200, 20000);
  const floor = x.num('floor', 0, 100, true) ?? 1;
  const totalFloors = x.num('totalFloors', 1, 100, true) ?? Math.max(14, floor);
  if (floor > totalFloors) errors.push(`Floor ${floor} is above Total Floors ${totalFloors}.`);
  const rent = x.num('rent', 1000, 1_000_000);
  const maintenance = x.num('maintenance', 0, 200_000);
  const depositMonths = x.num('depositMonths', 1, 12);
  if (rent && maintenance && maintenance > rent) warnings.push('Maintenance is higher than rent — are the columns swapped?');

  const availableFrom = x.date('availableFrom') ?? (ctx.today ?? new Date()).toISOString().slice(0, 10);
  const furnishing = x.pick('furnishing', FURNISHINGS) ?? 'Semi Furnished';
  const facing = x.pick('facing', FACINGS) ?? 'East';
  const tenantType = x.pick('tenantType', TENANT_TYPES) ?? 'Both Allowed';
  const parking = x.text('parking', 40) ?? '1 Covered';
  const petsAllowed = x.yesNo('petsAllowed') ?? false;
  const description = x.text('description', 2000);
  const images = parsePhotos(x.text('photoUrls', 5000), errors) ?? [];

  const ownerName = x.text('ownerName', 80);
  if (ownerName !== undefined && ownerName.length < 2) errors.push('Owner Name: enter the full name.');
  const ownerPhone = x.text('ownerPhone') !== undefined ? cleanPhone(x.text('ownerPhone')!) : undefined;
  if (ownerPhone !== undefined && !PHONE.test(ownerPhone)) errors.push(`Owner Mobile "${ownerPhone}" is not a valid 10-digit mobile.`);
  const knownOwner = ownerPhone ? ctx.owners.find(o => o.phone === ownerPhone) : undefined;
  if (knownOwner && ownerName && knownOwner.name.toLowerCase() !== ownerName.toLowerCase()) {
    warnings.push(`Mobile belongs to existing owner "${knownOwner.name}" — the property will be linked to them.`);
  }

  const authorization = readAuthorization(x, undefined, ctx);
  const commercial = readCommercial(x, ctx, warnings);
  if (commercial?.minAcceptableRent && rent && commercial.minAcceptableRent > rent) errors.push('Negotiation Floor is above the Rent.');

  const label = `${bhk ?? '?'} BHK · ${society?.name ?? socText ?? '?'} · Tower ${tower ?? '?'} / ${flatNo ?? '?'}`;
  if (errors.length) return { label };
  if (images.length < 3) warnings.push(`${images.length} photo(s) — at least 3 are needed before it can be published.`);

  const create: NewPropertyInput = {
    societyId: society!.id, tower: tower!, flatNo: flatNo!, bhk: bhk!, areaSqft: areaSqft!, floor, totalFloors,
    facing, furnishing, tenantType, rent: rent!, maintenance: maintenance!, depositMonths: depositMonths!, parking,
    availableFrom, petsAllowed, description, photos: images.length, images, sourceId: sourceId!,
    ownerId: null, newOwner: { name: ownerName!, phone: ownerPhone! },
    authorization: authorization ?? { status: 'pending' },
    commercial: commercial ? {
      tenantBrokerage: commercial.tenantBrokerage ?? '15 days rent', ownerBrokerage: commercial.ownerBrokerage ?? 'None',
      sourceSharePct: commercial.sourceSharePct ?? ctx.sources.find(s => s.id === sourceId)?.defaultSharePct ?? 0,
      minAcceptableRent: commercial.minAcceptableRent ?? rent!,
    } : undefined,
  };
  const duplicates = ctx.checkDuplicates(create);
  if (duplicates.length) {
    warnings.push(ctx.agentSourceId
      ? 'This flat may already be on BHP\'s books — BHP will review it.'
      : `Possible duplicate of ${duplicates.map(d => d.b.id).join(', ')}. Tick the row only if it is a different flat.`);
  }
  return { action: 'create', label, create, duplicates };
}

function readAuthorization(x: Reader, current: OwnerAuthorization | undefined, ctx: ImportContext): OwnerAuthorization | undefined {
  const status = x.pick('authStatus', [...AUTH_STATUSES, 'Expired'] as const);
  const methodLabel = x.pick('authMethod', Object.keys(AUTH_METHODS));
  const validTill = x.date('authValidTill');
  if (status === 'Expired') {
    if (current?.status !== 'expired') x.errors.push('Authorization: "Expired" can\'t be set from a sheet — use Pending or Received.');
    return undefined;
  }
  const effective = status ?? (current ? undefined : 'Pending');
  if (effective === 'Pending') return current?.status === 'pending' ? undefined : { status: 'pending' };
  // Received — new, or editing method / validity of an existing one
  if (effective === 'Received' || (current?.status === 'received' && (methodLabel || validTill))) {
    const method = methodLabel ? AUTH_METHODS[methodLabel] : current?.status === 'received' ? current.method : undefined;
    if (!method) { x.errors.push('Authorization Method is required when Authorization is Received.'); return undefined; }
    const till = validTill ?? (current?.status === 'received' && current.validTill ? current.validTill.slice(0, 10)
      : new Date((ctx.today ?? new Date()).getTime() + 90 * DAY).toISOString().slice(0, 10));
    if (current?.status === 'received' && current.method === method && current.validTill?.slice(0, 10) === till) return undefined;
    const startOfToday = new Date(ctx.today ?? new Date()); startOfToday.setHours(0, 0, 0, 0);
    if (new Date(till).getTime() < startOfToday.getTime()) { x.errors.push('Authorization Valid Till is in the past.'); return undefined; }
    return {
      status: 'received', method,
      receivedAt: current?.status === 'received' ? current.receivedAt : new Date().toISOString(),
      validTill: new Date(till).toISOString(),
    };
  }
  return undefined;
}

function readCommercial(x: Reader, ctx: ImportContext, warnings: string[]): Partial<CommercialTerms> | undefined {
  const keys: ColKey[] = ['tenantBrokerage', 'ownerBrokerage', 'sourceSharePct', 'minAcceptableRent'];
  if (!keys.some(k => x.has(k))) return ctx.canSetCommercial ? {} : undefined;
  if (!ctx.canSetCommercial) { warnings.push('Commercial terms ignored — your role cannot set them (source defaults apply).'); return undefined; }
  const c: Partial<CommercialTerms> = {};
  const tb = x.text('tenantBrokerage', 60); if (tb !== undefined) c.tenantBrokerage = tb;
  const ob = x.text('ownerBrokerage', 60); if (ob !== undefined) c.ownerBrokerage = ob;
  const sp = x.num('sourceSharePct', 0, 100); if (sp !== undefined) c.sourceSharePct = sp;
  const mr = x.num('minAcceptableRent', 1000, 1_000_000); if (mr !== undefined) c.minAcceptableRent = mr;
  return c;
}

function validateUpdate(x: Reader, cur: PropertyRecord, ctx: ImportContext, warnings: string[]): Partial<ImportRow> {
  const errors = x.errors;
  const f = cur.flat;
  const society = ctx.societies.find(s => s.id === f.societyId);
  const label = `${f.bhk} BHK · ${society?.name ?? f.societyId} · Tower ${cur.tower} / ${cur.flatNo}`;
  if (cur.status === 'rented') { errors.push('This listing is closed (rented) — it can\'t be edited.'); return { label }; }

  const socText = x.text('society');
  if (socText && matchSociety(socText, ctx.societies)?.id !== f.societyId) {
    errors.push('Society can\'t be changed on an existing property — it is a different flat. Leave Property ID blank to add it as new.');
  }
  const srcText = x.text('source');
  if (srcText && !ctx.agentSourceId && matchSource(srcText, ctx.sources)?.id !== cur.sourceId) {
    errors.push('Source can\'t be changed from a sheet — attribution is decided on evidence. Raise it with a manager.');
  }

  const patch: PropertyPatch = {};
  const changes: string[] = [];
  const set = <K extends keyof PropertyPatch>(k: K, next: PropertyPatch[K] | undefined, now: unknown, label: string, fmt: (v: never) => string = v => String(v)) => {
    if (next === undefined || next === now) return;
    patch[k] = next;
    changes.push(`${label}: ${now === undefined || now === '' ? '—' : fmt(now as never)} → ${fmt(next as never)}`);
  };

  set('tower', x.text('tower', 20)?.toUpperCase(), cur.tower, 'Tower');
  set('flatNo', x.text('flatNo', 20), cur.flatNo, 'Flat');
  set('bhk', x.num('bhk', 1, 5, true), f.bhk, 'BHK');
  set('areaSqft', x.num('areaSqft', 200, 20000), f.areaSqft, 'Area', (v: number) => `${v} sq.ft`);
  const floor = x.num('floor', 0, 100, true), totalFloors = x.num('totalFloors', 1, 100, true);
  if ((floor ?? f.floor) > (totalFloors ?? f.totalFloors)) errors.push(`Floor ${floor ?? f.floor} is above Total Floors ${totalFloors ?? f.totalFloors}.`);
  set('floor', floor, f.floor, 'Floor');
  set('totalFloors', totalFloors, f.totalFloors, 'Total floors');

  const rent = x.num('rent', 1000, 1_000_000);
  if (rent !== undefined && rent !== f.rent) {
    if (cur.pendingRentChange) errors.push(`A rent change to ${inr(cur.pendingRentChange.newRent)} is already waiting for approval — decide it first.`);
    else {
      patch.rent = rent;
      const live = LIVE_STATUSES.includes(cur.status);
      changes.push(`Rent: ${inr(f.rent)} → ${inr(rent)}${live ? ' (sent for manager approval)' : ''}`);
      if (live) warnings.push('Rent change on a live listing goes to Approvals — the public price stays the same until approved.');
    }
  }
  set('maintenance', x.num('maintenance', 0, 200_000), f.maintenance, 'Maintenance', inr);
  set('depositMonths', x.num('depositMonths', 1, 12), f.depositMonths, 'Deposit', (v: number) => `${v} months`);
  set('availableFrom', x.date('availableFrom'), f.availableFrom, 'Available from');
  set('furnishing', x.pick('furnishing', FURNISHINGS), f.furnishing, 'Furnishing');
  set('facing', x.pick('facing', FACINGS), f.facing, 'Facing');
  set('tenantType', x.pick('tenantType', TENANT_TYPES), f.tenantType, 'Tenants');
  set('parking', x.text('parking', 40), f.parking, 'Parking');
  set('petsAllowed', x.yesNo('petsAllowed'), f.petsAllowed, 'Pets', (v: boolean) => v ? 'Yes' : 'No');
  const desc = x.text('description', 2000);
  if (desc !== undefined && desc !== f.description) { patch.description = desc; changes.push('Description updated'); }
  const images = parsePhotos(x.text('photoUrls', 5000), errors);
  if (images && images.join() !== f.images.join()) {
    patch.images = images; changes.push(`Photos: ${f.images.length} → ${images.length}`);
    if (images.length < 3) warnings.push(`Only ${images.length} photo(s) — at least 3 are needed to stay publishable.`);
  }

  // owner — only when the sheet gives a different mobile
  const ownerName = x.text('ownerName', 80);
  const ownerPhoneRaw = x.text('ownerPhone');
  if (ownerName !== undefined || ownerPhoneRaw !== undefined) {
    const curOwner = ctx.owners.find(o => o.id === cur.ownerId);
    const phone = ownerPhoneRaw !== undefined ? cleanPhone(ownerPhoneRaw) : curOwner?.phone;
    if (!ctx.canSetOwner) warnings.push('Owner columns ignored — your role cannot change owners.');
    else if (!phone || !PHONE.test(phone)) errors.push(`Owner Mobile "${ownerPhoneRaw ?? ''}" is not a valid 10-digit mobile.`);
    else if (phone !== curOwner?.phone) {
      const name = ownerName ?? ctx.owners.find(o => o.phone === phone)?.name;
      if (!name || name.length < 2) errors.push('Owner Name is required when changing the owner\'s mobile.');
      else {
        patch.newOwner = { name, phone };
        changes.push(`Owner: ${curOwner ? curOwner.name : '—'} → ${name} (${phone})`);
        warnings.push('Changing the owner — the next verification call goes to the new number.');
      }
    } else if (ownerName && curOwner && ownerName !== curOwner.name) {
      warnings.push('Owner name differs from the owner record — names are edited on the Owners page, not here.');
    }
  }

  const auth = readAuthorization(x, cur.authorization, ctx);
  if (auth) {
    patch.authorization = auth;
    changes.push(`Authorization: ${cur.authorization.status} → ${auth.status}${auth.method ? ` (${auth.method}, till ${auth.validTill!.slice(0, 10)})` : ''}`);
  }

  const c = readCommercial(x, ctx, warnings);
  if (c && cur.commercial) {
    const diff: Partial<CommercialTerms> = {};
    (Object.keys(c) as (keyof CommercialTerms)[]).forEach(k => { if (c[k] !== cur.commercial![k]) (diff as Record<string, unknown>)[k] = c[k]; });
    const floorRent = diff.minAcceptableRent ?? cur.commercial.minAcceptableRent;
    if (floorRent > (patch.rent ?? f.rent)) errors.push('Negotiation Floor is above the Rent.');
    if (Object.keys(diff).length) { patch.commercial = diff; changes.push(`Commercial terms: ${Object.keys(diff).length} field(s)`); }
  }

  if (errors.length) return { label };
  if (!changes.length) return { action: 'unchanged', label };
  if (cur.status === 'published' && changes.some(ch => !ch.startsWith('Rent'))) {
    warnings.push(`Listing is ${STATUS_LABEL[cur.status].toLowerCase()} — detail changes show on FindFlat immediately.`);
  }
  return { action: 'update', label, patch, changes };
}

/* ======================= export (download current properties) ======================= */

/** One sheet row per record, in COLUMNS order — so "download, edit, upload" round-trips without changes. */
export function recordToCells(r: PropertyRecord, ctx: Pick<ImportContext, 'societies' | 'sources' | 'owners'>): Record<ColKey, CellValue> {
  const f = r.flat;
  const soc = ctx.societies.find(s => s.id === f.societyId);
  const src = ctx.sources.find(s => s.id === r.sourceId);
  const owner = ctx.owners.find(o => o.id === r.ownerId);
  const methodLabel = Object.entries(AUTH_METHODS).find(([, m]) => m === r.authorization.method)?.[0] ?? null;
  const authLabel = { pending: 'Pending', received: 'Received', expired: 'Expired' }[r.authorization.status];
  return {
    propertyId: r.id, society: soc ? societyOption(soc) : f.societyId, tower: r.tower, flatNo: r.flatNo, bhk: f.bhk, areaSqft: f.areaSqft,
    floor: f.floor, totalFloors: f.totalFloors, rent: f.rent, maintenance: f.maintenance, depositMonths: f.depositMonths,
    availableFrom: f.availableFrom, furnishing: f.furnishing, facing: f.facing, tenantType: f.tenantType, parking: f.parking,
    petsAllowed: f.petsAllowed ? 'Yes' : 'No', description: f.description, photoUrls: f.images.join('\n'),
    source: src ? sourceOption(src) : r.sourceId, ownerName: owner?.name ?? null, ownerPhone: owner?.phone ?? null,
    authStatus: authLabel, authMethod: r.authorization.status === 'received' ? methodLabel : null,
    authValidTill: r.authorization.status === 'received' ? r.authorization.validTill?.slice(0, 10) ?? null : null,
    tenantBrokerage: r.commercial?.tenantBrokerage ?? null, ownerBrokerage: r.commercial?.ownerBrokerage ?? null,
    sourceSharePct: r.commercial?.sourceSharePct ?? null, minAcceptableRent: r.commercial?.minAcceptableRent ?? null,
    status: STATUS_LABEL[r.status],
  };
}
