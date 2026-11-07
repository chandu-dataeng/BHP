import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { PropertyService } from '../../core/services/property.service';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { AMENITY_META } from '../../core/data/amenities';
import { RentalFlat } from '../../core/models/rent.models';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ContactCardComponent } from '../../shared/components/detail-sections';
import { AvailabilityComponent } from '../../shared/components/availability/availability.component';
import { AlertDialogComponent } from '../../shared/components/alert-dialog/alert-dialog.component';

/** RENT · Screen ③ — BHK-wise listings for one society, featured slider + all units. */
@Component({
  selector: 'app-society-flats',
  imports: [RouterLink, ImgFallbackDirective, InrPipe, ContactCardComponent, AvailabilityComponent, AlertDialogComponent],
  templateUrl: './society-flats.component.html',
  styleUrl: './society-flats.component.scss',
})
export class SocietyFlatsComponent {
  readonly id = input.required<string>();     // route param
  readonly bhk = input<string>();             // ?bhk=3

  private api = inject(PropertyService);
  private router = inject(Router);
  private location = inject(Location);
  readonly saved = inject(SavedService);
  private toast = inject(ToastService);
  readonly meta = AMENITY_META;

  readonly society = toSignal(toObservable(this.id).pipe(switchMap(id => this.api.getSociety(id))));
  readonly flats = toSignal(toObservable(this.id).pipe(switchMap(id => this.api.getFlatsBySociety(id))), { initialValue: [] as RentalFlat[] });

  readonly activeBhk = signal<number | null>(null);
  readonly slide = signal(0);      // which flat in the slider
  readonly photo = signal(0);      // which photo of that flat
  readonly alertOpen = signal(false);

  readonly tabs = computed(() => {
    const s = this.society(); if (!s) return [];
    const types = [...new Set([...s.bhkTypes, ...this.flats().map(f => f.bhk)])].sort();
    return types.map(b => ({ bhk: b, count: this.flats().filter(f => f.bhk === b).length }));
  });

  readonly current = computed(() => {
    const b = this.activeBhk();
    return b == null ? this.flats() : this.flats().filter(f => f.bhk === b);
  });
  readonly featured = computed(() => this.current()[this.slide()] ?? null);

  constructor() {
    // initial tab: ?bhk=… or first type that has units
    effect(() => {
      const tabs = this.tabs(); if (!tabs.length || this.activeBhk() != null) return;
      const q = Number(this.bhk());
      this.activeBhk.set(tabs.some(t => t.bhk === q) ? q : (tabs.find(t => t.count)?.bhk ?? tabs[0].bhk));
    });
  }

  selectTab(b: number) {
    this.activeBhk.set(b); this.slide.set(0); this.photo.set(0);
    this.router.navigate([], { queryParams: { bhk: b }, replaceUrl: true });
  }
  goSlide(i: number) { const n = this.current().length; this.slide.set((i + n) % n); this.photo.set(0); }
  nextPhoto(e: Event, d: number) {
    e.stopPropagation();
    const n = this.featured()?.images.length ?? 1;
    this.photo.update(p => (p + d + n) % n);
  }
  toggleSave(e: Event, f: RentalFlat) {
    e.stopPropagation();
    const on = this.saved.toggle(f.id);
    this.toast.show(on ? 'Added to your saved list' : 'Removed from saved list', 'info');
  }
  back() { history.length > 1 ? this.location.back() : this.router.navigate(['/rent']); }
}
