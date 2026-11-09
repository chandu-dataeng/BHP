/**
 * Listing publication rules — a property can go live on FindFlat only when EVERY check passes.
 * Deterministic and shared by the approval screen and AdminService.approve() (the API must re-check).
 */
import { freshness } from '../policy/availability';
import { PropertyRecord } from './admin.models';

export interface Check { key: string; label: string; ok: boolean; detail?: string; }

export const MIN_PHOTOS = 3;

export function publishChecklist(r: PropertyRecord, openDuplicates: number, now = Date.now()): Check[] {
  const f = r.flat;
  const missing = [
    !f.bhk && 'BHK', !f.rent && 'rent', !f.maintenance && 'maintenance', !f.deposit && 'deposit', !f.areaSqft && 'area',
    !r.tower && 'tower', !r.flatNo && 'flat no.',
  ].filter(Boolean) as string[];
  const auth = r.authorization;
  const authExpired = auth.validTill ? new Date(auth.validTill).getTime() < now : false;
  const fr = freshness({ availability: r.availability, lastVerifiedAt: r.lastVerifiedAt }, now);

  return [
    { key: 'auth', label: 'Owner authorization on record', ok: auth.status === 'received' && !authExpired,
      detail: auth.status !== 'received' ? 'Not yet received' : authExpired ? 'Expired' : `${auth.method ?? ''}, valid till ${new Date(auth.validTill!).toLocaleDateString('en-IN')}` },
    { key: 'owner', label: 'Owner identified', ok: !!r.ownerId, detail: r.ownerId ? undefined : 'Owner not linked (or hidden for your role)' },
    { key: 'fresh', label: 'Availability confirmed recently', ok: fr === 'confirmed', detail: fr === 'confirmed' ? undefined : fr === 'stale' ? 'Confirmation is stale' : 'Not confirmed' },
    { key: 'conflict', label: 'No conflicting information', ok: !r.conflict, detail: r.conflict },
    { key: 'fields', label: 'Required details complete', ok: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(', ')}` : undefined },
    { key: 'photos', label: `At least ${MIN_PHOTOS} photos`, ok: f.images.length >= MIN_PHOTOS, detail: `${f.images.length} uploaded` },
    { key: 'dup', label: 'No unresolved duplicate', ok: openDuplicates === 0, detail: openDuplicates ? `${openDuplicates} possible duplicate(s) to review` : undefined },
  ];
}

export const canPublish = (checks: Check[]) => checks.every(c => c.ok);
