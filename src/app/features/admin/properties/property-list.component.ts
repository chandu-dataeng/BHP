import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/admin/auth.service';
import { ListingStatus, PropertyRecord, STATUS_LABEL } from '../../../core/admin/admin.models';
import { Freshness, freshness } from '../../../core/policy/availability';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { ADMIN_UI } from '../ui';

const FRESH_LABEL: Record<Freshness, string> = { confirmed: 'Confirmed', stale: 'Stale', unverified: 'Unconfirmed', on_hold: 'On hold', rented: 'Rented' };

@Component({
  selector: 'app-property-list',
  imports: [FormsModule, RouterLink, InrPipe, ...ADMIN_UI],
  template: `
    <div class="pg-h">
      <div><h1>{{ isAgent() ? 'My submissions' : 'Properties' }}</h1>
        <p>{{ rows().length }} of {{ admin.properties().length }} records · one record per physical flat, listings keep their history</p></div>
      <div class="acts">
        @if (auth.can('property.create') || auth.can('property.edit')) {
          <a class="btn btn-outline btn-sm" routerLink="/admin/properties/import"><span class="icon sm">upload_file</span> Bulk import (Google Sheets)</a>
        }
        <a *appCan="'property.create'" class="btn btn-primary btn-sm" routerLink="/admin/properties/new"><span class="icon sm">add_home</span> Add property</a>
      </div>
    </div>

    <div class="filters">
      <input class="input grow" placeholder="Search ID, society, tower / flat no., locality…" [ngModel]="q()" (ngModelChange)="q.set($event)">
      <select class="input" [ngModel]="statusF()" (ngModelChange)="statusF.set($event)">
        <option value="">All statuses</option>
        <option value="pipeline">In pipeline</option>
        @for (s of statuses; track s) { <option [value]="s">{{ label[s] }}</option> }
      </select>
      <select class="input" [ngModel]="freshF()" (ngModelChange)="freshF.set($event)">
        <option value="">Any availability</option>
        @for (f of freshOpts; track f) { <option [value]="f">{{ freshLabel[f] }}</option> }
      </select>
      <select class="input" [ngModel]="socF()" (ngModelChange)="socF.set($event)">
        <option value="">All societies</option>
        @for (s of admin.societies; track s.id) { <option [value]="s.id">{{ s.name }}</option> }
      </select>
      @if (q() || statusF() || freshF() || socF()) { <button class="btn btn-ghost btn-sm" (click)="clear()">Clear</button> }
    </div>

    <div class="panel tbl-wrap">
      <table class="tbl">
        <thead><tr>
          <th>Property</th><th>Society · Unit</th><th class="num">Rent</th><th>Status</th><th>Availability</th>
          @if (!isAgent()) { <th>Source</th> }
          <th>Owner</th><th>Updated</th>
        </tr></thead>
        <tbody>
          @for (p of rows(); track p.id) {
            <tr class="click" (click)="open(p)">
              <td><b>{{ p.id }}</b><span class="sub">{{ p.flat.bhk }} BHK · {{ p.flat.areaSqft }} sq.ft · {{ p.flat.furnishing }}</span></td>
              <td>{{ society(p.flat.societyId) }}<span class="sub">Tower {{ p.tower || '?' }} · Flat {{ p.flatNo || '?' }} · Fl {{ p.flat.floor }}</span></td>
              <td class="num">{{ p.flat.rent | inr }}<span class="sub">+ {{ p.flat.maintenance | inr }}</span>
                @if (p.pendingRentChange) { <span class="sub chg">→ {{ p.pendingRentChange.newRent | inr }} pending</span> }</td>
              <td><app-status [status]="p.status" /></td>
              <td>
                @if (p.conflict) { <span class="fr red"><span class="icon xs">report</span>Conflict</span> }
                @else { <span class="fr" [class]="'fr ' + fr(p)">{{ freshLabel[fr(p)] }}</span> }
                <span class="sub">{{ p.lastVerifiedAt ? ('checked ' + (p.lastVerifiedAt | ago)) : 'never checked' }}</span>
              </td>
              @if (!isAgent()) { <td>{{ admin.sourceName(p.sourceId) }}<span class="sub">{{ p.sourceId }}</span></td> }
              <td>
                @if (p.ownerId) { {{ admin.owner(p.ownerId)?.name }} } @else if (!auth.can('property.viewOwner')) { <app-restricted /> } @else { <span class="muted">—</span> }
              </td>
              <td>{{ p.updatedAt | ago }}<span class="sub">by {{ admin.userName(p.sourcedBy) }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="empty-row">No properties match these filters.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .fr { display: inline-flex; gap: 3px; align-items: center; font-size: 12.5px; font-weight: 600;
      &.confirmed { color: var(--green-text); } &.stale, &.unverified, &.on_hold { color: #9a6200; } &.rented { color: var(--muted); } &.red { color: #b4123f; } }
    .chg { color: var(--primary-dark) !important; font-weight: 600; }
  `,
})
export class PropertyListComponent {
  /** ?status=… / ?fresh=… from dashboard links */
  readonly status = input<string>();
  readonly fresh = input<string>();

  readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  private router = inject(Router);

  readonly label = STATUS_LABEL;
  readonly freshLabel = FRESH_LABEL;
  readonly statuses = Object.keys(STATUS_LABEL) as ListingStatus[];
  readonly freshOpts = Object.keys(FRESH_LABEL) as Freshness[];

  readonly q = signal('');
  readonly statusF = signal('');
  readonly freshF = signal('');
  readonly socF = signal('');
  readonly isAgent = computed(() => this.auth.user()?.role === 'agent');

  constructor() {
    effect(() => { const s = this.status(); if (s) this.statusF.set(s); });
    effect(() => { const f = this.fresh(); if (f) this.freshF.set(f); });
  }

  fr(p: PropertyRecord) { return freshness(p); }
  society(id: string) { return this.admin.societies.find(s => s.id === id)?.name ?? id; }

  readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    const st = this.statusF();
    return this.admin.properties()
      .filter(p => !st || (st === 'pipeline' ? ['draft', 'pending_verification', 'pending_approval'].includes(p.status) : p.status === st))
      .filter(p => !this.freshF() || (freshness(p) === this.freshF() && !p.conflict))
      .filter(p => !this.socF() || p.flat.societyId === this.socF())
      .filter(p => {
        if (!q) return true;
        const s = this.admin.societies.find(x => x.id === p.flat.societyId);
        return `${p.id} ${s?.name} ${s?.locality} ${p.tower} ${p.flatNo} ${p.flat.bhk}bhk ${p.sourceId}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  clear() { this.q.set(''); this.statusF.set(''); this.freshF.set(''); this.socF.set(''); }
  open(p: PropertyRecord) { this.router.navigate(['/admin/properties', p.id]); }
}
