import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { PropertyService } from '../../core/services/property.service';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { RentalFlat, Society } from '../../core/models/rent.models';
import { alternativesFor } from '../../core/matching/matching';
import { AvailabilityComponent } from '../../shared/components/availability/availability.component';
import { ReportDialogComponent } from '../../shared/components/report-dialog/report-dialog.component';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { GalleryComponent, GalleryTab } from '../../shared/components/gallery/gallery.component';
import {
  AmenitiesComponent, ContactCardComponent, LocationCardComponent, NearbyComponent, ReviewsComponent,
} from '../../shared/components/detail-sections';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';

/** RENT · Screen ④ — full flat details. */
@Component({
  selector: 'app-flat-detail',
  imports: [RouterLink, InrPipe, DatePipe, GalleryComponent, AmenitiesComponent, ContactCardComponent,
    LocationCardComponent, NearbyComponent, ReviewsComponent, ImgFallbackDirective, AvailabilityComponent, ReportDialogComponent],
  templateUrl: './flat-detail.component.html',
  styleUrl: './flat-detail.component.scss',
})
export class FlatDetailComponent {
  readonly id = input.required<string>();

  private api = inject(PropertyService);
  private router = inject(Router);
  private location = inject(Location);
  readonly saved = inject(SavedService);
  private toast = inject(ToastService);

  readonly flat = toSignal(toObservable(this.id).pipe(switchMap(id => this.api.getFlat(id))));
  readonly society = toSignal(toObservable(this.flat).pipe(
    filter((f): f is RentalFlat => !!f), switchMap(f => this.api.getSociety(f.societyId))));
  readonly siblings = toSignal(toObservable(this.flat).pipe(
    filter((f): f is RentalFlat => !!f), switchMap(f => this.api.getFlatsBySociety(f.societyId))), { initialValue: [] as RentalFlat[] });

  readonly similar = computed(() => this.siblings().filter(f => f.id !== this.flat()?.id).slice(0, 3));

  private allFlats = toSignal(this.api.getFlats(), { initialValue: [] as RentalFlat[] });
  private allSocieties = toSignal(this.api.getSocieties(), { initialValue: [] as Society[] });
  /** Rented / on hold / pulled listings must not dead-end: offer matching alternatives instead. */
  readonly unavailable = computed(() => { const a = this.flat()?.availability; return a === 'rented' || a === 'on_hold'; });
  readonly alternatives = computed(() => {
    const f = this.flat();
    return f && this.unavailable() ? alternativesFor(f, this.allFlats(), this.allSocieties()) : [];
  });
  readonly reportOpen = signal(false);

  readonly tabs = computed<GalleryTab[]>(() => {
    const f = this.flat(); const s = this.society();
    return [
      { key: 'photos', label: 'Photos', images: f?.images ?? [] },
      { key: 'video', label: 'Video', images: [] },
      { key: 'plan', label: 'Floor Plan', images: f?.floorPlan ? [f.floorPlan] : [] },
      { key: 'society', label: 'Society', images: s?.images ?? [] },
      { key: 'map', label: 'Map' },
    ];
  });

  readonly keyDetails = computed(() => {
    const f = this.flat(); if (!f) return [];
    return [
      { icon: 'tag', label: 'Property Code', value: f.code, copy: true },
      { icon: 'payments', label: 'Rent', value: this.inr(f.rent) + ' / month', strong: true },
      { icon: 'build', label: 'Maintenance', value: this.inr(f.maintenance) + ' / month' },
      { icon: 'event', label: 'Available From', value: new Date(f.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
      { icon: 'chair', label: 'Furnishing', value: f.furnishing },
      { icon: 'explore', label: 'Facing', value: f.facing },
      { icon: 'layers', label: 'Floor', value: `${f.floor} of ${f.totalFloors}` },
      { icon: 'group', label: 'Family / Bachelors', value: f.tenantType, pill: true },
      { icon: 'account_balance_wallet', label: 'Deposit', value: `${this.inr(f.deposit)} (${f.depositMonths} months)` },
      { icon: 'local_parking', label: 'Parking', value: f.parking },
      { icon: 'pets', label: 'Pets', value: f.petsAllowed ? 'Allowed' : 'Not allowed' },
      { icon: 'calendar_month', label: 'Property Age', value: f.propertyAge },
    ];
  });

  private inr(v: number) { return '₹' + new Intl.NumberFormat('en-IN').format(v); }

  copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => this.toast.show('Property code copied', 'info'));
  }
  toggleSave() {
    const f = this.flat(); if (!f) return;
    const on = this.saved.toggle(f.id);
    this.toast.show(on ? 'Added to your saved list' : 'Removed from saved list', 'info');
  }
  async share() {
    const f = this.flat(); if (!f) return;
    const data = { title: `${f.title} for rent`, text: `${f.title} · ${this.inr(f.rent)}/month`, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); this.toast.show('Link copied to clipboard', 'info'); }
    } catch { /* user cancelled */ }
  }
  back() {
    const f = this.flat();
    history.length > 1 ? this.location.back() : this.router.navigate(f ? ['/rent/society', f.societyId] : ['/rent']);
  }
}
