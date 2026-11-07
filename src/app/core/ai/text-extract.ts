/**
 * MOCK "AI" extraction — rule-based parsing of free text (WhatsApp messages, tenant requests).
 *
 * This stands in for an LLM extraction service so the UI flow (extract → review → confirm) can be built now.
 * Contract to keep when swapping in the real service: return values + per-field confidence + follow-up
 * questions, and NEVER write directly to records — a human reviews every draft.
 */
import { Furnishing, Society } from '../models/rent.models';
import { TenantRequirement, EMPTY_REQUIREMENT } from '../matching/matching';

export type Confidence = 'high' | 'medium' | 'low';
export interface Extracted<T> { value: T; confidence: Confidence; evidence: string; }

/** "65k", "65,000", "₹65000", "1.2 lakh" → number */
export function parseAmount(raw: string): number | null {
  const m = raw.replace(/[,₹\s]/g, '').toLowerCase().match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Math.round(m[2] === 'k' ? n * 1000 : m[2] ? n * 100000 : n);
}

const AMOUNT = String.raw`₹?\s?\d[\d,]*(?:\.\d+)?\s?(?:k|l|lakh|lac)?\b`;

function amountNear(text: string, keyword: string): Extracted<number> | null {
  const re = new RegExp(String.raw`(?:(${AMOUNT})\s*(?:${keyword}))|(?:(?:${keyword})\s*(?:is|of|:|-|=)?\s*(${AMOUNT}))`, 'i');
  const m = text.match(re);
  if (!m) return null;
  const v = parseAmount(m[1] ?? m[2]);
  return v == null ? null : { value: v, confidence: 'high', evidence: m[0].trim() };
}

function findBhk(text: string): Extracted<number> | null {
  const m = text.match(/(\d)\s?(?:bhk|bed\s?room|bed)/i);
  return m ? { value: +m[1], confidence: 'high', evidence: m[0] } : null;
}

function findFurnishing(text: string): Extracted<Furnishing> | null {
  if (/semi[\s-]?furnish/i.test(text)) return { value: 'Semi Furnished', confidence: 'high', evidence: 'semi furnished' };
  if (/un[\s-]?furnish|\bbare\b/i.test(text)) return { value: 'Unfurnished', confidence: 'high', evidence: 'unfurnished' };
  if (/fully[\s-]?furnish|\bfurnished\b/i.test(text)) return { value: 'Furnished', confidence: 'medium', evidence: 'furnished' };
  return null;
}

function findSociety(text: string, societies: Society[]): Extracted<Society> | null {
  const t = text.toLowerCase();
  const full = societies.find(s => t.includes(s.name.toLowerCase()));
  if (full) return { value: full, confidence: 'high', evidence: full.name };
  const partial = societies.find(s => t.includes(s.name.split(' ')[0].toLowerCase()));
  return partial ? { value: partial, confidence: 'medium', evidence: partial.name.split(' ')[0] } : null;
}

function findLocalities(text: string, societies: Society[]): string[] {
  const t = text.toLowerCase();
  return [...new Set(societies.map(s => s.locality))].filter(l => t.includes(l.toLowerCase()));
}

function isoInDays(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

/* ------------------------------------------------------------------ */
/* Property intake (agent / owner WhatsApp message → property draft)  */
/* ------------------------------------------------------------------ */

export interface PropertyExtraction {
  bhk?: Extracted<number>;
  society?: Extracted<Society>;
  locality?: Extracted<string>;
  areaSqft?: Extracted<number>;
  furnishing?: Extracted<Furnishing>;
  rent?: Extracted<number>;
  maintenance?: Extracted<number>;
  depositMonths?: Extracted<number>;
  floor?: Extracted<number>;
  tower?: Extracted<string>;
  flatNo?: Extracted<string>;
  availableFrom?: Extracted<string>;
  questions: string[];   // follow-ups the reviewer must answer
}

export function extractProperty(text: string, societies: Society[]): PropertyExtraction {
  const out: PropertyExtraction = { questions: [] };
  const bhk = findBhk(text); if (bhk) out.bhk = bhk;
  const soc = findSociety(text, societies); if (soc) out.society = soc;
  const locs = findLocalities(text, societies);
  if (locs.length) out.locality = { value: locs[0], confidence: 'high', evidence: locs[0] };

  const area = text.match(/(\d{3,5})\s?(?:sq\.?\s?ft|sft|sqft|square feet)/i);
  if (area) out.areaSqft = { value: +area[1], confidence: 'high', evidence: area[0] };

  const f = findFurnishing(text); if (f) out.furnishing = f;

  const rent = amountNear(text, 'rent') ?? amountNear(text, 'per month|pm|/month');
  if (rent) out.rent = rent;
  const maint = amountNear(text, 'maintenance|maint');
  if (maint) {
    const monthly = /month|pm|p\.m/i.test(text.slice(text.indexOf(maint.evidence), text.indexOf(maint.evidence) + maint.evidence.length + 12));
    out.maintenance = { ...maint, confidence: monthly ? 'high' : 'medium' };
    if (!monthly) out.questions.push(`Maintenance is listed as ₹${maint.value.toLocaleString('en-IN')}. Is this monthly?`);
  }
  const dep = text.match(/(\d+)\s?(?:months?|m)\s?(?:deposit|advance)/i) ?? text.match(/(?:deposit|advance)\s?(?:of|:)?\s?(\d+)\s?months?/i);
  if (dep) out.depositMonths = { value: +dep[1], confidence: 'high', evidence: dep[0] };

  const floor = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s?floor/i);
  if (floor) out.floor = { value: +floor[1], confidence: 'high', evidence: floor[0] };
  const tower = text.match(/(?:tower|block|wing)\s?([A-Z0-9]{1,3})\b/i);
  if (tower) out.tower = { value: tower[1].toUpperCase(), confidence: 'high', evidence: tower[0] };
  const flatNo = text.match(/(?:flat|unit|door)\s?(?:no\.?|number|#)?\s?(\d{3,4})\b/i);
  if (flatNo) out.flatNo = { value: flatNo[1], confidence: 'high', evidence: flatNo[0] };

  if (/immediate|ready to move|available now/i.test(text)) {
    out.availableFrom = { value: isoInDays(0), confidence: 'high', evidence: 'available immediately' };
  }

  if (!out.society && out.locality) out.questions.push(`Which society in ${out.locality.value} is this flat in?`);
  if (!out.society && !out.locality) out.questions.push('Which society / location is this flat in?');
  if (!out.rent) out.questions.push('What is the monthly rent?');
  if (!out.maintenance) out.questions.push('What is the monthly maintenance?');
  if (!out.depositMonths) out.questions.push('How many months of deposit?');
  if (!out.tower || !out.flatNo) out.questions.push('Tower and flat number? (needed for an accurate duplicate check)');
  if (out.rent && out.maintenance && out.maintenance.value > out.rent.value) {
    out.questions.push('Maintenance is higher than rent — are rent and maintenance swapped?');
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tenant requirement (free text → structured requirement)            */
/* ------------------------------------------------------------------ */

export interface RequirementExtraction { requirement: TenantRequirement; found: string[]; }

export function extractRequirement(text: string, societies: Society[]): RequirementExtraction {
  const req: TenantRequirement = { ...EMPTY_REQUIREMENT, localities: [], bhk: [], furnishing: [] };
  const found: string[] = [];

  const bhks = [...text.matchAll(/(\d)\s?(?:bhk|bed)/gi)].map(m => +m[1]);
  if (bhks.length) { req.bhk = [...new Set(bhks)]; found.push(`${req.bhk.join(' or ')} BHK`); }

  req.localities = findLocalities(text, societies);
  if (req.localities.length) found.push(req.localities.join(', '));

  const budget = text.match(new RegExp(String.raw`(?:under|below|upto|up to|within|max(?:imum)?|budget(?: is| of)?)\s*(${AMOUNT})`, 'i'));
  if (budget) {
    req.budget = parseAmount(budget[1]);
    req.budgetType = /excluding maintenance|plus maintenance|\+ ?maintenance|rent only/i.test(text) ? 'rent' : 'total';
    if (req.budget) found.push(`Budget ₹${req.budget.toLocaleString('en-IN')} ${req.budgetType === 'total' ? 'incl. maintenance' : 'rent only'}`);
  }

  const f = findFurnishing(text);
  if (f) { req.furnishing = [f.value]; found.push(`${f.value} preferred`); }
  if (/parking|\bcar\b/i.test(text)) { req.parkingRequired = true; found.push('Parking required'); }
  if (/\bpets?\b|\bdog\b|\bcat\b/i.test(text)) { req.petsRequired = true; found.push('Pets'); }
  if (/family/i.test(text)) { req.tenantType = 'Family Only'; found.push('Family'); }
  else if (/bachelor|single|working professional/i.test(text)) { req.tenantType = 'Bachelors Only'; found.push('Bachelor(s)'); }

  const days = text.match(/(?:in|within)\s(\d{1,2})\s?days/i);
  if (/next week/i.test(text)) { req.moveInBy = isoInDays(7); found.push('Move in next week'); }
  else if (/immediate|asap|this week/i.test(text)) { req.moveInBy = isoInDays(3); found.push('Move in immediately'); }
  else if (days) { req.moveInBy = isoInDays(+days[1]); found.push(`Move in within ${days[1]} days`); }
  else if (/next month/i.test(text)) { req.moveInBy = isoInDays(30); found.push('Move in next month'); }
  return { requirement: req, found };
}
