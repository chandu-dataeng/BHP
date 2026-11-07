import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AMENITY_META } from '../../core/data/amenities';
import { NearbyCategory } from '../../core/models/common.models';
import { RentalFlat, Society } from '../../core/models/rent.models';
import { freshnessLabel, totalMonthly } from '../../core/policy/availability';
import { PropertyService } from '../../core/services/property.service';
import { CompareService } from '../../core/services/compare.service';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { InrPipe } from '../../shared/pipes/inr.pipe';

interface Item { f: RentalFlat; s?: Society; }
interface Cell { text: string; best?: boolean; yes?: boolean; no?: boolean; }
interface Row { label: string; icon: string; cells: Cell[]; }
interface Group { title: string; icon: string; rows: Row[]; }

const inr = (v: number) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v);
const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Marks the winning cell(s) of a numeric row — only when the values actually differ. */
function rated(items: Item[], label: string, icon: string, get: (i: Item) => number | undefined, fmt: (n: number) => string, better?: 'low' | 'high'): Row {
  const vals = items.map(get);
  const nums = vals.filter((v): v is number => v !== undefined && Number.isFinite(v));
  const target = better && nums.length > 1 && new Set(nums).size > 1 ? (better === 'low' ? Math.min(...nums) : Math.max(...nums)) : undefined;
  return { label, icon, cells: vals.map(v => ({ text: v === undefined || !Number.isFinite(v) ? '—' : fmt(v), best: target !== undefined && v === target })) };
}
const text = (items: Item[], label: string, icon: string, get: (i: Item) => string | undefined): Row =>
  ({ label, icon, cells: items.map(i => ({ text: get(i) ?? '—' })) });
const yesNo = (items: Item[], label: string, icon: string, get: (i: Item) => boolean): Row =>
  ({ label, icon, cells: items.map(i => get(i) ? { text: 'Yes', yes: true } : { text: 'No', no: true }) });

function buildGroups(items: Item[]): Group[] {
  const perSqft = (i: Item) => i.f.areaSqft ? i.f.rent / i.f.areaSqft : undefined;
  const groups: Group[] = [
    { title: 'Cost', icon: 'payments', rows: [
      rated(items, 'Rent / month', 'currency_rupee', i => i.f.rent, inr, 'low'),
      rated(items, 'Maintenance / month', 'build', i => i.f.maintenance, inr, 'low'),
      rated(items, 'Total monthly', 'account_balance_wallet', i => totalMonthly(i.f), inr, 'low'),
      rated(items, 'Security deposit', 'savings', i => i.f.deposit, inr, 'low'),
      text(items, 'Deposit (months of rent)', 'calendar_view_month', i => `${i.f.depositMonths} months`),
    ] },
    { title: 'Space & layout', icon: 'square_foot', rows: [
      rated(items, 'BHK', 'bed', i => i.f.bhk, n => `${n} BHK`, 'high'),
      rated(items, 'Area', 'straighten', i => i.f.areaSqft, n => `${n.toLocaleString('en-IN')} sq.ft`, 'high'),
      rated(items, 'Rent per sq.ft', 'price_check', perSqft, n => `₹${n.toFixed(1)}`, 'low'),
      rated(items, 'Bathrooms', 'bathtub', i => i.f.bathrooms, String, 'high'),
      rated(items, 'Balconies', 'balcony', i => i.f.balconies, String, 'high'),
      text(items, 'Floor', 'layers', i => `${i.f.floor} of ${i.f.totalFloors}`),
      text(items, 'Facing', 'explore', i => i.f.facing),
      text(items, 'Furnishing', 'chair', i => i.f.furnishing),
      text(items, 'Property age', 'calendar_month', i => i.f.propertyAge),
    ] },
    { title: 'Tenancy', icon: 'key', rows: [
      { ...rated(items, 'Available from', 'event', i => new Date(i.f.availableFrom).getTime(), n => date(new Date(n).toISOString()), 'low') },
      text(items, 'Tenants allowed', 'group', i => i.f.tenantType),
      text(items, 'Parking', 'local_parking', i => i.f.parking),
      yesNo(items, 'Pets allowed', 'pets', i => i.f.petsAllowed),
    ] },
    { title: 'Trust', icon: 'verified', rows: [
      yesNo(items, 'Verified by BHP team', 'verified', i => i.f.verified),
      text(items, 'Availability', 'event_available', i => freshnessLabel(i.f).short),
      text(items, 'Property code', 'tag', i => i.f.code),
    ] },
    { title: 'Society', icon: 'apartment', rows: [
      text(items, 'Society', 'domain', i => i.s?.name),
      text(items, 'Locality', 'location_on', i => i.s ? `${i.s.locality}, ${i.s.city}` : undefined),
      rated(items, 'Rating', 'star', i => i.s?.rating, n => `${n.toFixed(1)} ★`, 'high'),
      text(items, 'Reviews', 'reviews', i => i.s ? String(i.s.reviewsCount) : undefined),
      rated(items, 'Built in', 'construction', i => i.s?.completedYear, String, 'high'),
      text(items, 'Towers · Units', 'location_city', i => i.s ? `${i.s.towers} towers · ${i.s.totalUnits} units` : undefined),
      rated(items, 'Campus size', 'park', i => i.s?.totalAcres, n => `${n} acres`),
      rated(items, 'Amenities', 'fitness_center', i => i.s?.amenities.length, n => `${n} amenities`, 'high'),
    ] },
  ];

  // every amenity offered by at least one of the societies
  const keys = [...new Set(items.flatMap(i => i.s?.amenities ?? []))];
  if (keys.length) {
    groups.push({ title: 'Amenity checklist', icon: 'checklist', rows: keys
      .map(k => yesNo(items, AMENITY_META[k].label, AMENITY_META[k].icon, i => !!i.s?.amenities.includes(k)))
      .sort((a, b) => b.cells.filter(c => c.yes).length - a.cells.filter(c => c.yes).length) });
  }

  // nearest place of each category (closest wins)
  const cats = [...new Set(items.flatMap(i => i.s?.nearby.map(n => n.category) ?? []))] as NearbyCategory[];
  if (cats.length) {
    const nearest = (i: Item, c: NearbyCategory) => i.s?.nearby.filter(n => n.category === c).sort((a, b) => a.distanceKm - b.distanceKm)[0];
    groups.push({ title: 'Nearby', icon: 'near_me', rows: cats.map(c => {
      const row = rated(items, `Nearest ${c}`, 'place', i => nearest(i, c)?.distanceKm, n => `${n} km`, 'low');
      row.cells.forEach((cell, idx) => { const n = nearest(items[idx], c); if (n) cell.text = `${n.distanceKm} km · ${n.name} (${n.minutes} min)`; });
      return row;
    }) });
  }
  return groups;
}

/** RENT · compare up to 3 saved flats side by side. The URL (?ids=a,b,c) is the state, so it can be shared. */
@Component({
  selector: 'app-compare',
  imports: [RouterLink, ImgFallbackDirective, InrPipe],
  template: `
    <div class="container wrap">
      <a class="back" routerLink="/saved"><span class="icon xs">arrow_back</span> Saved properties</a>
      <div class="top">
        <div><h1>Compare flats</h1>
          <p class="muted">Side by side, up to {{ max }} flats. The best value in each row is highlighted.</p></div>
        @if (items().length > 1) {
          <label class="diff"><input type="checkbox" [checked]="diffOnly()" (change)="diffOnly.set(!diffOnly())"> Show differences only</label>
        }
      </div>

      @if (loading()) {
        <div class="card empty"><span class="icon lg spin">progress_activity</span></div>
      } @else if (items().length < 2) {
        <div class="card empty">
          <span class="icon lg">compare_arrows</span>
          <h3>Pick at least 2 flats to compare</h3>
          <p class="muted">@if (missing()) { Some of the flats are no longer available. } Save flats with the heart, then tick <b>Compare</b> on 2 or 3 of them.</p>
          <a class="btn btn-primary" routerLink="/saved">Go to saved properties</a>
        </div>
      } @else {
        <div class="scroller">
          <table class="cmp">
            <thead>
              <tr>
                <th class="lab"></th>
                @for (i of items(); track i.f.id) {
                  <th>
                    <div class="fc">
                      <button class="x" (click)="remove(i.f.id)" title="Remove from comparison" aria-label="Remove from comparison"><span class="icon xs">close</span></button>
                      <a [routerLink]="['/rent/flat', i.f.id]"><img [src]="i.f.images[0]" appImgFallback="interior" alt="">
                        <b class="t">{{ i.f.title }}</b></a>
                      <span class="muted s">{{ i.s?.name }}</span>
                      <span class="p">{{ i.f.rent | inr }}<small class="muted"> / month</small></span>
                    </div>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (g of visibleGroups(); track g.title) {
                <tr class="g"><th [attr.colspan]="items().length + 1"><span class="icon sm">{{ g.icon }}</span> {{ g.title }}</th></tr>
                @for (r of g.rows; track r.label) {
                  <tr>
                    <th class="lab" scope="row"><span class="icon xs">{{ r.icon }}</span> {{ r.label }}</th>
                    @for (c of r.cells; track $index) {
                      <td [class.best]="c.best" [class.yes]="c.yes" [class.no]="c.no">
                        @if (c.yes) { <span class="icon sm fill">check_circle</span> }
                        @else if (c.no) { <span class="icon sm">cancel</span> }
                        {{ c.text }}
                        @if (c.best) { <span class="tag">Best</span> }
                      </td>
                    }
                  </tr>
                }
              } @empty {
                <tr><td [attr.colspan]="items().length + 1" class="none">These flats are identical on every feature.</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (items().length < max) {
          <p class="more"><a class="btn btn-outline btn-sm" routerLink="/saved"><span class="icon sm">add</span> Add another flat ({{ items().length }}/{{ max }})</a></p>
        }
      }
    </div>
  `,
  styles: `
    .wrap { padding-top: 24px; padding-bottom: 48px; }
    .back { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; margin-bottom: 8px; }
    .top { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;
      h1 { font-size: 26px; font-weight: 800; } p { margin: 4px 0 0; } }
    .diff { display: flex; gap: 6px; align-items: center; font-size: 13.5px; cursor: pointer; }
    .empty { text-align: center; padding: 40px; .icon { color: var(--primary); font-size: 44px; } h3 { margin: 8px 0 4px; } p { margin: 0 0 14px; } }
    .scroller { overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; background: #fff; }
    .cmp { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 640px; table-layout: fixed;
      th, td { padding: 11px 14px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--border); font-size: 14px; }
      thead th { vertical-align: top; background: #fff; }
      .lab { width: 190px; position: sticky; left: 0; background: #fff; z-index: 1; font-weight: 600; font-size: 13px; color: var(--muted);
        .icon { vertical-align: -3px; margin-right: 4px; } }
      tr.g th { background: var(--gray-soft); font-size: 13.5px; font-weight: 700; color: var(--text); .icon { color: var(--primary); vertical-align: -5px; margin-right: 4px; } }
      tbody tr:last-child td, tbody tr:last-child th { border-bottom: 0; } }
    .fc { position: relative; display: flex; flex-direction: column; gap: 4px; padding-top: 2px;
      img { width: 100%; height: 130px; object-fit: cover; border-radius: 10px; background: #dfe6ee; margin-bottom: 8px; }
      .t { display: block; font-size: 15px; color: var(--text); line-height: 1.3; } .s { font-size: 12.5px; }
      .p { font-size: 18px; font-weight: 800; color: var(--primary); small { font-size: 12px; font-weight: 400; } } }
    .x { position: absolute; top: 6px; right: 6px; z-index: 1; width: 26px; height: 26px; border-radius: 50%; border: 0; cursor: pointer;
      background: rgba(255, 255, 255, .92); box-shadow: 0 1px 4px rgba(0, 0, 0, .25); display: grid; place-items: center; }
    td.best { background: var(--green-soft); color: var(--green-text); font-weight: 600; }
    td.yes .icon { color: var(--green); vertical-align: -5px; } td.no { color: var(--muted); .icon { vertical-align: -5px; } }
    .tag { margin-left: 6px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; background: var(--green); color: #fff; border-radius: 4px; padding: 1px 5px; vertical-align: 1px; }
    .none { text-align: center; color: var(--muted); padding: 24px; }
    .more { margin: 14px 0 0; }
    .spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 640px) { .cmp .lab { width: 120px; } .cmp th, .cmp td { padding: 9px 10px; font-size: 13px; } }
  `,
})
export class CompareComponent {
  /** Comma-separated flat ids from the `?ids=` query parameter. */
  readonly ids = input<string>('');
  readonly max = CompareService.MAX;

  private api = inject(PropertyService);
  private router = inject(Router);
  private picked = inject(CompareService);

  private flats = toSignal(this.api.getFlats());
  private societies = toSignal(this.api.getSocieties());

  readonly diffOnly = signal(false);
  readonly loading = computed(() => !this.flats() || !this.societies());
  private idList = computed(() => [...new Set((this.ids() ?? '').split(',').map(s => s.trim()).filter(Boolean))].slice(0, CompareService.MAX));

  /** Flats that exist and are still public, in the order they were picked. */
  readonly items = computed<Item[]>(() => {
    const flats = this.flats() ?? [], socs = this.societies() ?? [];
    return this.idList().flatMap(id => {
      const f = flats.find(x => x.id === id);
      return f ? [{ f, s: socs.find(s => s.id === f.societyId) }] : [];
    });
  });
  readonly missing = computed(() => this.idList().length - this.items().length);

  private groups = computed(() => buildGroups(this.items()));
  readonly visibleGroups = computed(() => {
    if (!this.diffOnly()) return this.groups();
    return this.groups()
      .map(g => ({ ...g, rows: g.rows.filter(r => new Set(r.cells.map(c => c.text)).size > 1) }))
      .filter(g => g.rows.length);
  });

  remove(id: string) {
    const next = this.items().map(i => i.f.id).filter(x => x !== id);
    if (this.picked.has(id)) this.picked.toggle(id);
    this.router.navigate([], { queryParams: { ids: next.join(',') || null }, replaceUrl: true });
  }
}
