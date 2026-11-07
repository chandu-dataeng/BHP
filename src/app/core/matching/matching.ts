/**
 * Tenant requirement → flat matching.
 *
 * HARD constraints are deterministic filters (budget, BHK, locality, parking, availability…): a flat that
 * fails one is never shown as a match, whatever any AI score says. SOFT preferences only change ranking,
 * and every result explains why it matched and what it misses.
 */
import { BudgetType, Furnishing, RentalFlat, Society, TenantType } from '../models/rent.models';
import { freshness, totalMonthly } from '../policy/availability';

export interface TenantRequirement {
  localities: string[];          // empty = anywhere
  bhk: number[];                 // empty = any
  budget: number | null;
  budgetType: BudgetType;        // 'total' = rent + maintenance
  furnishing: Furnishing[];      // soft preference
  parkingRequired: boolean;
  petsRequired: boolean;
  tenantType: TenantType | null; // who is moving in
  moveInBy: string | null;       // ISO date, soft
}

export const EMPTY_REQUIREMENT: TenantRequirement = {
  localities: [], bhk: [], budget: null, budgetType: 'total', furnishing: [],
  parkingRequired: false, petsRequired: false, tenantType: null, moveInBy: null,
};

export interface MatchResult {
  flat: RentalFlat;
  society: Society;
  score: number;        // ranking only — not a probability
  reasons: string[];    // what fits
  misses: string[];     // soft preferences not met
}

export interface RejectedFlat { flat: RentalFlat; society: Society; failed: string[]; }

const inr = (v: number) => '₹' + new Intl.NumberFormat('en-IN').format(v);

/** Hard-constraint check. Returns the list of failed constraints (empty = eligible). */
export function hardFailures(req: TenantRequirement, f: RentalFlat, s: Society): string[] {
  const failed: string[] = [];
  if (f.availability === 'rented' || f.availability === 'on_hold') failed.push('Not available');
  if (req.bhk.length && !req.bhk.includes(f.bhk)) failed.push(`${f.bhk} BHK`);
  if (req.localities.length && !req.localities.some(l => l.toLowerCase() === s.locality.toLowerCase())) failed.push(`In ${s.locality}`);
  if (req.budget != null) {
    const cost = req.budgetType === 'total' ? totalMonthly(f) : f.rent;
    if (cost > req.budget) failed.push(`${req.budgetType === 'total' ? 'Total' : 'Rent'} ${inr(cost)} is over budget`);
  }
  if (req.parkingRequired && !/covered|open|\d/i.test(f.parking)) failed.push('No parking');
  if (req.petsRequired && !f.petsAllowed) failed.push('Pets not allowed');
  if (req.tenantType && req.tenantType !== 'Both Allowed' && f.tenantType !== 'Both Allowed' && f.tenantType !== req.tenantType) {
    failed.push(f.tenantType);
  }
  return failed;
}

export function matchFlats(req: TenantRequirement, flats: RentalFlat[], societies: Society[]): { matches: MatchResult[]; rejected: RejectedFlat[] } {
  const socById = new Map(societies.map(s => [s.id, s]));
  const matches: MatchResult[] = [];
  const rejected: RejectedFlat[] = [];

  for (const flat of flats) {
    const society = socById.get(flat.societyId);
    if (!society) continue;
    const failed = hardFailures(req, flat, society);
    if (failed.length) { rejected.push({ flat, society, failed }); continue; }

    let score = 50;
    const reasons: string[] = [];
    const misses: string[] = [];
    const cost = req.budgetType === 'total' ? totalMonthly(flat) : flat.rent;

    if (req.budget != null) {
      reasons.push(`${req.budgetType === 'total' ? 'Total' : 'Rent'} ${inr(cost)} fits your ${inr(req.budget)} budget`);
      score += Math.round(15 * (1 - cost / req.budget));   // more headroom ranks higher
    }
    if (req.bhk.length) reasons.push(`${flat.bhk} BHK`);
    if (req.localities.length) reasons.push(`In ${society.locality}`);
    if (req.parkingRequired) reasons.push(`Parking: ${flat.parking}`);
    if (req.petsRequired) reasons.push('Pets allowed');

    if (req.furnishing.length) {
      if (req.furnishing.includes(flat.furnishing)) { score += 12; reasons.push(flat.furnishing); }
      else { score -= 6; misses.push(`${flat.furnishing} (you preferred ${req.furnishing.join(' / ')})`); }
    }
    if (req.moveInBy) {
      if (new Date(flat.availableFrom) <= new Date(req.moveInBy)) { score += 10; reasons.push('Ready by your move-in date'); }
      else { score -= 8; misses.push(`Available from ${new Date(flat.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`); }
    }
    const fr = freshness(flat);
    if (fr === 'confirmed') { score += 10; reasons.push('Availability recently confirmed'); }
    else misses.push('Availability being reconfirmed');
    score += Math.round(society.rating * 2);

    matches.push({ flat, society, score, reasons, misses });
  }
  matches.sort((a, b) => b.score - a.score);
  return { matches, rejected };
}

/** Alternatives for a flat that is no longer available: same BHK, nearby budget. */
export function alternativesFor(f: RentalFlat, flats: RentalFlat[], societies: Society[], limit = 3): MatchResult[] {
  const req: TenantRequirement = { ...EMPTY_REQUIREMENT, bhk: [f.bhk], budget: Math.round(totalMonthly(f) * 1.15), budgetType: 'total', furnishing: [f.furnishing] };
  return matchFlats(req, flats.filter(x => x.id !== f.id), societies).matches.slice(0, limit);
}
