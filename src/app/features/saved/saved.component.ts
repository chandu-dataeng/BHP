import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CompareService } from '../../core/services/compare.service';
import { PropertyService } from '../../core/services/property.service';
import { SavedService } from '../../core/services/saved.service';
import { ToastService } from '../../core/services/toast.service';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { InrPipe } from '../../shared/pipes/inr.pipe';

@Component({
  selector: 'app-saved',
  imports: [RouterLink, ImgFallbackDirective, InrPipe],
  template: `
    <div class="container wrap">
      <h1>Saved Properties</h1>
      <p class="muted intro">Your shortlisted plots and flats — saved on this device.</p>

      @if (!ventures().length && !flats().length) {
        <div class="empty card">
          <span class="icon lg fill">favorite</span>
          <h3>Nothing saved yet</h3>
          <p class="muted">Tap the heart on any plot or flat to shortlist it here.</p>
          <div class="cta"><a class="btn btn-primary" routerLink="/sale">Browse Plots</a><a class="btn btn-green" routerLink="/rent">Browse Flats</a></div>
        </div>
      }

      @if (ventures().length) {
        <h2><span class="icon">landscape</span> Plots &amp; Ventures ({{ ventures().length }})</h2>
        <div class="grid">
          @for (v of ventures(); track v.id) {
            <article class="card it">
              <a [routerLink]="['/sale/venture', v.id]"><img [src]="v.coverImage" appImgFallback="land" alt=""></a>
              <div class="b">
                <a [routerLink]="['/sale/venture', v.id]"><h3>{{ v.name }}</h3></a>
                <p class="muted">{{ v.locality }} · {{ v.approvals.join(', ') }}</p>
                <div class="row"><span><span class="price">{{ v.pricePerSqYd | inr }}</span><span class="muted"> / sq.yd</span></span>
                  <button class="rm" (click)="saved.toggle(v.id)"><span class="icon sm fill">favorite</span> Remove</button></div>
              </div>
            </article>
          }
        </div>
      }

      @if (flats().length) {
        <h2><span class="icon">apartment</span> Flats for Rent ({{ flats().length }})</h2>
        @if (flats().length > 1) {
          <p class="muted hint"><span class="icon xs">compare_arrows</span> Tick <b>Compare</b> on 2 or 3 flats to see them side by side.</p>
        }
        <div class="grid">
          @for (f of flats(); track f.id) {
            <article class="card it" [class.picked]="compare.has(f.id)">
              <a [routerLink]="['/rent/flat', f.id]"><img [src]="f.images[0]" appImgFallback="interior" alt=""></a>
              <div class="b">
                <a [routerLink]="['/rent/flat', f.id]"><h3>{{ f.title }}</h3></a>
                <p class="muted">{{ api.societyName(f.societyId) }} · {{ f.areaSqft }} sq.ft · {{ f.furnishing }}</p>
                <div class="row"><span><span class="price">{{ f.rent | inr }}</span><span class="muted"> / month</span></span>
                  <button class="rm" (click)="saved.toggle(f.id)"><span class="icon sm fill">favorite</span> Remove</button></div>
                @if (flats().length > 1) {
                  <label class="cmp-pick" [class.on]="compare.has(f.id)">
                    <input type="checkbox" [checked]="compare.has(f.id)" (change)="pick(f.id)">
                    <span class="icon sm">{{ compare.has(f.id) ? 'check_box' : 'check_box_outline_blank' }}</span> Compare
                  </label>
                }
              </div>
            </article>
          }
        </div>
      }
    </div>

    @if (picked().length) {
      <div class="bar">
        <div class="container bar-in">
          <span><b>{{ picked().length }}</b> of {{ max }} selected
            @if (picked().length < 2) { <span class="muted"> — pick {{ 2 - picked().length }} more to compare</span> }</span>
          <span class="sp"></span>
          <button class="btn btn-ghost btn-sm" (click)="compare.clear()">Clear</button>
          <button class="btn btn-primary" [disabled]="picked().length < 2" (click)="go()"><span class="icon sm">compare_arrows</span> Compare {{ picked().length }} flats</button>
        </div>
      </div>
    }
  `,
  styles: `
    .wrap { padding-top: 28px; padding-bottom: 48px; }
    h1 { font-size: 26px; font-weight: 800; } .intro { margin: 4px 0 20px; }
    h2 { font-size: 18px; margin: 26px 0 12px; display: flex; gap: 8px; align-items: center; .icon { color: var(--primary); } }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .it { overflow: hidden; img { width: 100%; height: 170px; object-fit: cover; background: #dfe6ee; }
      .b { padding: 12px 14px 14px; } h3 { font-size: 16px; color: var(--text); } p { margin: 4px 0 10px; font-size: 13px; }
      .row { display: flex; justify-content: space-between; align-items: center; } .price { font-size: 17px; } }
    .rm { border: 0; background: none; color: var(--red); cursor: pointer; display: inline-flex; gap: 4px; align-items: center; font-weight: 600; font-size: 13px; }
    .hint { font-size: 13px; margin: -4px 0 12px; display: flex; gap: 4px; align-items: center; }
    .it.picked { outline: 2px solid var(--primary); }
    .cmp-pick { display: flex; gap: 6px; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); cursor: pointer;
      font-size: 13.5px; font-weight: 600; input { position: absolute; opacity: 0; pointer-events: none; } .icon { color: var(--muted); }
      &.on .icon { color: var(--primary); } input:focus-visible + .icon { outline: 2px solid var(--primary); border-radius: 3px; } }
    .bar { position: sticky; bottom: 0; z-index: 20; background: #fff; border-top: 1px solid var(--border); box-shadow: 0 -4px 16px rgba(0, 0, 0, .08); padding: 10px 0; }
    .bar-in { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; .sp { flex: 1; } }
    .empty { text-align: center; padding: 40px; .icon { color: var(--red); font-size: 44px; } h3 { margin: 8px 0 4px; }
      .cta { display: flex; gap: 10px; justify-content: center; margin-top: 16px; } }
  `,
})
export class SavedComponent {
  readonly api = inject(PropertyService);
  readonly saved = inject(SavedService);
  private allVentures = toSignal(this.api.getVentures(), { initialValue: [] });
  private allFlats = toSignal(this.api.getFlats(), { initialValue: [] });
  readonly ventures = computed(() => this.allVentures().filter(v => this.saved.all().includes(v.id)));
  readonly flats = computed(() => this.allFlats().filter(f => this.saved.all().includes(f.id)));

  readonly compare = inject(CompareService);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly max = CompareService.MAX;
  /** Picked flats that are still saved, in the order they were picked. */
  readonly picked = computed(() => this.compare.all().filter(id => this.flats().some(f => f.id === id)));

  pick(id: string) {
    if (!this.compare.toggle(id)) this.toast.show(`You can compare up to ${this.max} flats — untick one first.`, 'info');
  }
  go() { this.router.navigate(['/rent/compare'], { queryParams: { ids: this.picked().join(',') } }); }
}
