import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PropertyService } from '../../core/services/property.service';
import { BRAND } from '../../core/brand';
import { IMG } from '../../core/data/images';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { FooterComponent } from '../../shared/components/footer/footer.component';

/** SCREEN-1 — choose Sale or Rent. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, InrPipe, ImgFallbackDirective, FooterComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private api = inject(PropertyService);
  private router = inject(Router);
  readonly brand = BRAND;
  readonly img = IMG.hero;

  private ventures = toSignal(this.api.getVentures(), { initialValue: [] });
  private flats = toSignal(this.api.getFlats(), { initialValue: [] });
  private societies = toSignal(this.api.getSocieties(), { initialValue: [] });

  readonly sale = computed(() => {
    const v = this.ventures();
    return {
      ventures: v.length,
      plots: v.reduce((n, x) => n + x.plots.filter(p => p.status === 'Available').length, 0),
      minRate: v.length ? Math.min(...v.map(x => x.pricePerSqYd)) : 0,
    };
  });
  readonly rent = computed(() => {
    const f = this.flats();
    return { flats: f.length, societies: this.societies().length, minRent: f.length ? Math.min(...f.map(x => x.rent)) : 0 };
  });

  readonly saleAreas = ['Tukkuguda', 'Shankarpally', 'Maheshwaram', 'Adibatla', 'Ghatkesar', 'Medchal'];
  readonly rentAreas = ['Gachibowli', 'Kondapur', 'Kokapet', 'Narsingi', 'Miyapur', 'Tellapur'];

  readonly why = [
    { icon: 'event_available', title: 'Honest availability', text: 'Every flat shows when our team last confirmed it is available — no ghost listings.' },
    { icon: 'gavel', title: 'Clear Titles', text: 'HMDA / DTCP / RERA details shown upfront for every venture.' },
    { icon: 'auto_awesome', title: 'Matched to you', text: 'Tell us your budget (incl. maintenance) and must-haves — we show only flats that fit.' },
    { icon: 'directions_car', title: 'Free Site Visits', text: 'Book a site visit in one click — we pick a slot that suits you.' },
  ];

  search(q: string, mode: 'sale' | 'rent') {
    this.router.navigate([`/${mode}`], { queryParams: q.trim() ? { q: q.trim() } : {} });
  }
}
