import { Injectable, computed, signal } from '@angular/core';
import { SOCIETIES } from '../data/rent.data';
import { RentalFlat, Society } from '../models/rent.models';
import { AvailabilityAlert, Enquiry, EnquiryResult, ListingReport } from '../models/common.models';
import {
  AlertRecord, AuditEntry, Deal, DuplicateDecision, Lead, Owner, PropertyRecord, ReportRecord, Source, StaffUser, Verification,
} from '../admin/admin.models';
import {
  SEED_AUDIT, SEED_DEALS, SEED_LEADS, SEED_OWNERS, SEED_PROPERTIES, SEED_SOURCES, SEED_USERS, SEED_VERIFICATIONS,
} from './admin.seed';

export interface DbState {
  version: number;
  properties: PropertyRecord[];
  owners: Owner[];
  sources: Source[];
  users: StaffUser[];
  verifications: Verification[];
  leads: Lead[];
  deals: Deal[];
  reports: ReportRecord[];
  alerts: AlertRecord[];
  duplicateDecisions: DuplicateDecision[];
  audit: AuditEntry[];
  seq: Record<string, number>;
}

const KEY = 'findflat.mockdb';
const VERSION = 1;

/**
 * IN-BROWSER STAND-IN FOR THE BHP DATABASE + API.
 *
 * Holds every record in signals and saves to localStorage so changes made in BHP Admin (approve, verify,
 * mark rented…) show up on the public site after a reload. Delete this service once the .NET API is live:
 * PropertyService and AdminService are the only consumers.
 */
@Injectable({ providedIn: 'root' })
export class MockDbService {
  private readonly state = signal<DbState>(this.load());
  readonly db = this.state.asReadonly();
  readonly societies: Society[] = SOCIETIES;

  /* ---------------- persistence ---------------- */

  private seed(): DbState {
    const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    return {
      version: VERSION,
      properties: clone(SEED_PROPERTIES), owners: clone(SEED_OWNERS), sources: clone(SEED_SOURCES), users: clone(SEED_USERS),
      verifications: clone(SEED_VERIFICATIONS), leads: clone(SEED_LEADS), deals: clone(SEED_DEALS),
      reports: [], alerts: [], duplicateDecisions: [], audit: clone(SEED_AUDIT), seq: {},
    };
  }

  private load(): DbState {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as DbState;
        if (s.version === VERSION) return s;
      }
    } catch { /* storage unavailable or corrupt */ }
    return this.seed();
  }

  /** Apply a mutation to a draft copy and persist. */
  commit(mutate: (draft: DbState) => void) {
    const draft: DbState = structuredClone(this.state());
    mutate(draft);
    this.state.set(draft);
    try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* ignore quota */ }
  }

  reset() {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    this.state.set(this.seed());
  }

  nextId(draft: DbState, prefix: string, width = 6): string {
    const n = (draft.seq[prefix] ?? this.existingMax(draft, prefix)) + 1;
    draft.seq[prefix] = n;
    return `${prefix}-${String(n).padStart(width, '0')}`;
  }

  private existingMax(draft: DbState, prefix: string): number {
    const all = [...draft.properties, ...draft.leads, ...draft.verifications, ...draft.audit, ...draft.owners, ...draft.sources, ...draft.reports, ...draft.alerts]
      .map(x => x.id).filter(id => id.startsWith(prefix + '-')).map(id => parseInt(id.slice(prefix.length + 1), 10)).filter(n => !isNaN(n));
    return all.length ? Math.max(...all) : 0;
  }

  audit(draft: DbState, actor: string, entity: AuditEntry['entity'], entityId: string, action: string, detail: string) {
    draft.audit.unshift({ id: this.nextId(draft, 'AUD'), at: new Date().toISOString(), actor, entity, entityId, action, detail });
  }

  /* ---------------- public projection ---------------- */

  /**
   * The ONLY shape that leaves the BHP side: no owner, source, commercial, internal notes or workflow state.
   * The .NET public endpoints should return exactly this projection.
   */
  static toPublicFlat(r: PropertyRecord): RentalFlat {
    return {
      ...r.flat,
      code: r.id,
      availability: r.conflict ? 'unknown' : r.availability,
      lastVerifiedAt: r.conflict ? null : r.lastVerifiedAt,
    };
  }

  /** Listings a tenant can browse: published and not rented. */
  readonly publicFlats = computed(() => this.state().properties
    .filter(r => r.status === 'published' && r.availability !== 'rented')
    .map(MockDbService.toPublicFlat));

  /** A single listing by public route id. Rented / suspended ones stay reachable so old links don't dead-end. */
  publicFlat(id: string): RentalFlat | undefined {
    const r = this.state().properties.find(p => p.flat.id === id && ['published', 'rented', 'suspended'].includes(p.status));
    if (!r) return undefined;
    const f = MockDbService.toPublicFlat(r);
    return r.status === 'suspended' ? { ...f, availability: 'unknown', lastVerifiedAt: null } : f;
  }

  /* ---------------- public-site writes ---------------- */

  submitEnquiry(e: Enquiry): EnquiryResult {
    let result: EnquiryResult = { ok: true, duplicate: false, reference: '' };
    this.commit(d => {
      const prop = d.properties.find(p => p.id === e.listingId);
      const societyId = prop?.flat.societyId ?? (SOCIETIES.some(s => s.id === e.listingId) ? e.listingId : undefined);
      const existing = d.leads.find(l => l.phone === e.phone && !['won', 'lost'].includes(l.status)
        && (prop ? l.propertyId === prop.id : l.societyId === societyId));
      if (existing) {
        // Same person, same property, still open → link instead of creating a second lead for someone to call.
        existing.message = [existing.message, `[${new Date().toLocaleDateString('en-IN')}] ${e.message ?? ''}`].filter(Boolean).join('\n');
        this.audit(d, 'public', 'lead', existing.id, 'lead.duplicate_linked', `Repeat ${e.type} from website`);
        result = { ok: true, duplicate: true, reference: existing.id };
        return;
      }
      const id = this.nextId(d, 'LD');
      d.leads.unshift({
        id, name: e.name, phone: e.phone, channel: 'website', type: e.type, propertyId: prop?.id, societyId,
        message: [e.message, e.preferredDate ? `Visit: ${e.preferredDate} ${e.preferredSlot ?? ''}` : ''].filter(Boolean).join('\n'),
        status: 'new', assignedTo: null, createdAt: new Date().toISOString(), nextFollowUpAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      });
      this.audit(d, 'public', 'lead', id, 'lead.created', `${e.type} for ${e.listingTitle}`);
      result = { ok: true, duplicate: false, reference: id };
    });
    return result;
  }

  reportListing(r: ListingReport) {
    this.commit(d => {
      const id = this.nextId(d, 'RPT', 5);
      d.reports.unshift({ id, propertyId: r.propertyCode, reason: r.reason, details: r.details, phone: r.phone, at: new Date().toISOString(), status: 'open' });
      const prop = d.properties.find(p => p.id === r.propertyCode);
      if (prop) prop.nextCheckDue = new Date().toISOString();   // jump the verification queue
      this.audit(d, 'public', 'property', r.propertyCode, 'listing.reported', `${r.reason}${r.details ? ': ' + r.details : ''}`);
    });
  }

  createAlert(a: AvailabilityAlert) {
    this.commit(d => {
      const soc = SOCIETIES.find(s => s.id === a.societyId);
      const criteria = [a.bhk ? `${a.bhk} BHK` : '', soc?.name ?? a.locality ?? '', a.maxBudget ? `≤ ₹${a.maxBudget.toLocaleString('en-IN')}` : '']
        .filter(Boolean).join(' · ') || 'Any';
      d.alerts.unshift({ id: this.nextId(d, 'ALR', 5), name: a.name, phone: a.phone, criteria, at: new Date().toISOString() });
    });
  }
}
