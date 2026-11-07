import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { PropertyService } from '../../core/services/property.service';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { InrPipe, InrShortPipe } from '../../shared/pipes/inr.pipe';
import { GalleryComponent, GalleryTab } from '../../shared/components/gallery/gallery.component';
import {
  AmenitiesComponent, ContactCardComponent, LocationCardComponent, NearbyComponent, ReviewsComponent,
} from '../../shared/components/detail-sections';
import { approvalTone, emi, plotSizes, statusTone } from './venture-utils';

/** SALE · venture detail — gallery, EMI calculator and all details. */
@Component({
  selector: 'app-venture-detail',
  imports: [InrPipe, InrShortPipe, GalleryComponent, AmenitiesComponent, ContactCardComponent, LocationCardComponent,
    NearbyComponent, ReviewsComponent],
  templateUrl: './venture-detail.component.html',
  styleUrls: ['./venture-detail.component.scss'],
})
export class VentureDetailComponent {
  readonly id = input.required<string>();
  readonly size = input<string>();       // ?size=200 from the dialog

  private api = inject(PropertyService);
  private router = inject(Router);
  private location = inject(Location);
  readonly saved = inject(SavedService);
  private toast = inject(ToastService);
  readonly approvalTone = approvalTone;
  readonly statusTone = statusTone;

  readonly v = toSignal(toObservable(this.id).pipe(switchMap(id => this.api.getVenture(id))));

  // ---- EMI ----
  readonly calcSize = signal<number>(0);
  readonly downPct = signal(20);
  readonly rate = signal(8.75);
  readonly years = signal(15);

  constructor() {
    effect(() => {
      const v = this.v(); if (!v) return;
      const q = Number(this.size());
      const sizes = plotSizes(v);
      if (!this.calcSize()) this.calcSize.set(q && sizes.includes(q) ? q : sizes[0]);
    });
  }

  readonly sizes = computed(() => this.v() ? plotSizes(this.v()!) : []);
  readonly counts = computed(() => {
    const p = this.v()?.plots ?? [];
    return { Available: p.filter(x => x.status === 'Available').length, Booked: p.filter(x => x.status === 'Booked').length, Sold: p.filter(x => x.status === 'Sold').length };
  });

  readonly tabs = computed<GalleryTab[]>(() => {
    const v = this.v();
    return [
      { key: 'photos', label: 'Photos', images: v?.images ?? [] },
      { key: 'video', label: 'Drone Video', images: [] },
      { key: 'plan', label: 'Layout Plan', images: v?.layoutImage ? [v.layoutImage] : [] },
      { key: 'map', label: 'Map' },
    ];
  });

  readonly keyDetails = computed(() => {
    const v = this.v(); if (!v) return [];
    return [
      { icon: 'tag', label: 'Venture Code', value: `FF-S-${v.id.split('-')[1].toUpperCase()}` },
      { icon: 'payments', label: 'Price', value: '₹' + new Intl.NumberFormat('en-IN').format(v.pricePerSqYd) + ' / sq.yd', strong: true },
      { icon: 'verified', label: 'Approvals', value: v.approvals.join(', '), pill: true },
      ...(v.reraNo ? [{ icon: 'gavel', label: 'RERA No.', value: v.reraNo }] : []),
      ...(v.hmdaLpNo ? [{ icon: 'description', label: 'HMDA LP No.', value: v.hmdaLpNo }] : []),
      { icon: 'flag', label: 'Status', value: v.status },
      { icon: 'event', label: 'Launched', value: String(v.launchYear) },
      { icon: 'landscape', label: 'Total Area', value: `${v.totalAcres} acres` },
      { icon: 'grid_view', label: 'Total Plots', value: String(v.plots.length) },
      { icon: 'add_road', label: 'Roads', value: v.roadWidths },
      { icon: 'route', label: 'From ORR', value: `${v.orrDistanceKm} km` },
      { icon: 'account_balance', label: 'Bank Loans', value: v.bankLoans.join(', ') },
    ];
  });

  // EMI calculator
  readonly price = computed(() => (this.v()?.pricePerSqYd ?? 0) * this.calcSize());
  readonly loan = computed(() => Math.round(this.price() * (1 - this.downPct() / 100)));
  readonly monthly = computed(() => Math.round(emi(this.loan(), this.rate(), this.years())));
  readonly regCharges = computed(() => Math.round(this.price() * 0.075)); // approx. stamp duty + registration in Telangana

  toggleSave() {
    const v = this.v(); if (!v) return;
    const on = this.saved.toggle(v.id);
    this.toast.show(on ? 'Venture saved' : 'Removed from saved list', 'info');
  }
  async share() {
    const v = this.v(); if (!v) return;
    try {
      if (navigator.share) await navigator.share({ title: v.name, text: `${v.name} — plots in ${v.locality}`, url: location.href });
      else { await navigator.clipboard.writeText(location.href); this.toast.show('Link copied to clipboard', 'info'); }
    } catch { /* cancelled */ }
  }
  back() { history.length > 1 ? this.location.back() : this.router.navigate(['/sale']); }
}
