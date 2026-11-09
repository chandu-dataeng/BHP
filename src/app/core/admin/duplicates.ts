/**
 * Possible-duplicate detection between property records.
 *
 * Rule-based signals with transparent evidence. The score is a RANKING aid, not a probability —
 * an authorised person decides to merge, link or keep separate. (An AI/image-similarity model can add
 * signals here later; keep the evidence list so humans can see why.)
 */
import { DuplicateDecision, Owner, PropertyRecord } from './admin.models';

export interface DuplicateSignal { label: string; weight: number; }
export interface DuplicateMatch { a: PropertyRecord; b: PropertyRecord; score: number; strength: 'strong' | 'possible'; signals: DuplicateSignal[]; }

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function compare(a: PropertyRecord, b: PropertyRecord, owners: Map<string, Owner>): DuplicateMatch | null {
  if (a.flat.societyId !== b.flat.societyId) return null;    // different society → not the same flat
  const signals: DuplicateSignal[] = [{ label: 'Same society', weight: 25 }];
  const norm = (s: string) => s.trim().toUpperCase();

  if (a.tower && b.tower && norm(a.tower) === norm(b.tower)) signals.push({ label: `Same tower (${a.tower})`, weight: 15 });
  if (a.flatNo && b.flatNo && norm(a.flatNo) === norm(b.flatNo)) signals.push({ label: `Same flat no. (${a.flatNo})`, weight: 35 });
  if (a.flat.floor === b.flat.floor) signals.push({ label: `Same floor (${a.flat.floor})`, weight: 8 });
  if (a.flat.bhk && a.flat.bhk === b.flat.bhk) signals.push({ label: `Same BHK (${a.flat.bhk})`, weight: 7 });
  if (a.flat.areaSqft && b.flat.areaSqft && Math.abs(a.flat.areaSqft - b.flat.areaSqft) <= a.flat.areaSqft * 0.03) signals.push({ label: `Area within 3% (${a.flat.areaSqft} / ${b.flat.areaSqft} sq.ft)`, weight: 8 });
  const oa = a.ownerId ? owners.get(a.ownerId) : undefined;
  const ob = b.ownerId ? owners.get(b.ownerId) : undefined;
  if (oa && ob && oa.phone === ob.phone) signals.push({ label: 'Same owner phone', weight: 30 });

  const score = Math.min(100, signals.reduce((n, s) => n + s.weight, 0));
  if (score < 55) return null;
  return { a, b, score, strength: score >= 75 ? 'strong' : 'possible', signals };
}

/** Records that are still "alive" — rejected and rented-out listings don't block anything. */
const ACTIVE = (r: PropertyRecord) => r.status !== 'rejected' && r.status !== 'rented';

/** Duplicates for one (possibly unsaved) candidate against the whole inventory. */
export function findDuplicatesFor(candidate: PropertyRecord, all: PropertyRecord[], owners: Owner[], decisions: DuplicateDecision[] = []): DuplicateMatch[] {
  const om = new Map(owners.map(o => [o.id, o]));
  const decided = new Set(decisions.map(d => pairKey(d.a, d.b)));
  return all
    .filter(r => r.id !== candidate.id && ACTIVE(r) && !decided.has(pairKey(r.id, candidate.id)))
    .map(r => compare(candidate, r, om))
    .filter((m): m is DuplicateMatch => !!m)
    .sort((x, y) => y.score - x.score);
}

/** Every unresolved pair in the inventory (for the Duplicates review queue). */
export function allDuplicatePairs(all: PropertyRecord[], owners: Owner[], decisions: DuplicateDecision[]): DuplicateMatch[] {
  const om = new Map(owners.map(o => [o.id, o]));
  const decided = new Set(decisions.map(d => pairKey(d.a, d.b)));
  const live = all.filter(ACTIVE);
  const out: DuplicateMatch[] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      if (decided.has(pairKey(live[i].id, live[j].id))) continue;
      const m = compare(live[i], live[j], om);
      if (m) out.push(m);
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
