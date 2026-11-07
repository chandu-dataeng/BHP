import { Injectable, computed, inject } from '@angular/core';
import { MockDbService, DbState } from '../mock/mock-db.service';
import { makeFlat } from '../data/rent.data';
import { Furnishing, Facing, RentalFlat, TenantType } from '../models/rent.models';
import { AVAILABILITY_POLICY, freshness } from '../policy/availability';
import { AuthService } from './auth.service';
import { Permission } from './permissions';
import {
  CommercialTerms, DuplicateDecision, Lead, Owner, OwnerAuthorization, PropertyRecord, Source, StaffUser,
  Verification, VerificationResult,
} from './admin.models';
import { allDuplicatePairs, findDuplicatesFor, DuplicateMatch, pairKey } from './duplicates';
import { canPublish, publishChecklist } from './publish-rules';
import type { ImportContext, ImportRow, PropertyPatch } from './bulk-import';

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

export interface NewPropertyInput {
  societyId: string;
  tower: string;
  flatNo: string;
  bhk: number;
  areaSqft: number;
  floor: number;
  totalFloors: number;
  facing: Facing;
  furnishing: Furnishing;
  tenantType: TenantType;
  rent: number;
  maintenance: number;
  depositMonths: number;
  parking: string;
  availableFrom: string;
  petsAllowed: boolean;
  description?: string;
  photos: number;                    // mock: number of photos "uploaded"
  images?: string[];                 // real photo URLs (bulk import) — replaces the mock photos when given
  sourceId: string;
  ownerId: string | null;
  newOwner?: { name: string; phone: string };
  authorization: OwnerAuthorization;
  commercial?: CommercialTerms;
  intakeMessage?: string;
}

export interface VerificationInput {
  result: VerificationResult;
  confirmedBy: string;
  method: Verification['method'];
  newRent?: number;
  notes?: string;
  evidence?: string;
}

const DAY = 86_400_000;
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * DAY).toISOString();

/**
 * BHP Admin data access. Mirrors what the .NET API will do:
 *  • every action checks a permission (UI hiding is only convenience),
 *  • rows are scoped (agents → own submissions; executives → assigned work),
 *  • restricted fields are REDACTED before data reaches a component,
 *  • every change writes an audit entry.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private mock = inject(MockDbService);
  private auth = inject(AuthService);
  private raw = this.mock.db;

  readonly societies = this.mock.societies;

  /* ======================= reads (scoped + redacted) ======================= */

  private visible(r: PropertyRecord, u: StaffUser): boolean {
    if (u.role === 'agent') return r.sourceId === u.sourceId;
    return true;
  }

  private redact(r: PropertyRecord): PropertyRecord {
    return {
      ...r,
      ownerId: this.auth.can('property.viewOwner') ? r.ownerId : null,
      commercial: this.auth.can('property.viewCommercial') ? r.commercial : null,
    };
  }

  readonly properties = computed<PropertyRecord[]>(() => {
    const u = this.auth.user();
    if (!u || !this.auth.can('property.view')) return [];
    return this.raw().properties.filter(r => this.visible(r, u)).map(r => this.redact(r));
  });

  property(id: string) { return this.properties().find(p => p.id === id); }

  readonly users = computed(() => this.raw().users);
  userName(id: string | null | undefined): string {
    if (!id) return '—';
    if (id === 'public') return 'Website visitor';
    return this.raw().users.find(u => u.id === id)?.name ?? id;
  }
  readonly verifiers = computed(() => this.raw().users.filter(u => u.active && (u.role === 'verifier' || u.role === 'dept_manager')));

  readonly owners = computed<Owner[]>(() => (this.auth.can('owner.view') || this.auth.can('property.viewOwner')) ? this.raw().owners : []);
  owner(id: string | null) { return id ? this.owners().find(o => o.id === id) : undefined; }

  readonly sources = computed<Source[]>(() => {
    const u = this.auth.user();
    if (u?.role === 'agent') return this.raw().sources.filter(s => s.id === u.sourceId);
    return this.auth.can('source.view') ? this.raw().sources : [];
  });
  sourceName(id: string) { return this.raw().sources.find(s => s.id === id)?.name ?? id; }

  verificationsFor(propertyId: string): Verification[] {
    if (!this.property(propertyId)) return [];
    return this.raw().verifications.filter(v => v.propertyId === propertyId).sort((a, b) => b.at.localeCompare(a.at));
  }

  readonly leads = computed<Lead[]>(() => {
    const u = this.auth.user(); if (!u) return [];
    if (this.auth.can('lead.viewAll')) return this.raw().leads;
    if (u.role === 'telecaller' || u.role === 'visit_exec') return this.raw().leads.filter(l => l.assignedTo === u.id);
    return [];
  });
  readonly deals = computed(() => this.auth.can('finance.view') ? this.raw().deals : []);
  readonly audit = computed(() => this.auth.can('audit.view') ? this.raw().audit : []);
  readonly reports = computed(() => this.auth.can('verification.record') || this.auth.can('property.approve') ? this.raw().reports : []);
  readonly alerts = computed(() => this.auth.can('lead.viewAll') ? this.raw().alerts : []);

  auditFor(entityId: string) { return this.audit().filter(a => a.entityId === entityId); }

  /** Duplicate pairs among records visible to this user. Owner phone is used for matching even if hidden. */
  readonly duplicatePairs = computed<DuplicateMatch[]>(() => {
    if (!this.auth.can('property.view')) return [];
    const ids = new Set(this.properties().map(p => p.id));
    const d = this.raw();
    return allDuplicatePairs(d.properties, d.owners, d.duplicateDecisions)
      .filter(m => ids.has(m.a.id) && ids.has(m.b.id))
      .map(m => ({ ...m, a: this.redact(m.a), b: this.redact(m.b) }));
  });

  openDuplicatesCount(id: string) { return this.duplicatePairs().filter(m => m.a.id === id || m.b.id === id).length; }

  /** Duplicate check for a property that hasn't been saved yet (add-property wizard). */
  checkDuplicates(input: Pick<NewPropertyInput, 'societyId' | 'tower' | 'flatNo' | 'bhk' | 'areaSqft' | 'floor' | 'ownerId' | 'newOwner'>): DuplicateMatch[] {
    const d = this.raw();
    const owners = [...d.owners];
    let ownerId = input.ownerId;
    if (!ownerId && input.newOwner?.phone) { ownerId = '__new__'; owners.push({ id: '__new__', name: input.newOwner.name, phone: input.newOwner.phone, createdAt: iso() }); }
    const candidate = { id: '__candidate__', tower: input.tower, flatNo: input.flatNo, ownerId, status: 'draft',
      flat: { societyId: input.societyId, bhk: input.bhk, areaSqft: input.areaSqft, floor: input.floor } } as unknown as PropertyRecord;
    return findDuplicatesFor(candidate, d.properties, owners, d.duplicateDecisions).map(m => ({ ...m, b: this.redact(m.b) }));
  }

  publishChecks(r: PropertyRecord) {
    const full = this.raw().properties.find(p => p.id === r.id) ?? r;   // checks run on the full record
    return publishChecklist(full, this.openDuplicatesCount(r.id));
  }

  /* ======================= writes ======================= */

  private guard(p: Permission): string | null {
    if (!this.auth.user()) return 'Please sign in again.';
    return this.auth.can(p) ? null : 'Your role is not allowed to do this.';
  }

  private me() { return this.auth.user()!.id; }

  private mutateProperty(id: string, fn: (r: PropertyRecord, d: DbState) => string | undefined): Result<PropertyRecord> {
    const u = this.auth.user();
    const current = this.raw().properties.find(p => p.id === id);
    if (!current || !u || !this.visible(current, u)) return fail('Property not found.');
    let error = undefined as string | undefined;
    this.mock.commit(d => {
      const r = d.properties.find(p => p.id === id)!;
      error = fn(r, d);
      if (!error) r.updatedAt = iso();
    });
    return error ? fail(error) : ok(this.raw().properties.find(p => p.id === id)!);
  }

  createProperty(input: NewPropertyInput, submit: boolean): Result<PropertyRecord> {
    const g = this.guard('property.create'); if (g) return fail(g);
    let created!: PropertyRecord;
    this.mock.commit(d => { created = this.insert(d, input, submit); });
    return ok(this.raw().properties.find(p => p.id === created.id)!);
  }

  private insert(d: DbState, input: NewPropertyInput, submit: boolean): PropertyRecord {
    const u = this.auth.user()!;
    const sourceId = u.role === 'agent' ? u.sourceId! : input.sourceId;   // agents always submit as themselves
    const ownerId = input.ownerId ?? (input.newOwner?.name && input.newOwner.phone ? this.ownerFor(d, input.newOwner, u.id) : null);
    const id = this.mock.nextId(d, 'FF');
    const flat = makeFlat({
      id: `flt-${id.slice(3).toLowerCase()}`, societyId: input.societyId, bhk: input.bhk, rent: input.rent, areaSqft: input.areaSqft,
      maintenance: input.maintenance, deposit: input.rent * input.depositMonths, depositMonths: input.depositMonths,
      floor: input.floor, totalFloors: input.totalFloors, facing: input.facing, furnishing: input.furnishing, tenantType: input.tenantType,
      parking: input.parking, availableFrom: input.availableFrom, petsAllowed: input.petsAllowed, postedOn: iso().slice(0, 10),
      verified: false, availability: 'unknown', lastVerifiedAt: null,
      ...(input.description ? { description: input.description } : {}),
    });
    flat.code = id;
    flat.images = input.images ?? flat.images.slice(0, Math.max(0, input.photos));
    const src = d.sources.find(s => s.id === sourceId);
    const created: PropertyRecord = {
      id, flat, tower: input.tower.trim().toUpperCase(), flatNo: input.flatNo.trim(), ownerId, sourceId, sourcedBy: u.id, sourcedAt: iso(),
      status: 'draft', availability: 'unknown', lastVerifiedAt: null, lastVerifiedBy: null, nextCheckDue: null, assignedVerifier: null,
      authorization: input.authorization,
      commercial: input.commercial ?? { tenantBrokerage: '15 days rent', ownerBrokerage: 'None', sourceSharePct: src?.defaultSharePct ?? 0, minAcceptableRent: input.rent },
      intakeMessage: input.intakeMessage, updatedAt: iso(),
    };
    d.properties.push(created);
    this.mock.audit(d, u.id, 'property', id, 'property.created', `${input.bhk} BHK, ${this.mock.societies.find(s => s.id === input.societyId)?.name}, source ${sourceId}`);
    if (submit) this.doSubmit(d, created, u.id);
    return created;
  }

  /** Existing owner with this mobile, or a new owner record. */
  private ownerFor(d: DbState, o: { name: string; phone: string }, actor: string): string {
    const existing = d.owners.find(x => x.phone === o.phone);
    if (existing) return existing.id;
    const id = this.mock.nextId(d, 'OWN', 4);
    d.owners.push({ id, name: o.name, phone: o.phone, createdAt: iso() });
    this.mock.audit(d, actor, 'owner', id, 'owner.created', o.name);
    return id;
  }

  /** Context the sheet validator needs — built from what this user may see and do. */
  importContext(): ImportContext {
    const u = this.auth.user();
    return {
      societies: this.societies, sources: this.sources(), properties: this.properties(), owners: this.owners(),
      agentSourceId: u?.role === 'agent' ? u.sourceId : undefined,
      canCreate: this.auth.can('property.create'), canEdit: this.auth.can('property.edit'),
      canSetOwner: this.auth.can('property.viewOwner'), canSetCommercial: this.auth.can('property.viewCommercial'),
      checkDuplicates: i => this.checkDuplicates(i),
    };
  }

  /**
   * Applies validated sheet rows in ONE commit (all or nothing). Permissions and record state are re-checked here
   * because the preview may be stale — the API must do the same.
   */
  bulkImport(rows: ImportRow[], submit: boolean): Result<{ created: string[]; updated: string[] }> {
    const u = this.auth.user(); if (!u) return fail('Please sign in again.');
    const creates = rows.filter(r => r.action === 'create' && r.create);
    const updates = rows.filter(r => r.action === 'update' && r.patch && r.propertyId);
    if (creates.length && !this.auth.can('property.create')) return fail('Your role is not allowed to create properties.');
    if (updates.length && !this.auth.can('property.edit')) return fail('Your role is not allowed to update properties.');
    for (const r of updates) {
      const cur = this.raw().properties.find(p => p.id === r.propertyId);
      if (!cur || !this.visible(cur, u)) return fail(`Row ${r.rowNo}: property ${r.propertyId} not found.`);
      if (cur.status === 'rented') return fail(`Row ${r.rowNo}: ${cur.id} is closed (rented).`);
      if (r.patch!.rent !== undefined && cur.pendingRentChange) return fail(`Row ${r.rowNo}: ${cur.id} already has a rent change pending.`);
    }
    const created: string[] = [], updated: string[] = [];
    this.mock.commit(d => {
      creates.forEach(r => created.push(this.insert(d, r.create!, submit).id));
      updates.forEach(r => {
        const rec = d.properties.find(p => p.id === r.propertyId)!;
        this.applyPatch(d, rec, r.patch!, u.id);
        rec.updatedAt = iso();
        updated.push(rec.id);
      });
      if (created.length + updated.length) {
        this.mock.audit(d, u.id, 'system', 'bulk-import', 'bulk.imported', `${created.length} created, ${updated.length} updated from spreadsheet`);
      }
    });
    return ok({ created, updated });
  }

  private applyPatch(d: DbState, r: PropertyRecord, p: PropertyPatch, actor: string) {
    const f = r.flat;
    const changed: string[] = [];
    const assign = <K extends keyof RentalFlat>(k: K, v: RentalFlat[K] | undefined) => {
      if (v !== undefined && v !== f[k]) { f[k] = v; changed.push(String(k)); }
    };
    if (p.tower !== undefined) { r.tower = p.tower; changed.push('tower'); }
    if (p.flatNo !== undefined) { r.flatNo = p.flatNo; changed.push('flatNo'); }
    assign('bhk', p.bhk); assign('areaSqft', p.areaSqft); assign('floor', p.floor); assign('totalFloors', p.totalFloors);
    assign('maintenance', p.maintenance); assign('availableFrom', p.availableFrom); assign('furnishing', p.furnishing);
    assign('facing', p.facing); assign('tenantType', p.tenantType); assign('parking', p.parking);
    assign('petsAllowed', p.petsAllowed); assign('description', p.description);
    if (p.bhk !== undefined) f.title = `${p.bhk} BHK Apartment`;
    if (p.images) { f.images = p.images; changed.push('photos'); }
    if (p.depositMonths !== undefined) { f.depositMonths = p.depositMonths; f.deposit = f.rent * p.depositMonths; changed.push('deposit'); }
    if (p.rent !== undefined && p.rent !== f.rent) {
      if (['published', 'suspended', 'pending_approval'].includes(r.status)) {
        // same rule as verification: the public price never changes without a manager's approval
        r.pendingRentChange = { oldRent: f.rent, newRent: p.rent, requestedBy: actor, requestedAt: iso(), evidence: 'Bulk spreadsheet import' };
        this.mock.audit(d, actor, 'property', r.id, 'rent.change_requested', `₹${f.rent.toLocaleString('en-IN')} → ₹${p.rent.toLocaleString('en-IN')} (spreadsheet)`);
      } else {
        this.mock.audit(d, actor, 'property', r.id, 'rent.changed', `₹${f.rent.toLocaleString('en-IN')} → ₹${p.rent.toLocaleString('en-IN')} (spreadsheet, not yet live)`);
        f.rent = p.rent; f.deposit = p.rent * f.depositMonths;
      }
    }
    if (p.newOwner && this.auth.can('property.viewOwner')) { r.ownerId = this.ownerFor(d, p.newOwner, actor); changed.push('owner'); }
    if (p.authorization) { r.authorization = p.authorization; changed.push('authorization'); }
    if (p.commercial && r.commercial && this.auth.can('property.viewCommercial')) { r.commercial = { ...r.commercial, ...p.commercial }; changed.push('commercial'); }
    if (changed.length) this.mock.audit(d, actor, 'property', r.id, 'property.updated', `Spreadsheet: ${changed.join(', ')}`);
  }

  private doSubmit(d: DbState, r: PropertyRecord, actor: string) {
    r.status = 'pending_verification';
    r.nextCheckDue = iso();
    if (!r.assignedVerifier) {
      // least-loaded active verifier gets it — every task has exactly one accountable person
      const load = (uid: string) => d.properties.filter(p => p.assignedVerifier === uid && p.status === 'pending_verification').length;
      const pool = d.users.filter(x => x.active && x.role === 'verifier').sort((a, b) => load(a.id) - load(b.id));
      r.assignedVerifier = pool[0]?.id ?? null;
    }
    this.mock.audit(d, actor, 'property', r.id, 'property.submitted', `Assigned to ${this.userName(r.assignedVerifier)} for verification`);
  }

  submitForVerification(id: string): Result<PropertyRecord> {
    if (!this.auth.can('property.create') && !this.auth.can('property.edit')) return fail('Your role is not allowed to do this.');
    return this.mutateProperty(id, (r, d) => {
      if (r.status !== 'draft' && r.status !== 'rejected') return 'Only drafts can be submitted.';
      if (!r.flat.rent || !r.tower || !r.flatNo) return 'Rent, tower and flat number are required.';
      this.doSubmit(d, r, this.me());
      return undefined;
    });
  }

  recordVerification(id: string, v: VerificationInput): Result<PropertyRecord> {
    const g = this.guard('verification.record'); if (g) return fail(g);
    if (!v.confirmedBy.trim()) return fail('Record who confirmed the information.');
    if (v.result === 'rent_changed' && !v.newRent) return fail('Enter the new rent.');
    return this.mutateProperty(id, (r, d) => {
      const me = this.me();
      const now = iso();
      let next: string | null = iso(AVAILABILITY_POLICY.freshDays);
      switch (v.result) {
        case 'available':
        case 'rent_changed':
          if (r.conflict) return 'Resolve the conflicting information first (see property page).';
          r.availability = 'available'; r.lastVerifiedAt = now; r.lastVerifiedBy = me;
          if (r.status === 'pending_verification') r.status = r.authorization.status === 'received' ? 'pending_approval' : 'pending_verification';
          if (v.result === 'rent_changed' && v.newRent !== r.flat.rent) {
            // never change the public price directly — a manager approves it
            r.pendingRentChange = { oldRent: r.flat.rent, newRent: v.newRent!, requestedBy: me, requestedAt: now, evidence: v.evidence || v.notes || v.method };
            this.mock.audit(d, me, 'property', r.id, 'rent.change_requested', `₹${r.flat.rent.toLocaleString('en-IN')} → ₹${v.newRent!.toLocaleString('en-IN')}`);
          }
          break;
        case 'on_hold':
          r.availability = 'on_hold'; r.lastVerifiedAt = now; r.lastVerifiedBy = me; next = iso(2);
          break;
        case 'rented': {
          r.availability = 'rented'; r.lastVerifiedAt = now; r.lastVerifiedBy = me; next = null;
          if (r.status === 'published' || r.status === 'suspended') r.status = 'rented';
          const affected = d.leads.filter(l => l.propertyId === r.id && !['won', 'lost'].includes(l.status));
          affected.forEach(l => { l.nextFollowUpAt = now; l.message = [l.message, '⚠ Flat rented — offer alternatives'].filter(Boolean).join('\n'); });
          this.mock.audit(d, me, 'property', r.id, 'listing.rented', `Owner confirmed rented. ${affected.length} open enquiries flagged for alternatives.`);
          break;
        }
        case 'no_response':
          next = iso(1);   // try again tomorrow; freshness keeps ageing so the public label degrades on its own
          break;
        case 'conflict':
          r.conflict = v.notes || 'Conflicting information recorded';
          r.availability = 'unknown'; next = iso(1);
          break;
      }
      r.nextCheckDue = next;
      d.verifications.unshift({
        id: this.mock.nextId(d, 'VER', 5), propertyId: r.id, at: now, by: me, confirmedBy: v.confirmedBy, method: v.method,
        result: v.result, newRent: v.newRent, notes: v.notes, evidence: v.evidence, nextCheckDue: next,
      });
      d.reports.filter(x => x.propertyId === r.id && x.status === 'open').forEach(x => x.status = 'resolved');
      this.mock.audit(d, me, 'verification', r.id, 'availability.verified', `${v.result} — confirmed by ${v.confirmedBy} via ${v.method}`);
      return undefined;
    });
  }

  resolveConflict(id: string, note: string): Result<PropertyRecord> {
    const g = this.guard('property.approve'); if (g) return fail(g);
    return this.mutateProperty(id, (r, d) => {
      if (!r.conflict) return 'No conflict to resolve.';
      this.mock.audit(d, this.me(), 'property', r.id, 'conflict.resolved', `${r.conflict} → ${note}`);
      r.conflict = undefined; r.nextCheckDue = iso();
      return undefined;
    });
  }

  approve(id: string): Result<PropertyRecord> {
    const g = this.guard('property.approve'); if (g) return fail(g);
    const current = this.raw().properties.find(p => p.id === id);
    if (current && current.sourcedBy === this.me()) return fail('Separation of duties: you cannot approve a property you sourced. Ask another manager.');
    if (current && !canPublish(publishChecklist(current, this.openDuplicatesCount(id)))) return fail('Not all publication checks pass.');
    return this.mutateProperty(id, (r, d) => {
      if (r.status !== 'pending_approval' && r.status !== 'suspended') return 'Only properties pending approval can be published.';
      r.status = 'published'; r.flat.verified = true; r.flat.postedOn = iso().slice(0, 10);
      this.mock.audit(d, this.me(), 'property', r.id, 'listing.published', 'Live on FindFlat');
      return undefined;
    });
  }

  reject(id: string, reason: string): Result<PropertyRecord> {
    const g = this.guard('property.approve'); if (g) return fail(g);
    if (!reason.trim()) return fail('A reason is required.');
    return this.mutateProperty(id, (r, d) => {
      r.status = 'rejected'; r.rejectionReason = reason;
      this.mock.audit(d, this.me(), 'property', r.id, 'listing.rejected', reason);
      return undefined;
    });
  }

  decideRentChange(id: string, approve: boolean): Result<PropertyRecord> {
    const g = this.guard('property.approve'); if (g) return fail(g);
    return this.mutateProperty(id, (r, d) => {
      const c = r.pendingRentChange; if (!c) return 'No pending rent change.';
      if (c.requestedBy === this.me()) return 'Separation of duties: someone else must approve your own rent change.';
      if (approve) {
        r.flat.rent = c.newRent; r.flat.deposit = c.newRent * r.flat.depositMonths;
        this.mock.audit(d, this.me(), 'property', r.id, 'rent.changed', `₹${c.oldRent.toLocaleString('en-IN')} → ₹${c.newRent.toLocaleString('en-IN')} (approved)`);
      } else {
        this.mock.audit(d, this.me(), 'property', r.id, 'rent.change_rejected', `₹${c.newRent.toLocaleString('en-IN')} not applied`);
      }
      r.pendingRentChange = undefined;
      return undefined;
    });
  }

  suspend(id: string, reason: string): Result<PropertyRecord> {
    const g = this.guard('property.suspend'); if (g) return fail(g);
    if (!reason.trim()) return fail('A reason is required.');
    return this.mutateProperty(id, (r, d) => {
      if (r.status !== 'published') return 'Only published listings can be suspended.';
      r.status = 'suspended';
      this.mock.audit(d, this.me(), 'property', r.id, 'listing.suspended', reason);
      return undefined;
    });
  }

  assignVerifier(id: string, userId: string): Result<PropertyRecord> {
    const g = this.guard('verification.assign'); if (g) return fail(g);
    return this.mutateProperty(id, (r, d) => {
      r.assignedVerifier = userId;
      this.mock.audit(d, this.me(), 'property', r.id, 'verification.assigned', `→ ${this.userName(userId)}`);
      return undefined;
    });
  }

  resolveDuplicate(a: string, b: string, decision: DuplicateDecision['decision']): Result<void> {
    const g = this.guard('duplicates.resolve'); if (g) return fail(g);
    this.mock.commit(d => {
      const [x, y] = pairKey(a, b).split('|');
      d.duplicateDecisions.push({ a: x, b: y, decision, by: this.me(), at: iso() });
      if (decision === 'merged') {
        // keep the older record (first-introduction evidence stays on it); retire the newer one, history preserved
        const [keep, drop] = [d.properties.find(p => p.id === x)!, d.properties.find(p => p.id === y)!]
          .sort((p, q) => p.sourcedAt.localeCompare(q.sourcedAt));
        drop.status = 'rejected'; drop.rejectionReason = `Merged into ${keep.id} (duplicate)`;
        d.leads.filter(l => l.propertyId === drop.id).forEach(l => l.propertyId = keep.id);
        this.mock.audit(d, this.me(), 'property', drop.id, 'duplicate.merged', `Into ${keep.id}; source attribution kept on both records for review`);
      } else {
        this.mock.audit(d, this.me(), 'property', x, `duplicate.${decision}`, `${x} ↔ ${y}`);
      }
    });
    return ok(undefined);
  }

  setUserActive(userId: string, active: boolean): Result<void> {
    const g = this.guard('team.manage'); if (g) return fail(g);
    if (userId === this.me()) return fail('You cannot deactivate yourself.');
    this.mock.commit(d => {
      const u = d.users.find(x => x.id === userId); if (!u) return;
      u.active = active;
      let moved = 0;
      if (!active) {
        // leaver: access removed instantly; open work re-assigned so nothing is orphaned
        const fallbackVerifier = d.users.find(x => x.active && x.role === 'verifier')?.id ?? null;
        const fallbackCaller = d.users.find(x => x.active && x.role === 'telecaller')?.id ?? null;
        d.properties.filter(p => p.assignedVerifier === userId).forEach(p => { p.assignedVerifier = fallbackVerifier; moved++; });
        d.leads.filter(l => l.assignedTo === userId && !['won', 'lost'].includes(l.status)).forEach(l => { l.assignedTo = fallbackCaller; moved++; });
      }
      this.mock.audit(d, this.me(), 'user', userId, active ? 'user.activated' : 'user.deactivated', active ? '' : `${moved} open task(s) re-assigned`);
    });
    return ok(undefined);
  }

  resetDemo() { this.mock.reset(); }

  /* ======================= derived work queues ======================= */

  /** Verification work: everything due, with the reason it is due. */
  readonly verificationQueue = computed(() => {
    const u = this.auth.user();
    if (!u || !this.auth.can('verification.record')) return [];
    const now = Date.now();
    const reportsBy = new Map<string, number>();
    this.raw().reports.filter(r => r.status === 'open').forEach(r => reportsBy.set(r.propertyId, (reportsBy.get(r.propertyId) ?? 0) + 1));
    const visitSoon = new Set(this.raw().leads.filter(l => l.status === 'visit_scheduled').map(l => l.propertyId));
    const mineOnly = !this.auth.can('verification.assign');

    return this.properties()
      .filter(p => ['published', 'pending_verification', 'pending_approval', 'suspended'].includes(p.status) && p.availability !== 'rented')
      .filter(p => !mineOnly || p.assignedVerifier === u.id)
      .map(p => {
        const due = p.nextCheckDue ? new Date(p.nextCheckDue).getTime() : now;
        const reasons: string[] = [];
        if (reportsBy.get(p.id)) reasons.push(`${reportsBy.get(p.id)} public report(s)`);
        if (p.conflict) reasons.push('Conflict');
        if (p.status === 'pending_verification') reasons.push('New submission');
        if (visitSoon.has(p.id)) reasons.push('Visit scheduled');
        if (freshness(p) === 'stale') reasons.push('Stale');
        const priority = (reportsBy.get(p.id) ? 40 : 0) + (p.conflict ? 30 : 0) + (visitSoon.has(p.id) ? 25 : 0)
          + (p.status === 'pending_verification' ? 20 : 0) + Math.max(0, Math.round((now - due) / DAY)) * 5;
        return { property: p, due, overdue: due < now - DAY / 2, reasons, priority };
      })
      .filter(x => x.due <= now + DAY || x.reasons.length)
      .sort((a, b) => b.priority - a.priority || a.due - b.due);
  });

  readonly approvalQueue = computed(() => this.auth.can('property.approve')
    ? this.properties().filter(p => p.status === 'pending_approval' || p.pendingRentChange) : []);
}
