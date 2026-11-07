import { Component, WritableSignal, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PropertyService } from '../../core/services/property.service';
import { BudgetType, Furnishing, RentalFlat, Society, TenantType } from '../../core/models/rent.models';
import { freshness, totalMonthly } from '../../core/policy/availability';
import { MapComponent, MapMarker } from '../../shared/components/map/map.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { SocietyDialogComponent } from './society-dialog.component';

interface SocietyRow { society: Society; flats: RentalFlat[]; matching: RentalFlat[]; minRent: number; }

/** RENT · Screen ① — map of societies with filters + result list. */
@Component({
  selector: 'app-rent-map',
  imports: [FormsModule, RouterLink, MapComponent, DropdownComponent, ImgFallbackDirective, InrPipe, SocietyDialogComponent],
  templateUrl: './rent-map.component.html',
  styleUrl: './rent-map.component.scss',
})
export class RentMapComponent {
  /** ?q=Gachibowli from the home page */
  readonly q = input<string>();

  private api = inject(PropertyService);
  private map = viewChild(MapComponent);

  private societies = toSignal(this.api.getSocieties(), { initialValue: [] as Society[] });
  private flats = toSignal(this.api.getFlats(), { initialValue: [] as RentalFlat[] });
  readonly loading = computed(() => !this.societies().length);

  // ---- filters ----
  readonly search = signal('');
  readonly bhk = signal<number[]>([]);
  readonly maxRent = signal<number | null>(null);
  readonly budgetType = signal<BudgetType>('total');   // tenants usually mean rent + maintenance
  readonly furnishing = signal<Furnishing[]>([]);
  readonly tenant = signal<TenantType | null>(null);
  readonly verifiedOnly = signal(false);             // = availability confirmed within the freshness window

  readonly bhkOptions = [1, 2, 3, 4];
  readonly rentOptions = [20000, 30000, 40000, 60000, 80000];
  readonly furnishOptions: Furnishing[] = ['Furnished', 'Semi Furnished', 'Unfurnished'];
  readonly tenantOptions: TenantType[] = ['Family Only', 'Bachelors Only', 'Both Allowed'];

  // ---- UI state ----
  readonly selectedId = signal<string | null>(null);
  readonly hoveredId = signal<string | null>(null);
  readonly mobileView = signal<'list' | 'map'>('map');

  constructor() {
    effect(() => { const q = this.q(); if (q) this.search.set(q); });
  }

  readonly flatFilterActive = computed(() =>
    this.bhk().length > 0 || this.maxRent() != null || this.furnishing().length > 0 || this.tenant() != null || this.verifiedOnly());

  readonly activeCount = computed(() =>
    [this.bhk().length, this.maxRent() != null, this.furnishing().length, this.tenant() != null, this.verifiedOnly()].filter(Boolean).length);

  private flatMatches(f: RentalFlat) {
    if (this.bhk().length && !this.bhk().includes(f.bhk)) return false;
    if (this.maxRent() != null && this.cost(f) > this.maxRent()!) return false;
    if (this.furnishing().length && !this.furnishing().includes(f.furnishing)) return false;
    const t = this.tenant();
    if (t && f.tenantType !== t && f.tenantType !== 'Both Allowed') return false;
    if (this.verifiedOnly() && freshness(f) !== 'confirmed') return false;
    return true;
  }

  readonly rows = computed<SocietyRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    return this.societies()
      .filter(s => !term || `${s.name} ${s.locality} ${s.builder} ${s.pincode}`.toLowerCase().includes(term))
      .map(s => {
        const flats = this.flats().filter(f => f.societyId === s.id);
        const matching = flats.filter(f => this.flatMatches(f));
        return { society: s, flats, matching, minRent: matching.length ? Math.min(...matching.map(f => this.cost(f))) : 0 };
      })
      .filter(r => !this.flatFilterActive() || r.matching.length > 0);
  });

  readonly totalFlats = computed(() => this.rows().reduce((n, r) => n + r.matching.length, 0));

  readonly markers = computed<MapMarker[]>(() => this.rows().map(r => ({
    id: r.society.id, lat: r.society.lat, lng: r.society.lng,
    title: r.society.name, subtitle: r.society.bhkTypes.map(b => `${b}BHK`).join(' | '),
  })));

  readonly selected = computed(() => this.rows().find(r => r.society.id === this.selectedId()) ?? null);

  /** The monthly number the budget filter compares against. */
  cost(f: RentalFlat) { return this.budgetType() === 'total' ? totalMonthly(f) : f.rent; }

  // ---- actions ----
  toggleIn<T>(sig: WritableSignal<T[]>, v: T) {
    sig.update(l => l.includes(v) ? l.filter(x => x !== v) : [...l, v]);
  }
  bhkLabel() { return this.bhk().length ? [...this.bhk()].sort().join(', ') + ' BHK' : 'BHK'; }
  rentLabel() { return this.maxRent() ? `Under ₹${this.maxRent()! / 1000}K${this.budgetType() === 'total' ? ' total' : ''}` : 'Budget'; }
  furnLabel() { return this.furnishing().length === 1 ? this.furnishing()[0] : this.furnishing().length ? `Furnishing (${this.furnishing().length})` : 'Furnishing'; }

  clearAll() {
    this.search.set(''); this.bhk.set([]); this.maxRent.set(null); this.furnishing.set([]); this.tenant.set(null); this.verifiedOnly.set(false);
  }

  openSociety(id: string) { this.selectedId.set(id); }
  focus(id: string) { this.map()?.flyTo(id); }
  bhkCounts(r: SocietyRow) {
    return r.society.bhkTypes.map(b => ({ bhk: b, n: r.flats.filter(f => f.bhk === b).length }));
  }
}
