import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/admin/auth.service';
import { SOURCE_TYPE_LABEL, VERIFICATION_RESULT_LABEL } from '../../../core/admin/admin.models';
import { freshnessLabel } from '../../../core/policy/availability';
import { ToastService } from '../../../core/services/toast.service';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { ADMIN_UI } from '../ui';
import { VerifyDialogComponent } from '../verification/verify-dialog.component';

/** One physical flat: listing, availability evidence, ownership & sourcing, commercial terms, history. */
@Component({
  selector: 'app-property-detail',
  imports: [RouterLink, DatePipe, InrPipe, ImgFallbackDirective, VerifyDialogComponent, ...ADMIN_UI],
  template: `
    @if (p(); as p) {
      <a class="back" routerLink="/admin/properties"><span class="icon xs">arrow_back</span> Properties</a>
      <div class="pg-h">
        <div>
          <h1>{{ p.id }} <app-status [status]="p.status" /></h1>
          <p>{{ p.flat.bhk }} BHK · {{ society()?.name }}, {{ society()?.locality }} · Tower {{ p.tower }} / Flat {{ p.flatNo }} · Floor {{ p.flat.floor }} of {{ p.flat.totalFloors }}</p>
        </div>
        <div class="acts">
          @if (p.status === 'published' || p.status === 'rented') {
            <a class="btn btn-ghost btn-sm" [href]="'/rent/flat/' + p.flat.id" target="_blank"><span class="icon sm">open_in_new</span> Public listing</a>
          }
          @if ((p.status === 'draft' || p.status === 'rejected') && (auth.can('property.create') || auth.can('property.edit'))) {
            <button class="btn btn-primary btn-sm" (click)="submit()"><span class="icon sm">send</span> Submit for verification</button>
          }
          @if (auth.can('verification.record') && p.status !== 'draft' && p.status !== 'rejected' && p.status !== 'rented') {
            <button class="btn btn-primary btn-sm" (click)="verifying.set(true)"><span class="icon sm">fact_check</span> Record check</button>
          }
          @if (auth.can('property.approve') && p.status === 'pending_approval') {
            <a class="btn btn-green btn-sm" routerLink="/admin/approvals"><span class="icon sm">task_alt</span> Review for approval</a>
          }
          @if (auth.can('property.approve') && p.status === 'suspended') {
            <button class="btn btn-green btn-sm" (click)="reinstate()"><span class="icon sm">publish</span> Re-publish</button>
          }
          @if (auth.can('property.suspend') && p.status === 'published') {
            <button class="btn btn-ghost btn-sm" (click)="suspending.set(!suspending())"><span class="icon sm">pause_circle</span> Suspend</button>
          }
        </div>
      </div>

      @if (suspending()) {
        <div class="panel inline-form">
          <input #why class="input" placeholder="Reason for suspending (e.g. photos reported wrong, owner paused)">
          <button class="btn btn-outline btn-sm" (click)="suspend(why.value)">Suspend listing</button>
        </div>
      }

      <div class="flags">
        @if (p.conflict) {
          <div class="flag red"><span class="icon sm">report</span>
            <div class="grow"><b>Conflicting information — availability cannot be confirmed.</b><br>{{ p.conflict }}
              @if (auth.can('property.approve')) {
                <div class="inline"><input #res class="input" placeholder="How was it resolved? (e.g. owner confirmed in writing it's available)">
                  <button class="btn btn-outline btn-sm" (click)="resolve(res.value)">Mark resolved</button></div>
              }
            </div></div>
        }
        @if (p.pendingRentChange; as c) {
          <div class="flag blue"><span class="icon sm">currency_rupee</span>
            <span>Rent change requested: {{ c.oldRent | inr }} → <b>{{ c.newRent | inr }}</b> by {{ admin.userName(c.requestedBy) }} {{ c.requestedAt | ago }} ({{ c.evidence }}).
              Public listing still shows {{ c.oldRent | inr }} until approved.
              @if (auth.can('property.approve')) { <a routerLink="/admin/approvals">Review</a> }</span></div>
        }
        @if (p.status === 'rejected' && p.rejectionReason) {
          <div class="flag amber"><span class="icon sm">block</span><span><b>Rejected:</b> {{ p.rejectionReason }}</span></div>
        }
        @if (openReports().length) {
          <div class="flag amber"><span class="icon sm">flag</span><span>{{ openReports().length }} open tenant report(s): {{ openReportsText() }}</span></div>
        }
        @if (dupCount()) {
          <div class="flag amber"><span class="icon sm">content_copy</span><span>{{ dupCount() }} possible duplicate(s) of this flat.
            @if (auth.can('duplicates.resolve')) { <a routerLink="/admin/duplicates">Review</a> }</span></div>
        }
        @if (authExpiring()) {
          <div class="flag amber"><span class="icon sm">gpp_maybe</span><span>Owner authorization expires {{ p.authorization.validTill | date: 'd MMM' }} — renew before then.</span></div>
        }
      </div>

      <div class="grid2">
        <section class="panel">
          <div class="panel-h"><h3><span class="icon">home</span> Listing</h3></div>
          <div class="panel-b lst">
            <img [src]="p.flat.images[0]" appImgFallback="interior" alt="">
            <dl class="kv">
              <dt>Rent</dt><dd><b>{{ p.flat.rent | inr }}</b> / month</dd>
              <dt>Maintenance</dt><dd>{{ p.flat.maintenance | inr }} / month · all-in {{ p.flat.rent + p.flat.maintenance | inr }}</dd>
              <dt>Deposit</dt><dd>{{ p.flat.deposit | inr }} ({{ p.flat.depositMonths }} months)</dd>
              <dt>Area · Facing</dt><dd>{{ p.flat.areaSqft }} sq.ft · {{ p.flat.facing }}</dd>
              <dt>Furnishing</dt><dd>{{ p.flat.furnishing }}</dd>
              <dt>Tenants · Pets</dt><dd>{{ p.flat.tenantType }} · {{ p.flat.petsAllowed ? 'Pets OK' : 'No pets' }}</dd>
              <dt>Parking</dt><dd>{{ p.flat.parking }}</dd>
              <dt>Available from</dt><dd>{{ p.flat.availableFrom | date: 'd MMM y' }}</dd>
              <dt>Photos</dt><dd>{{ p.flat.images.length }}</dd>
            </dl>
          </div>
        </section>

        <section class="panel">
          <div class="panel-h"><h3><span class="icon">event_available</span> Availability</h3></div>
          <div class="panel-b">
            <div class="flag" [class]="'flag ' + (fresh().tone === 'green' ? 'green' : fresh().tone === 'gray' ? 'blue' : 'amber')">
              <span class="icon sm fill">{{ fresh().icon }}</span><span>{{ fresh().text }}</span></div>
            <dl class="kv mt">
              <dt>Last confirmed</dt><dd>{{ p.lastVerifiedAt ? (p.lastVerifiedAt | date: 'd MMM, h:mm a') : 'Never' }} @if (p.lastVerifiedBy) { · {{ admin.userName(p.lastVerifiedBy) }} }</dd>
              <dt>Next check</dt><dd>{{ p.nextCheckDue | due }}</dd>
              <dt>Assigned verifier</dt><dd>{{ admin.userName(p.assignedVerifier) }}</dd>
              @if (auth.can('lead.viewAll')) { <dt>Enquiries</dt><dd>{{ leads().length }} total · {{ openLeads() }} open</dd> }
            </dl>
          </div>
        </section>

        <section class="panel">
          <div class="panel-h"><h3><span class="icon">badge</span> Ownership & sourcing</h3></div>
          <div class="panel-b">
            <dl class="kv">
              <dt>Owner</dt>
              <dd>@if (owner(); as o) { {{ o.name }} · <a [href]="'tel:' + o.phone">{{ o.phone }}</a> <span class="muted">{{ o.id }}</span> }
                @else if (!auth.can('property.viewOwner')) { <app-restricted text="Hidden for your role" /> } @else { <span class="muted">Not captured</span> }</dd>
              <dt>Authorization</dt>
              <dd>{{ p.authorization.status === 'received' ? 'Received' : p.authorization.status === 'expired' ? 'Expired' : 'Pending' }}
                @if (p.authorization.method) { · {{ p.authorization.method }} } @if (p.authorization.validTill) { · valid till {{ p.authorization.validTill | date: 'd MMM y' }} }</dd>
              <dt>Source</dt><dd>{{ admin.sourceName(p.sourceId) }} <span class="muted">{{ p.sourceId }} · {{ sourceType() }}</span></dd>
              <dt>Recorded by</dt><dd>{{ admin.userName(p.sourcedBy) }} · {{ p.sourcedAt | date: 'd MMM y, h:mm a' }}</dd>
            </dl>
            <p class="note muted"><span class="icon xs">info</span> Record time ≠ commission entitlement. Attribution disputes are resolved by a manager on evidence.</p>
          </div>
        </section>

        <section class="panel">
          <div class="panel-h"><h3><span class="icon">payments</span> Commercial terms</h3></div>
          <div class="panel-b">
            @if (p.commercial; as c) {
              <dl class="kv">
                <dt>Tenant brokerage</dt><dd>{{ c.tenantBrokerage }}</dd>
                <dt>Owner brokerage</dt><dd>{{ c.ownerBrokerage }}</dd>
                <dt>Source share</dt><dd>{{ c.sourceSharePct }}% of BHP brokerage</dd>
                <dt>Negotiation floor</dt><dd>{{ c.minAcceptableRent | inr }} <span class="muted">— offers below need approval</span></dd>
              </dl>
            } @else {
              <app-restricted text="Commercial terms are visible to the business owner and auditors only" />
            }
          </div>
        </section>
      </div>

      @if (p.intakeMessage) {
        <section class="panel mtop">
          <div class="panel-h"><h3><span class="icon">chat</span> Original intake message</h3><span class="muted">kept for evidence</span></div>
          <div class="panel-b"><blockquote>{{ p.intakeMessage }}</blockquote></div>
        </section>
      }

      <section class="panel mtop">
        <div class="panel-h"><h3><span class="icon">fact_check</span> Verification history</h3></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>When</th><th>Result</th><th>Confirmed by</th><th>Method</th><th>Checked by</th><th>Notes / evidence</th></tr></thead>
            <tbody>
              @for (v of verifications(); track v.id) {
                <tr><td>{{ v.at | date: 'd MMM, h:mm a' }}<span class="sub">{{ v.at | ago }}</span></td>
                  <td>{{ resultLabel[v.result] }} @if (v.newRent) { <span class="sub">new rent {{ v.newRent | inr }}</span> }</td>
                  <td>{{ v.confirmedBy }}</td><td>{{ v.method }}</td><td>{{ admin.userName(v.by) }}</td>
                  <td>{{ v.notes || '' }} @if (v.evidence) { <span class="sub">{{ v.evidence }}</span> }</td></tr>
              } @empty {
                <tr><td colspan="6" class="empty-row">No checks recorded yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (auth.can('audit.view')) {
        <section class="panel mtop">
          <div class="panel-h"><h3><span class="icon">history</span> Activity</h3></div>
          <div class="panel-b">
            @for (a of activity(); track a.id) {
              <div class="act"><span class="dot"></span><div><b>{{ a.action }}</b> — {{ a.detail }}
                <small class="muted">{{ admin.userName(a.actor) }} · {{ a.at | date: 'd MMM y, h:mm a' }}</small></div></div>
            } @empty { <p class="muted">No activity recorded.</p> }
          </div>
        </section>
      }

      @if (verifying()) { <app-verify-dialog [property]="p" (closed)="verifying.set(false)" /> }
    } @else {
      <div class="panel empty-row">Property not found, or you don't have access to it.
        <a routerLink="/admin/properties">Back to properties</a></div>
    }
  `,
  styles: `
    .back { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; margin-bottom: 8px; }
    h1 { display: flex; align-items: center; gap: 10px; }
    .flags { display: grid; gap: 8px; margin-bottom: 16px; &:empty { display: none; } .grow { flex: 1; } a { font-weight: 600; } }
    .inline, .inline-form { display: flex; gap: 8px; margin-top: 8px; .input { height: 36px; font-size: 13px; } }
    .inline-form { padding: 12px; margin: -6px 0 16px; }
    .lst { display: grid; grid-template-columns: 150px 1fr; gap: 16px; img { width: 150px; height: 120px; object-fit: cover; border-radius: 10px; } }
    .mt { margin-top: 14px; }
    .mtop { margin-top: 16px; }
    .note { font-size: 12.5px; margin: 14px 0 0; display: flex; gap: 4px; }
    blockquote { margin: 0; padding: 10px 14px; border-left: 3px solid var(--primary); background: #f7faff; font-size: 14px; border-radius: 0 8px 8px 0; }
    .act { display: flex; gap: 10px; padding: 6px 0; font-size: 13.5px; small { display: block; font-size: 12px; } }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); margin-top: 6px; flex: none; }
    @media (max-width: 700px) { .lst { grid-template-columns: 1fr; } }
  `,
})
export class PropertyDetailComponent {
  readonly id = input.required<string>();
  readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  private toast = inject(ToastService);
  readonly resultLabel = VERIFICATION_RESULT_LABEL;
  readonly verifying = signal(false);
  readonly suspending = signal(false);

  readonly p = computed(() => this.admin.property(this.id()));
  readonly society = computed(() => this.admin.societies.find(s => s.id === this.p()?.flat.societyId));
  readonly owner = computed(() => this.admin.owner(this.p()?.ownerId ?? null));
  readonly sourceType = computed(() => {
    const s = this.admin.sources().find(x => x.id === this.p()?.sourceId);
    return s ? SOURCE_TYPE_LABEL[s.type] : '';
  });
  readonly fresh = computed(() => { const p = this.p()!; return p.conflict ? { text: 'Unconfirmed — conflicting information', tone: 'amber', icon: 'report' } : freshnessLabel(p); });
  readonly verifications = computed(() => { this.admin.properties(); return this.admin.verificationsFor(this.id()); });
  readonly activity = computed(() => this.admin.auditFor(this.id()));
  readonly openReports = computed(() => this.admin.reports().filter(r => r.propertyId === this.id() && r.status === 'open'));
  readonly openReportsText = computed(() => this.openReports().map(r => r.reason + (r.details ? ` (“${r.details}”)` : '')).join('; '));
  readonly dupCount = computed(() => this.admin.openDuplicatesCount(this.id()));
  readonly leads = computed(() => this.admin.leads().filter(l => l.propertyId === this.id()));
  readonly openLeads = computed(() => this.leads().filter(l => !['won', 'lost'].includes(l.status)).length);
  readonly authExpiring = computed(() => {
    const p = this.p(); const t = p?.authorization.validTill;
    return !!p && p.status === 'published' && !!t && new Date(t).getTime() < Date.now() + 7 * 86_400_000;
  });

  private done(r: { ok: boolean; error?: string }, msg: string) {
    this.toast.show(r.ok ? msg : (r as { error: string }).error, r.ok ? 'success' : 'error', 4000);
  }
  submit() { this.done(this.admin.submitForVerification(this.id()), 'Submitted — a verifier has been assigned'); }
  suspend(reason: string) { const r = this.admin.suspend(this.id(), reason); this.done(r, 'Listing suspended — hidden from FindFlat'); if (r.ok) this.suspending.set(false); }
  reinstate() { this.done(this.admin.approve(this.id()), 'Listing re-published'); }
  resolve(note: string) {
    if (!note.trim()) { this.toast.show('Describe how it was resolved.', 'error'); return; }
    this.done(this.admin.resolveConflict(this.id(), note), 'Conflict resolved — please record a fresh availability check');
  }
}
