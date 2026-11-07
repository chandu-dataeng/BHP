import { Component, WritableSignal, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PropertyService } from '../../core/services/property.service';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { ViewedService } from '../../core/services/viewed.service';
import { PRICE_BANDS, PriceBandKey, bandFor } from '../../core/data/geo';
import { Approval, SaleFilters, Venture, VentureStatus } from '../../core/models/sale.models';
import { MapComponent, MapMarker } from '../../shared/components/map/map.component';
import { DropdownComponent } from '../../shared/components/dropdown/dropdown.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { InrPipe, InrShortPipe } from '../../shared/pipes/inr.pipe';
import { VentureDialogComponent } from './venture-dialog.component';
import { approvalTone, availablePlots, minTicket, plotSizes, statusTone } from './venture-utils';

/** SALE · Screen ② — plotsview-style: filters + venture list + price-tag map. */
@Component({
  selector: 'app-sale-map',
  imports: [FormsModule, MapComponent, DropdownComponent, ImgFallbackDirective, InrPipe, InrShortPipe, VentureDialogComponent],
  templateUrl: './sale-map.component.html',
  styleUrl: './sale-map.component.scss',
})
export class SaleMapComponent {
  readonly q = input<string>();

  private api = inject(PropertyService);
  readonly saved = inject(SavedService);
  private toast = inject(ToastService);
  private viewed = inject(ViewedService);
  private map = viewChild(MapComponent);

  private ventures = toSignal(this.api.getVentures(), { initialValue: [] as Venture[] });
  readonly loading = computed(() => !this.ventures().length);

  // ---- filters ----
  readonly search = signal('');
  readonly maxBudget = signal<number | null>(null);
  readonly size = signal<[number, number] | null>(null);
  readonly approvals = signal<Approval[]>([]);
  readonly status = signal<VentureStatus[]>([]);
  readonly verifiedOnly = signal(false);
  readonly sort = signal<SaleFilters['sort']>('relevance');

  readonly budgetOptions = [1500000, 2500000, 5000000, 7500000, 10000000];
  readonly sizeOptions: { label: string; range: [number, number] }[] = [
    { label: 'Up to 150 sq.yd', range: [0, 150] },
    { label: '150 – 200 sq.yd', range: [150, 200] },
    { label: '200 – 300 sq.yd', range: [200, 300] },
    { label: '300+ sq.yd', range: [300, 10000] },
  ];
  readonly approvalOptions: Approval[] = ['HMDA', 'DTCP', 'RERA'];
  readonly statusOptions: VentureStatus[] = ['Ready to Register', 'Under Development', 'New Launch'];
  readonly sortOptions: { key: SaleFilters['sort']; label: string }[] = [
    { key: 'relevance', label: 'Recommended' },
    { key: 'priceAsc', label: 'Price / sq.yd: Low to High' },
    { key: 'priceDesc', label: 'Price / sq.yd: High to Low' },
    { key: 'availability', label: 'Most plots available' },
  ];

  readonly selectedId = signal<string | null>(null);
  readonly hoveredId = signal<string | null>(null);
  /** Map-first like plotsview: the list is a drawer you can open. */
  readonly listOpen = signal(false);
  readonly legendOpen = signal(typeof window === 'undefined' || window.innerWidth >= 900);
  readonly showRings = signal(true);
  readonly bands = signal<PriceBandKey[]>([]);
  readonly priceBands = PRICE_BANDS;

  readonly approvalTone = approvalTone;
  readonly statusTone = statusTone;

  constructor() {
    effect(() => { const q = this.q(); if (q) this.search.set(q); });
  }

  /** Plots inside a venture that satisfy budget + size filters. */
  private matchingPlots(v: Venture) {
    const [lo, hi] = this.size() ?? [0, Infinity];
    const budget = this.maxBudget() ?? Infinity;
    return availablePlots(v).filter(p => p.sizeSqYd >= lo && p.sizeSqYd <= hi && p.sizeSqYd * v.pricePerSqYd <= budget);
  }

  readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const plotFilter = this.maxBudget() != null || this.size() != null;
    let list = this.ventures()
      .filter(v => !term || `${v.name} ${v.locality} ${v.developer} ${v.pincode}`.toLowerCase().includes(term))
      .filter(v => !this.approvals().length || this.approvals().every(a => v.approvals.includes(a)))
      .filter(v => !this.status().length || this.status().includes(v.status))
      .filter(v => !this.verifiedOnly() || v.verified)
      .filter(v => !this.bands().length || this.bands().includes(bandFor(v.pricePerSqYd).key))
      .map(v => {
        const av = availablePlots(v);
        const sizes = plotSizes(v);
        return { v, available: av.length, matching: this.matchingPlots(v).length, total: v.plots.length,
          minSize: sizes[0], maxSize: sizes[sizes.length - 1], ticket: minTicket(v) };
      })
      .filter(r => !plotFilter || r.matching > 0);

    switch (this.sort()) {
      case 'priceAsc': list = [...list].sort((a, b) => a.v.pricePerSqYd - b.v.pricePerSqYd); break;
      case 'priceDesc': list = [...list].sort((a, b) => b.v.pricePerSqYd - a.v.pricePerSqYd); break;
      case 'availability': list = [...list].sort((a, b) => b.available - a.available); break;
    }
    return list;
  });

  readonly markers = computed<MapMarker[]>(() => this.rows().map(r => ({
    id: r.v.id, lat: r.v.lat, lng: r.v.lng,
    title: r.v.name,
    subtitle: `${r.v.locality} · ₹${r.v.pricePerSqYd.toLocaleString('en-IN')}/sq.yd · ${r.available} plots open`,
    color: bandFor(r.v.pricePerSqYd).color,
    viewed: this.viewed.ids().includes(r.v.id) && this.selectedId() !== r.v.id,
  })));

  /** How many ventures fall in each price band (for the legend). */
  readonly bandCounts = computed(() => {
    const c: Partial<Record<string, number>> = {};
    for (const v of this.ventures()) { const k = bandFor(v.pricePerSqYd).key; c[k] = (c[k] ?? 0) + 1; }
    return c;
  });

  readonly selected = computed(() => this.ventures().find(v => v.id === this.selectedId()) ?? null);

  readonly activeCount = computed(() =>
    [this.maxBudget() != null, this.size() != null, this.approvals().length, this.status().length, this.verifiedOnly(), this.bands().length].filter(Boolean).length);

  budgetLabel() { const b = this.maxBudget(); return b ? `Under ${b >= 1e7 ? b / 1e7 + ' Cr' : b / 1e5 + ' L'}` : 'Budget'; }
  sizeLabel() { return this.sizeOptions.find(o => o.range === this.size())?.label ?? 'Plot Size'; }
  approvalLabel() { return this.approvals().length ? this.approvals().join(' + ') : 'Approval'; }
  statusLabel() { return this.status().length === 1 ? this.status()[0] : this.status().length ? `Status (${this.status().length})` : 'Status'; }
  sortLabel() { return this.sortOptions.find(o => o.key === this.sort())!.label; }

  toggleIn<T>(sig: WritableSignal<T[]>, v: T) { sig.update(l => l.includes(v) ? l.filter(x => x !== v) : [...l, v]); }
  clearAll() {
    this.search.set(''); this.maxBudget.set(null); this.size.set(null); this.approvals.set([]); this.status.set([]); this.verifiedOnly.set(false); this.bands.set([]);
  }
  open(id: string) { this.selectedId.set(id); this.viewed.mark(id); }
  focus(id: string) {
    if (window.innerWidth < 900) this.listOpen.set(false);
    setTimeout(() => this.map()?.flyTo(id), 50);
  }
  toggleSave(e: Event, id: string) {
    e.stopPropagation();
    const on = this.saved.toggle(id);
    this.toast.show(on ? 'Venture saved' : 'Removed from saved list', 'info');
  }
  pct(r: { available: number; total: number }) { return Math.round((r.available / r.total) * 100); }
}
