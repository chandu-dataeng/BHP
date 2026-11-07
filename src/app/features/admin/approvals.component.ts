import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/admin/admin.service';
import { AuthService } from '../../core/admin/auth.service';
import { PropertyRecord } from '../../core/admin/admin.models';
import { canPublish } from '../../core/admin/publish-rules';
import { ToastService } from '../../core/services/toast.service';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { ADMIN_UI } from './ui';

/** Publish approvals + rent change approvals. A listing goes live only when every check passes. */
@Component({
  selector: 'app-approvals',
  imports: [RouterLink, InrPipe, ImgFallbackDirective, ...ADMIN_UI],
  template: `
    <div class="pg-h">
      <div><h1>Approvals</h1><p>Nothing reaches FindFlat — and no public price changes — without a manager's approval.</p></div>
    </div>

    <div class="tabs">
      <button [class.on]="tab() === 'listings'" (click)="tab.set('listings')">Listings ({{ listings().length }})</button>
      <button [class.on]="tab() === 'rent'" (click)="tab.set('rent')">Rent changes ({{ rentChanges().length }})</button>
    </div>

    @if (tab() === 'listings') {
      @for (p of listings(); track p.id) {
        <section class="panel item">
          <img [src]="p.flat.images[0]" appImgFallback="interior" alt="">
          <div class="info">
            <div class="ttl">
              <a [routerLink]="['/admin/properties', p.id]"><h3>{{ p.id }} · {{ p.flat.bhk }} BHK, {{ society(p.flat.societyId) }}</h3></a>
              <app-status [status]="p.status" />
            </div>
            <p class="muted">Tower {{ p.tower }} / {{ p.flatNo }} · {{ p.flat.areaSqft }} sq.ft · {{ p.flat.rent | inr }} + {{ p.flat.maintenance | inr }} ·
              sourced by {{ admin.userName(p.sourcedBy) }} via {{ admin.sourceName(p.sourceId) }} {{ p.sourcedAt | ago }}</p>
            <div class="checks">
              @for (c of admin.publishChecks(p); track c.key) {
                <div class="chk"><span class="icon fill" [class.ok]="c.ok" [class.no]="!c.ok">{{ c.ok ? 'check_circle' : 'cancel' }}</span>
                  <span>{{ c.label }} @if (c.detail) { <small>{{ c.detail }}</small> }</span></div>
              }
            </div>
            @if (p.sourcedBy === auth.user()?.id) {
              <div class="flag amber"><span class="icon sm">rule</span> You sourced this property — another manager must approve it (separation of duties).</div>
            }
          </div>
          <div class="acts">
            <button class="btn btn-green btn-sm" [disabled]="!ready(p) || p.sourcedBy === auth.user()?.id" (click)="approve(p)"><span class="icon sm">publish</span> Publish</button>
            @if (rejecting() === p.id) {
              <textarea #why class="input" rows="2" placeholder="Reason (shared with the sourcer)"></textarea>
              <button class="btn btn-outline btn-sm" (click)="reject(p, why.value)">Confirm reject</button>
            } @else {
              <button class="btn btn-ghost btn-sm" (click)="rejecting.set(p.id)">Reject…</button>
            }
          </div>
        </section>
      } @empty {
        <div class="panel empty-row">No listings waiting for approval.</div>
      }
    } @else {
      <div class="panel tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Property</th><th class="num">Current</th><th class="num">Requested</th><th class="num">Change</th><th>Requested by</th><th>Evidence</th><th></th></tr></thead>
          <tbody>
            @for (p of rentChanges(); track p.id) {
              <tr>
                <td><a [routerLink]="['/admin/properties', p.id]"><b>{{ p.id }}</b></a><span class="sub">{{ p.flat.bhk }} BHK · {{ society(p.flat.societyId) }}</span></td>
                <td class="num">{{ p.pendingRentChange!.oldRent | inr }}</td>
                <td class="num"><b>{{ p.pendingRentChange!.newRent | inr }}</b></td>
                <td class="num" [class.down]="p.pendingRentChange!.newRent < p.pendingRentChange!.oldRent">{{ pct(p) }}</td>
                <td>{{ admin.userName(p.pendingRentChange!.requestedBy) }}<span class="sub">{{ p.pendingRentChange!.requestedAt | ago }}</span></td>
                <td>{{ p.pendingRentChange!.evidence }}</td>
                <td class="nowrap">
                  <button class="btn btn-green btn-sm" (click)="rent(p, true)">Approve</button>
                  <button class="btn btn-ghost btn-sm" (click)="rent(p, false)">Reject</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="empty-row">No rent changes waiting.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .item { display: grid; grid-template-columns: 140px 1fr 190px; gap: 16px; padding: 14px; margin-bottom: 12px;
      img { width: 140px; height: 110px; object-fit: cover; border-radius: 10px; } }
    .ttl { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; h3 { font-size: 16px; color: var(--text); } }
    .info p { font-size: 13px; margin: 4px 0 8px; }
    .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; margin-bottom: 8px; }
    .acts { display: flex; flex-direction: column; gap: 8px; textarea { font-size: 13px; } }
    .down { color: #b4123f; }
    .nowrap { white-space: nowrap; .btn + .btn { margin-left: 6px; } }
    @media (max-width: 900px) { .item { grid-template-columns: 1fr; } .checks { grid-template-columns: 1fr; } }
  `,
})
export class ApprovalsComponent {
  readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  private toast = inject(ToastService);
  readonly tab = signal<'listings' | 'rent'>('listings');
  readonly rejecting = signal<string | null>(null);

  readonly listings = computed(() => this.admin.approvalQueue().filter(p => p.status === 'pending_approval'));
  readonly rentChanges = computed(() => this.admin.approvalQueue().filter(p => p.pendingRentChange));

  society(id: string) { return this.admin.societies.find(s => s.id === id)?.name ?? id; }
  ready(p: PropertyRecord) { return canPublish(this.admin.publishChecks(p)); }
  pct(p: PropertyRecord) {
    const c = p.pendingRentChange!; const v = Math.round((c.newRent - c.oldRent) / c.oldRent * 1000) / 10;
    return `${v > 0 ? '+' : ''}${v}%`;
  }

  approve(p: PropertyRecord) {
    const r = this.admin.approve(p.id);
    this.toast.show(r.ok ? `${p.id} is live on FindFlat` : r.error, r.ok ? 'success' : 'error', 4000);
  }
  reject(p: PropertyRecord, reason: string) {
    const r = this.admin.reject(p.id, reason);
    this.toast.show(r.ok ? `${p.id} rejected` : r.error, r.ok ? 'info' : 'error');
    if (r.ok) this.rejecting.set(null);
  }
  rent(p: PropertyRecord, approve: boolean) {
    const r = this.admin.decideRentChange(p.id, approve);
    this.toast.show(r.ok ? (approve ? 'Rent updated on the public listing' : 'Rent change rejected') : r.error, r.ok ? 'success' : 'error', 4000);
  }
}
