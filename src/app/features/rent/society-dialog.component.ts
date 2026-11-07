import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { AMENITY_META } from '../../core/data/amenities';
import { RentalFlat, Society } from '../../core/models/rent.models';

/** Popup shown when a society pin is clicked (reference screen ②). */
@Component({
  selector: 'app-society-dialog',
  imports: [ModalComponent, ImgFallbackDirective, InrPipe],
  template: `
    <app-modal [width]="440" (close)="closed.emit()">
      <div class="cover">
        <img [src]="society().coverImage" appImgFallback="building" [alt]="society().name">
      </div>
      <div class="pad">
        <h2>{{ society().name }}</h2>
        <div class="rating">
          <span class="icon fill star">star</span> <b>{{ society().rating }}</b>
          <span class="muted">({{ society().reviewsCount }} reviews)</span>
          <span class="dotsep">•</span><span class="muted">by {{ society().builder }}</span>
        </div>
        <div class="loc">
          <span class="icon sm fill">location_on</span>
          <span>{{ society().locality }}, {{ society().city }}</span>
          <a [href]="gmaps()" target="_blank" rel="noopener">View on Map</a>
        </div>

        <div class="hl">
          @for (h of society().highlights; track h) {
            <div><span class="icon">{{ meta[h].icon }}</span><small>{{ meta[h].label }}</small></div>
          }
        </div>

        <h3>Available Flats</h3>
        @for (row of rows(); track row.bhk) {
          <button class="row" [class]="row.tone" [disabled]="!row.count" (click)="open(row.bhk)">
            <span class="ri"><span class="icon">{{ row.count ? 'apartment' : 'domain_disabled' }}</span></span>
            <span class="rt">
              <b>{{ row.bhk }} BHK</b>
              <small>{{ row.count ? row.count + (row.count === 1 ? ' unit' : ' units') + ' available' : '0 units currently available' }}
                @if (row.count) { · from {{ row.from | inr }}/mo }</small>
            </span>
            <span class="icon chev">chevron_right</span>
          </button>
        }

        <button class="btn btn-primary btn-block all" (click)="open(null)">
          View all {{ flats().length }} flats <span class="icon sm">arrow_forward</span>
        </button>
      </div>
    </app-modal>
  `,
  styles: `
    .cover { height: 190px; background: #dfe6ee; img { width: 100%; height: 100%; object-fit: cover; } }
    .pad { padding: 18px 20px 20px; }
    h2 { font-size: 21px; font-weight: 800; }
    .rating { display: flex; align-items: center; gap: 4px; font-size: 14px; margin-top: 6px; flex-wrap: wrap;
      .star { color: var(--star); font-size: 18px; } .dotsep { color: #c0c6cf; margin: 0 4px; } }
    .loc { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #374151; margin-top: 8px;
      .icon { color: var(--navy); } a { margin-left: 8px; font-weight: 600; } }
    .hl { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin: 18px 0 6px; padding: 14px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
      div { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
      .icon { color: var(--navy); font-size: 26px; } small { font-size: 11.5px; color: #4b5563; } }
    h3 { font-size: 17px; margin: 16px 0 10px; }
    .row { width: 100%; display: flex; align-items: center; gap: 12px; border: 1px solid var(--border); border-radius: 10px;
      padding: 10px 12px; margin-bottom: 10px; cursor: pointer; text-align: left; background: #fafbfc; transition: transform .1s, box-shadow .15s;
      &:not(:disabled):hover { box-shadow: var(--shadow-sm); transform: translateX(2px); }
      &:disabled { cursor: not-allowed; opacity: .8; }
      .rt { flex: 1; display: flex; flex-direction: column; b { font-size: 15.5px; } small { color: var(--muted); font-size: 13px; margin-top: 2px; } }
      .ri { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; background: #eceff3; color: #8a93a0; }
      .chev { color: #9aa3ae; }
      &.green { background: var(--green-soft); border-color: #c9eed6; .ri { background: #d3f3de; color: var(--green-text); } .chev { color: var(--green-text); } }
      &.amber { background: #fff8ea; border-color: #fbe3b4; .ri { background: #ffeac2; color: #b7791f; } .chev { color: #b7791f; } }
    }
    .all { margin-top: 6px; }
  `,
})
export class SocietyDialogComponent {
  readonly society = input.required<Society>();
  readonly flats = input.required<RentalFlat[]>();
  readonly closed = output<void>();
  readonly meta = AMENITY_META;
  private router = inject(Router);

  readonly gmaps = computed(() => `https://www.google.com/maps/search/?api=1&query=${this.society().lat},${this.society().lng}`);

  /** One row per BHK type: grey when none available, green for most, amber for the largest type. */
  readonly rows = computed(() => {
    const types = [...new Set([...this.society().bhkTypes, ...this.flats().map(f => f.bhk)])].sort();
    const maxType = Math.max(...types);
    return types.map(bhk => {
      const list = this.flats().filter(f => f.bhk === bhk);
      return {
        bhk, count: list.length,
        from: list.length ? Math.min(...list.map(f => f.rent)) : 0,
        tone: !list.length ? 'gray' : bhk === maxType && types.length > 2 ? 'amber' : 'green',
      };
    });
  });

  open(bhk: number | null) {
    this.closed.emit();
    this.router.navigate(['/rent/society', this.society().id], { queryParams: bhk ? { bhk } : {} });
  }
}
