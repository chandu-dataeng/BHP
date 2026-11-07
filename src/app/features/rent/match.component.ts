import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PropertyService } from '../../core/services/property.service';
import { Furnishing, RentalFlat, Society } from '../../core/models/rent.models';
import { EMPTY_REQUIREMENT, TenantRequirement, matchFlats } from '../../core/matching/matching';
import { extractRequirement } from '../../core/ai/text-extract';
import { totalMonthly } from '../../core/policy/availability';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { AvailabilityComponent } from '../../shared/components/availability/availability.component';
import { AlertDialogComponent } from '../../shared/components/alert-dialog/alert-dialog.component';
import { EnquiryDialogComponent } from '../../shared/components/enquiry-dialog/enquiry-dialog.component';

/**
 * RENT · "Tell us what you need" — tenant describes the requirement (free text or form),
 * hard constraints filter, soft preferences rank, every result explains itself.
 */
@Component({
  selector: 'app-match',
  imports: [FormsModule, RouterLink, InrPipe, ImgFallbackDirective, AvailabilityComponent, AlertDialogComponent, EnquiryDialogComponent],
  template: `
    <div class="container wrap">
      <header class="hd">
        <h1>Tell us what you need</h1>
        <p class="muted">Describe your ideal flat in your own words, or use the filters. We only show flats that meet your must-haves.</p>
      </header>

      <div class="layout">
        <aside class="card form">
          <label class="lbl">Describe it <span class="tag">beta</span></label>
          <textarea class="input" rows="4" [(ngModel)]="text"
            placeholder="e.g. 3 BHK in Kondapur or Gachibowli under 75k including maintenance, semi-furnished, need car parking, moving next week"></textarea>
          <button class="btn btn-outline btn-sm btn-block" (click)="understand()" [disabled]="!text.trim()">
            <span class="icon sm">auto_awesome</span> Fill the form from my text</button>
          @if (found().length) {
            <p class="found"><span class="icon xs">check</span> Understood: {{ found().join(' · ') }}. Please check below.</p>
          }

          <div class="divider"></div>

          <label class="lbl">Localities</label>
          <div class="chips">
            @for (l of localities(); track l) {
              <button class="chip" [class.active]="req().localities.includes(l)" (click)="toggle('localities', l)">{{ l }}</button>
            }
          </div>

          <label class="lbl">BHK</label>
          <div class="chips">
            @for (b of [1, 2, 3, 4]; track b) {
              <button class="chip" [class.active]="req().bhk.includes(b)" (click)="toggle('bhk', b)">{{ b }} BHK</button>
            }
          </div>

          <label class="lbl">Maximum monthly budget</label>
          <div class="budget">
            <input class="input" type="number" min="0" step="1000" placeholder="e.g. 70000" [ngModel]="req().budget" (ngModelChange)="set('budget', $event || null)">
            <select class="input" [ngModel]="req().budgetType" (ngModelChange)="set('budgetType', $event)">
              <option value="total">incl. maintenance</option>
              <option value="rent">rent only</option>
            </select>
          </div>

          <label class="lbl">Furnishing <small class="muted">(preference)</small></label>
          <div class="chips">
            @for (f of furnishings; track f) {
              <button class="chip" [class.active]="req().furnishing.includes(f)" (click)="toggle('furnishing', f)">{{ f }}</button>
            }
          </div>

          <label class="lbl">Who is moving in</label>
          <select class="input" [ngModel]="req().tenantType" (ngModelChange)="set('tenantType', $event)">
            <option [ngValue]="null">Doesn't matter</option>
            <option value="Family Only">Family</option>
            <option value="Bachelors Only">Bachelor(s)</option>
          </select>

          <label class="lbl">Move in by <small class="muted">(preference)</small></label>
          <input class="input" type="date" [ngModel]="req().moveInBy" (ngModelChange)="set('moveInBy', $event || null)">

          <div class="checks">
            <label><input type="checkbox" [ngModel]="req().parkingRequired" (ngModelChange)="set('parkingRequired', $event)"> Car parking required</label>
            <label><input type="checkbox" [ngModel]="req().petsRequired" (ngModelChange)="set('petsRequired', $event)"> I have pets</label>
          </div>
          <button class="btn btn-ghost btn-sm btn-block" (click)="reset()"><span class="icon sm">restart_alt</span> Reset</button>
        </aside>

        <section class="results">
          <div class="rh">
            <b>{{ result().matches.length }} {{ result().matches.length === 1 ? 'flat matches' : 'flats match' }}</b>
            @if (result().rejected.length && hasCriteria()) {
              <button class="link" (click)="showRejected.set(!showRejected())">
                {{ showRejected() ? 'Hide' : 'Why not the other' }} {{ result().rejected.length }}?</button>
            }
          </div>

          @for (m of result().matches; track m.flat.id; let i = $index) {
            <article class="card res">
              <a class="ph" [routerLink]="['/rent/flat', m.flat.id]">
                <img [src]="m.flat.images[0]" appImgFallback="interior" alt="" loading="lazy">
                @if (i === 0 && hasCriteria()) { <span class="badge badge-navy best">Best match</span> }
              </a>
              <div class="bd">
                <div class="top">
                  <div>
                    <a [routerLink]="['/rent/flat', m.flat.id]"><h3>{{ m.flat.bhk }} BHK · {{ m.society.name }}</h3></a>
                    <p class="muted loc">{{ m.society.locality }} · {{ m.flat.areaSqft }} sq.ft · {{ m.flat.furnishing }}</p>
                  </div>
                  <div class="pr">
                    <span class="price">{{ total(m.flat) | inr }}</span><small class="muted">/mo all-in</small>
                    <small class="muted">{{ m.flat.rent | inr }} + {{ m.flat.maintenance | inr }}</small>
                  </div>
                </div>
                <ul class="why">
                  @for (r of m.reasons; track r) { <li class="ok"><span class="icon xs">check_circle</span>{{ r }}</li> }
                  @for (r of m.misses; track r) { <li class="miss"><span class="icon xs">info</span>{{ r }}</li> }
                </ul>
                <div class="ft">
                  <app-availability [flat]="m.flat" />
                  <span class="code muted">{{ m.flat.code }}</span>
                  <span class="sp"></span>
                  <button class="btn btn-outline btn-sm" (click)="visitFor.set(m.flat)">Book visit</button>
                  <a class="btn btn-primary btn-sm" [routerLink]="['/rent/flat', m.flat.id]">Details</a>
                </div>
              </div>
            </article>
          } @empty {
            <div class="card empty">
              <span class="icon lg">search_off</span>
              <h3>No flat meets all your must-haves right now</h3>
              <p class="muted">Try widening the budget or localities — or let us notify you when one opens up.</p>
              <button class="btn btn-primary" (click)="alertOpen.set(true)"><span class="icon sm">notifications</span> Notify me</button>
            </div>
          }

          @if (showRejected()) {
            <h4 class="rj-h">Not shown — fails a must-have</h4>
            @for (r of result().rejected; track r.flat.id) {
              <div class="rj">
                <span>{{ r.flat.bhk }} BHK · {{ r.society.name }} · {{ r.flat.rent | inr }}</span>
                <span class="muted">{{ r.failed.join(' · ') }}</span>
              </div>
            }
          }

          @if (result().matches.length) {
            <p class="foot muted">Not quite right? <button class="link" (click)="alertOpen.set(true)">Get alerts for new matches</button></p>
          }
        </section>
      </div>
    </div>

    @if (alertOpen()) {
      <app-alert-dialog [locality]="req().localities.join(', ')" [bhk]="req().bhk.length ? req().bhk[0] : null" [maxBudget]="req().budget"
        summary="a flat matching your requirement" (closed)="alertOpen.set(false)" />
    }
    @if (visitFor(); as f) {
      <app-enquiry-dialog mode="site-visit" listingType="rent" [listingId]="f.code" [listingTitle]="f.title + ' (' + f.code + ')'" (closed)="visitFor.set(null)" />
    }
  `,
  styles: `
    .wrap { padding: 24px 20px 48px; }
    .hd h1 { font-size: 26px; } .hd p { margin: 6px 0 20px; }
    .layout { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
    .form { padding: 18px; position: sticky; top: calc(var(--header-h) + 16px); max-height: calc(100vh - var(--header-h) - 32px); overflow: auto; scrollbar-width: thin; }
    .lbl { display: block; font-size: 12.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .4px; margin: 14px 0 8px;
      &:first-child { margin-top: 0; } }
    .tag { background: var(--primary-soft); color: var(--primary-dark); border-radius: 4px; padding: 1px 5px; font-size: 10px; margin-left: 4px; }
    textarea { margin-bottom: 8px; font-size: 14px; }
    .found { font-size: 12.5px; color: var(--green-text); background: var(--green-soft); padding: 8px 10px; border-radius: 8px; margin: 10px 0 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; .chip { height: 32px; font-size: 13px; } }
    .budget { display: grid; grid-template-columns: 1fr 150px; gap: 8px; }
    .checks { display: grid; gap: 8px; margin: 16px 0; font-size: 14px; label { display: flex; gap: 8px; align-items: center; } input { accent-color: var(--primary); width: 16px; height: 16px; } }
    .rh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 15px; }
    .link { border: 0; background: none; color: var(--primary); font-weight: 600; cursor: pointer; padding: 0; font-size: 14px; }
    .res { display: flex; gap: 14px; padding: 12px; margin-bottom: 12px; }
    .ph { position: relative; width: 200px; flex: none; border-radius: 10px; overflow: hidden; background: #dfe6ee;
      img { width: 100%; height: 100%; object-fit: cover; min-height: 150px; } .best { position: absolute; top: 8px; left: 8px; } }
    .bd { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .top { display: flex; justify-content: space-between; gap: 10px; h3 { font-size: 16.5px; color: var(--text); } .loc { font-size: 13px; margin: 3px 0 0; } }
    .pr { text-align: right; display: flex; flex-direction: column; .price { font-size: 19px; } small { font-size: 12px; } }
    .why { list-style: none; padding: 0; margin: 10px 0; display: flex; flex-wrap: wrap; gap: 6px;
      li { display: inline-flex; gap: 4px; align-items: center; font-size: 12.5px; padding: 3px 8px; border-radius: 6px; }
      .ok { background: var(--green-soft); color: var(--green-text); } .miss { background: var(--amber-soft); color: #8a5600; } }
    .ft { margin-top: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; .sp { flex: 1; } .code { font-size: 12px; } }
    .empty { padding: 32px; text-align: center; .icon { color: var(--navy); } h3 { margin: 8px 0 4px; } p { margin: 0 0 16px; } }
    .rj-h { margin: 20px 0 8px; font-size: 14px; }
    .rj { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 13px; background: #fff; }
    .foot { text-align: center; margin-top: 16px; font-size: 14px; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; } .form { position: static; max-height: none; }
      .res { flex-direction: column; } .ph { width: 100%; img { min-height: 180px; max-height: 200px; } }
    }
  `,
})
export class MatchComponent {
  private api = inject(PropertyService);
  private flats = toSignal(this.api.getFlats(), { initialValue: [] as RentalFlat[] });
  private societies = toSignal(this.api.getSocieties(), { initialValue: [] as Society[] });

  readonly furnishings: Furnishing[] = ['Furnished', 'Semi Furnished', 'Unfurnished'];
  readonly localities = computed(() => [...new Set(this.societies().map(s => s.locality))].sort());

  text = '';
  readonly req: WritableSignal<TenantRequirement> = signal({ ...EMPTY_REQUIREMENT });
  readonly found = signal<string[]>([]);
  readonly showRejected = signal(false);
  readonly alertOpen = signal(false);
  readonly visitFor = signal<RentalFlat | null>(null);

  readonly result = computed(() => matchFlats(this.req(), this.flats(), this.societies()));
  readonly hasCriteria = computed(() => {
    const r = this.req();
    return !!(r.localities.length || r.bhk.length || r.budget || r.furnishing.length || r.parkingRequired || r.petsRequired || r.tenantType || r.moveInBy);
  });

  set<K extends keyof TenantRequirement>(k: K, v: TenantRequirement[K]) { this.req.update(r => ({ ...r, [k]: v })); }

  toggle(k: 'localities' | 'bhk' | 'furnishing', v: string | number) {
    this.req.update(r => {
      const list = r[k] as (string | number)[];
      return { ...r, [k]: list.includes(v) ? list.filter(x => x !== v) : [...list, v] };
    });
  }

  understand() {
    const { requirement, found } = extractRequirement(this.text, this.societies());
    this.req.set(requirement);
    this.found.set(found.length ? found : ['nothing specific — please use the filters']);
  }

  reset() { this.req.set({ ...EMPTY_REQUIREMENT }); this.text = ''; this.found.set([]); }
  total(f: RentalFlat) { return totalMonthly(f); }
}
