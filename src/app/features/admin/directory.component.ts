import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/admin/admin.service';
import { AuthService } from '../../core/admin/auth.service';
import { SOURCE_TYPE_LABEL } from '../../core/admin/admin.models';
import { freshness } from '../../core/policy/availability';
import { ADMIN_UI } from './ui';

/** Masters: societies, sources & agents (with transparent performance), owners. */
@Component({
  selector: 'app-directory',
  imports: [DatePipe, FormsModule, RouterLink, ...ADMIN_UI],
  template: `
    <div class="pg-h"><div><h1>{{ title() }}</h1><p>{{ subtitle() }}</p></div></div>
    <div class="tabs">
      @if (auth.can('society.view')) { <a routerLink="/admin/societies" [class.on]="tab() === 'societies'">Societies</a> }
      @if (auth.can('source.view')) { <a routerLink="/admin/sources" [class.on]="tab() === 'sources'">Sources & agents</a> }
      @if (auth.can('owner.view')) { <a routerLink="/admin/owners" [class.on]="tab() === 'owners'">Owners</a> }
    </div>
    <div class="filters"><input class="input grow" placeholder="Search…" [ngModel]="q()" (ngModelChange)="q.set($event)"></div>

    <div class="panel tbl-wrap">
      @switch (tab()) {
        @case ('societies') {
          <table class="tbl">
            <thead><tr><th>Society</th><th>Builder</th><th class="num">Towers · Units</th><th>BHK types</th><th class="num">Records</th><th class="num">Live</th><th class="num">Confirmed</th></tr></thead>
            <tbody>
              @for (s of societies(); track s.id) {
                <tr><td><b>{{ s.name }}</b><span class="sub">{{ s.locality }} · {{ s.pincode }}</span></td><td>{{ s.builder }}</td>
                  <td class="num">{{ s.towers }} · {{ s.totalUnits }}</td><td>{{ s.bhkTypes.join(', ') }}</td>
                  <td class="num">{{ s.records }}</td><td class="num">{{ s.live }}</td><td class="num">{{ s.confirmed }}</td></tr>
              }
            </tbody>
          </table>
        }
        @case ('sources') {
          <table class="tbl">
            <thead><tr><th>Source</th><th>Type</th><th>Phone</th><th class="num">Submitted</th><th class="num">Approved</th><th class="num">Rejected</th><th class="num">Rented</th>
              @if (auth.can('property.viewCommercial')) { <th class="num">Default share</th> }<th>Since</th></tr></thead>
            <tbody>
              @for (s of sources(); track s.id) {
                <tr><td><b>{{ s.name }}</b><span class="sub">{{ s.id }}{{ s.notes ? ' · ' + s.notes : '' }}</span></td><td>{{ typeLabel[s.type] }}</td><td>{{ s.phone }}</td>
                  <td class="num">{{ s.submitted }}</td><td class="num">{{ s.approved }}</td><td class="num">{{ s.rejected }}</td><td class="num">{{ s.rented }}</td>
                  @if (auth.can('property.viewCommercial')) { <td class="num">{{ s.defaultSharePct }}%</td> }
                  <td>{{ s.joinedAt | date: 'MMM y' }}</td></tr>
              }
            </tbody>
          </table>
          <p class="note muted"><span class="icon xs">info</span> Counts are plain facts from records — no automatic scoring or blacklisting. Use them to decide how much verification effort a source needs.</p>
        }
        @case ('owners') {
          <table class="tbl">
            <thead><tr><th>Owner</th><th>Phone</th><th>Email</th><th>Properties</th><th>Since</th></tr></thead>
            <tbody>
              @for (o of owners(); track o.id) {
                <tr><td><b>{{ o.name }}</b><span class="sub">{{ o.id }}</span></td><td>{{ o.phone }}</td><td>{{ o.email || '—' }}</td>
                  <td>@for (p of o.props; track p) { <a [routerLink]="['/admin/properties', p]">{{ p }}</a>&nbsp; } @empty { <span class="muted">—</span> }</td>
                  <td>{{ o.createdAt | date: 'd MMM y' }}</td></tr>
              }
            </tbody>
          </table>
        }
      }
    </div>
  `,
  styles: `.note { font-size: 12.5px; padding: 10px 14px; margin: 0; display: flex; gap: 4px; }`,
})
export class DirectoryComponent {
  readonly tab = input<'societies' | 'sources' | 'owners'>('societies');
  readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  readonly typeLabel = SOURCE_TYPE_LABEL;
  readonly q = signal('');

  readonly title = computed(() => ({ societies: 'Societies', sources: 'Sources & agents', owners: 'Owners' })[this.tab()]);
  readonly subtitle = computed(() => ({
    societies: 'Society master — every property belongs to exactly one society.',
    sources: 'Everyone who brings inventory to BHP, with what they have actually delivered.',
    owners: 'Owner contacts are restricted — access is logged in production.',
  })[this.tab()]);

  private match(text: string) { const q = this.q().trim().toLowerCase(); return !q || text.toLowerCase().includes(q); }

  readonly societies = computed(() => {
    const ps = this.admin.properties();
    return this.admin.societies.filter(s => this.match(`${s.name} ${s.locality} ${s.builder}`)).map(s => {
      const mine = ps.filter(p => p.flat.societyId === s.id);
      const live = mine.filter(p => p.status === 'published' && p.availability !== 'rented');
      return { ...s, records: mine.length, live: live.length, confirmed: live.filter(p => !p.conflict && freshness(p) === 'confirmed').length };
    });
  });

  readonly sources = computed(() => {
    const ps = this.admin.properties();
    return this.admin.sources().filter(s => this.match(`${s.name} ${s.id} ${s.company ?? ''}`)).map(s => {
      const mine = ps.filter(p => p.sourceId === s.id);
      return {
        ...s, submitted: mine.length,
        approved: mine.filter(p => ['published', 'rented', 'suspended'].includes(p.status)).length,
        rejected: mine.filter(p => p.status === 'rejected').length,
        rented: mine.filter(p => p.status === 'rented').length,
      };
    });
  });

  readonly owners = computed(() => {
    const ps = this.admin.properties();
    return this.admin.owners().filter(o => this.match(`${o.name} ${o.phone} ${o.id}`))
      .map(o => ({ ...o, props: ps.filter(p => p.ownerId === o.id).map(p => p.id) }));
  });
}
