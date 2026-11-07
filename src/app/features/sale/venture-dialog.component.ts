import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { InrPipe, InrShortPipe } from '../../shared/pipes/inr.pipe';
import { AMENITY_META } from '../../core/data/amenities';
import { BRAND } from '../../core/brand';
import { Venture } from '../../core/models/sale.models';
import { approvalTone, availablePlots, plotSizes, statusTone } from './venture-utils';

/** Popup shown when a venture pin / card is clicked. */
@Component({
  selector: 'app-venture-dialog',
  imports: [ModalComponent, ImgFallbackDirective, InrPipe, InrShortPipe],
  template: `
    <app-modal [width]="460" (close)="closed.emit()">
      <div class="cover">
        <img [src]="v().images[img()]" appImgFallback="land" [alt]="v().name">
        @if (v().images.length > 1) {
          <div class="dots">@for (x of v().images; track $index) {
            <button [class.on]="$index === img()" (click)="img.set($index)" aria-label="Photo"></button> }</div>
        }
        <span class="badge st" [class]="statusTone(v().status)">{{ v().status }}</span>
      </div>
      <div class="pad">
        <div class="ttl">
          <h2>{{ v().name }}</h2>
          @if (v().verified) { <span class="badge badge-green"><span class="icon xs fill">verified</span> Verified</span> }
        </div>
        <div class="rating">
          <span class="icon fill star">star</span><b>{{ v().rating }}</b>
          <span class="muted">({{ v().reviewsCount }} reviews)</span><span class="sep">•</span><span class="muted">by {{ v().developer }}</span>
        </div>
        <div class="loc">
          <span class="icon sm fill">location_on</span><span>{{ v().locality }}, Hyderabad</span>
          <a [href]="gmaps()" target="_blank" rel="noopener">View on Map</a>
        </div>
        <div class="appr">
          @for (a of v().approvals; track a) { <span class="badge" [class]="approvalTone(a)"><span class="icon xs fill">task_alt</span>{{ a }} Approved</span> }
        </div>

        <div class="kpis">
          <div><b>{{ v().pricePerSqYd | inr }}</b><small>per sq.yd</small></div>
          <div><b>{{ v().totalAcres }}</b><small>Acres</small></div>
          <div><b class="g">{{ available().length }}</b><small>Plots open</small></div>
          <div><b>{{ v().orrDistanceKm }} km</b><small>from ORR</small></div>
        </div>

        <div class="hl">
          @for (h of v().highlights; track h) {
            <div><span class="icon">{{ meta[h].icon }}</span><small>{{ meta[h].label }}</small></div>
          }
        </div>

        <h3>Available Plot Sizes</h3>
        @for (r of rows(); track r.size) {
          <button class="row" [class.green]="r.count" [disabled]="!r.count" (click)="open(r.size)">
            <span class="ri"><span class="icon">{{ r.count ? 'crop_square' : 'block' }}</span></span>
            <span class="rt">
              <b>{{ r.size }} sq.yd <span class="muted ft">({{ r.size * 9 }} sq.ft)</span></b>
              <small>{{ r.count ? r.count + (r.count === 1 ? ' plot' : ' plots') + ' available · ' : 'Sold out · ' }}{{ r.size * v().pricePerSqYd | inrShort }}</small>
            </span>
            <span class="icon chev">chevron_right</span>
          </button>
        }

        <div class="cta">
          <a class="btn btn-green" [href]="wa()" target="_blank" rel="noopener"><span class="icon sm">chat</span> WhatsApp</a>
          <button class="btn btn-primary" (click)="open(null)">View Full Details <span class="icon sm">arrow_forward</span></button>
        </div>
      </div>
    </app-modal>
  `,
  styles: `
    .cover { position: relative; height: 200px; background: #dfe6ee; img { width: 100%; height: 100%; object-fit: cover; } }
    .dots { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 5px;
      button { width: 7px; height: 7px; border-radius: 4px; border: 0; padding: 0; background: rgba(255,255,255,.6); cursor: pointer; &.on { width: 18px; background: #fff; } } }
    .st { position: absolute; top: 12px; left: 12px; font-size: 12px; }
    .pad { padding: 18px 20px 20px; }
    .ttl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; h2 { font-size: 21px; font-weight: 800; } }
    .rating { display: flex; align-items: center; gap: 4px; font-size: 14px; margin-top: 6px; flex-wrap: wrap; .star { color: var(--star); font-size: 18px; } .sep { color: #c0c6cf; margin: 0 4px; } }
    .loc { display: flex; align-items: center; gap: 6px; font-size: 14px; margin-top: 8px; color: #374151; .icon { color: var(--navy); } a { margin-left: 8px; font-weight: 600; } }
    .appr { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px;
      div { background: var(--gray-soft); border-radius: 10px; padding: 9px 4px; text-align: center; }
      b { display: block; font-size: 14.5px; color: var(--navy); &.g { color: var(--green-text); } } small { font-size: 11.5px; color: var(--muted); } }
    .hl { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin: 16px 0 4px; padding: 12px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
      div { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; } .icon { color: var(--navy); font-size: 26px; } small { font-size: 11.5px; color: #4b5563; } }
    h3 { font-size: 17px; margin: 16px 0 10px; }
    .row { width: 100%; display: flex; align-items: center; gap: 12px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px;
      margin-bottom: 10px; cursor: pointer; text-align: left; background: #fafbfc;
      &:disabled { cursor: not-allowed; opacity: .75; }
      .rt { flex: 1; display: flex; flex-direction: column; b { font-size: 15px; } .ft { font-weight: 500; font-size: 12.5px; } small { color: var(--muted); font-size: 13px; margin-top: 2px; } }
      .ri { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; background: #eceff3; color: #8a93a0; }
      .chev { color: #9aa3ae; }
      &.green { background: var(--green-soft); border-color: #c9eed6; .ri { background: #d3f3de; color: var(--green-text); } .chev { color: var(--green-text); }
        &:hover { box-shadow: var(--shadow-sm); } } }
    .cta { display: grid; grid-template-columns: 1fr 1.6fr; gap: 10px; margin-top: 8px; }
  `,
})
export class VentureDialogComponent {
  readonly v = input.required<Venture>();
  readonly closed = output<void>();
  readonly meta = AMENITY_META;
  readonly img = signal(0);
  readonly approvalTone = approvalTone;
  readonly statusTone = statusTone;
  private router = inject(Router);

  readonly available = computed(() => availablePlots(this.v()));
  readonly rows = computed(() => plotSizes(this.v()).map(size => ({
    size, count: this.available().filter(p => p.sizeSqYd === size).length,
  })));
  readonly gmaps = computed(() => `https://www.google.com/maps/search/?api=1&query=${this.v().lat},${this.v().lng}`);
  readonly wa = computed(() => `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(`Hi ${BRAND.name}, I'm interested in plots at ${this.v().name}, ${this.v().locality}.`)}`);

  open(size: number | null) {
    this.closed.emit();
    this.router.navigate(['/sale/venture', this.v().id], { queryParams: size ? { size } : {} });
  }
}
