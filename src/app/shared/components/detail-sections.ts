/**
 * Reusable sections for the detail pages (flat detail & venture detail):
 * Contact card · Amenities · Location · Nearby places · Reviews
 */
import { Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BRAND } from '../../core/brand';
import { AMENITY_META, NEARBY_COLOR, NEARBY_ICON } from '../../core/data/amenities';
import { AmenityKey, NearbyCategory, NearbyPlace, Review } from '../../core/models/common.models';
import { EnquiryDialogComponent } from './enquiry-dialog/enquiry-dialog.component';
import { MapComponent, MapMarker } from './map/map.component';
import { ModalComponent } from './modal/modal.component';

/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-contact-card',
  imports: [EnquiryDialogComponent],
  template: `
    <section class="card pad">
      <h3 class="card-title"><span class="icon fill">mail</span> Contact {{ brand.name }} Team</h3>
      <p class="muted sub">Have questions? We're here to help.</p>
      <div class="two">
        <a class="btn btn-green" [href]="tel"><span class="icon sm fill">call</span> Call Now</a>
        <a class="btn btn-primary" [href]="waLink()" target="_blank" rel="noopener"><span class="icon sm">chat</span> WhatsApp</a>
      </div>
      <button class="btn btn-outline btn-block" (click)="dialog.set('message')"><span class="icon sm">sms</span> Message to {{ brand.name }} Team</button>
      <button class="btn btn-outline btn-block" (click)="dialog.set('site-visit')"><span class="icon sm">calendar_month</span> Schedule a Site Visit</button>
    </section>
    @if (dialog(); as m) {
      <app-enquiry-dialog [mode]="m" [listingType]="listingType()" [listingId]="listingId()" [listingTitle]="listingTitle()" (closed)="dialog.set(null)" />
    }
  `,
  styles: `
    .pad { padding: 18px; }
    .sub { margin: 4px 0 14px; font-size: 13.5px; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .btn-block + .btn-block { margin-top: 10px; }
  `,
})
export class ContactCardComponent {
  readonly listingType = input.required<'rent' | 'sale'>();
  readonly listingId = input.required<string>();
  readonly listingTitle = input.required<string>();
  readonly brand = BRAND;
  readonly dialog = signal<'message' | 'site-visit' | null>(null);
  readonly tel = 'tel:' + BRAND.phone.replace(/\s/g, '');
  readonly waLink = computed(() =>
    `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(`Hi ${BRAND.name}, I'm interested in ${this.listingTitle()} (${this.listingId()}).`)}`);
}

/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-amenities',
  template: `
    <section class="card pad">
      <h3 class="card-title"><span class="icon">widgets</span> {{ title() }}</h3>
      <div class="grid">
        @for (a of shown(); track a) {
          <div class="am"><span class="icon">{{ meta[a].icon }}</span><span>{{ meta[a].label }}</span></div>
        }
      </div>
      @if (items().length > limit && !all()) {
        <button class="more" (click)="all.set(true)">+ {{ items().length - limit }} more amenities</button>
      }
    </section>
  `,
  styles: `
    .pad { padding: 18px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 8px; margin-top: 16px; }
    .am { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; font-size: 12.5px; color: #374151;
      .icon { font-size: 30px; color: var(--navy); } }
    .more { margin-top: 14px; border: 0; background: none; color: var(--primary); font-weight: 600; cursor: pointer; padding: 0; }
    @media (max-width: 480px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  `,
})
export class AmenitiesComponent {
  readonly items = input.required<AmenityKey[]>();
  readonly title = input('Amenities');
  readonly meta = AMENITY_META;
  readonly limit = 8;
  readonly all = signal(false);
  readonly shown = computed(() => this.all() ? this.items() : this.items().slice(0, this.limit));
}

/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-location-card',
  imports: [MapComponent],
  template: `
    <section class="card pad">
      <h3 class="card-title"><span class="icon fill">location_on</span> Location</h3>
      <div class="mini"><app-map [markers]="marker()" [variant]="'society'" [zoom]="14" [interactive]="false" [selectedId]="'x'" /></div>
      <div class="addr">
        <span class="icon sm">location_on</span>
        <div><b>{{ name() }}</b><div class="muted">{{ address() }}</div></div>
      </div>
      <a class="gm" [href]="gmaps()" target="_blank" rel="noopener"><span class="icon sm">map</span> View on Google Maps</a>
    </section>
  `,
  styles: `
    .pad { padding: 18px; }
    .mini { height: 150px; border-radius: 10px; overflow: hidden; margin: 14px 0 12px; position: relative; }
    .addr { display: flex; gap: 8px; font-size: 14px; .muted { font-size: 13.5px; margin-top: 2px; } }
    .gm { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-weight: 600; font-size: 14px; }
  `,
})
export class LocationCardComponent {
  readonly name = input.required<string>();
  readonly address = input.required<string>();
  readonly lat = input.required<number>();
  readonly lng = input.required<number>();
  readonly marker = computed<MapMarker[]>(() => [{ id: 'x', lat: this.lat(), lng: this.lng(), title: this.name() }]);
  readonly gmaps = computed(() => `https://www.google.com/maps/search/?api=1&query=${this.lat()},${this.lng()}`);
}

/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-nearby',
  template: `
    <section class="card pad">
      <h3 class="card-title"><span class="icon fill">pin_drop</span> Nearby Places &amp; Landmarks</h3>
      <div class="tabs">
        @for (c of categories(); track c) {
          <button class="tab" [class.active]="current() === c" (click)="active.set(c)">{{ c }}</button>
        }
      </div>
      <ul class="list">
        @for (p of filtered(); track p.name) {
          <li><span class="icon sm" [style.color]="color[p.category]">{{ icon[p.category] }}</span>
            <span class="nm">{{ p.name }}</span><span class="km">{{ p.distanceKm }} km ({{ p.minutes }} mins)</span></li>
        }
      </ul>
      <h4 class="wn">What's Nearby?</h4>
      <div class="feat">
        @for (p of featured(); track p.name) {
          <div class="f">
            <span class="fi" [style.color]="color[p.category]" [style.background]="color[p.category] + '14'"><span class="icon">{{ icon[p.category] }}</span></span>
            <div><b>{{ p.name }}</b><small>{{ p.distanceKm }} km ({{ p.minutes }} mins)</small></div>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .pad { padding: 18px; }
    .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 14px 0 6px; }
    .tab { border: 1px solid var(--border); background: #fff; border-radius: 6px; padding: 5px 10px; font-size: 12.5px; cursor: pointer; color: #374151;
      &.active { background: var(--primary-soft); border-color: #b9d3ff; color: var(--primary); font-weight: 600; } }
    .list { list-style: none; margin: 0; padding: 0;
      li { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-bottom: 1px solid var(--border); font-size: 13.5px; }
      .nm { flex: 1; } .km { color: var(--muted); font-size: 12.5px; white-space: nowrap; } }
    .wn { font-size: 15px; margin: 18px 0 10px; }
    .feat { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .f { display: flex; gap: 10px; align-items: center; border: 1px solid var(--border); border-radius: 10px; padding: 10px;
      b { display: block; font-size: 13px; font-weight: 600; } small { color: var(--muted); font-size: 12px; } }
    .fi { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; flex: none; }
  `,
})
export class NearbyComponent {
  readonly places = input.required<NearbyPlace[]>();
  readonly icon = NEARBY_ICON;
  readonly color = NEARBY_COLOR;
  readonly categories = computed(() => [...new Set(this.places().map(p => p.category))]);
  readonly active = signal<NearbyCategory | null>(null);
  readonly current = computed(() => this.active() ?? this.categories()[0]);
  readonly filtered = computed(() => this.places().filter(p => p.category === this.current()));
  /** One closest place per category (max 4) for the "What's nearby" tiles. */
  readonly featured = computed(() => {
    const seen = new Set<string>();
    return [...this.places()].sort((a, b) => a.distanceKm - b.distanceKm)
      .filter(p => !seen.has(p.category) && seen.add(p.category)).slice(0, 4);
  });
}

/* ------------------------------------------------------------------ */
@Component({
  selector: 'app-reviews',
  imports: [DatePipe, ModalComponent],
  template: `
    <section class="card pad">
      <div class="top">
        <h3 class="card-title"><span class="icon fill">reviews</span> {{ title() }}</h3>
        <button class="btn btn-outline btn-sm" (click)="writing.set(true)">Write a Review</button>
      </div>
      <div class="summary">
        <b>{{ rating() }}</b>
        <span class="stars">@for (s of [1,2,3,4,5]; track s) { <span class="icon" [class.fill]="s <= rating() + .25">star</span> }</span>
        <span class="muted">({{ count() }} reviews)</span>
      </div>
      @for (r of list(); track r.id) {
        <div class="rv">
          <span class="av" [style.background]="avatar(r.author)">{{ r.author[0] }}</span>
          <div class="body">
            <b>{{ r.author }}</b>
            <div class="meta"><span class="stars">@for (s of [1,2,3,4,5]; track s) { <span class="icon" [class.fill]="s <= r.rating">star</span> }</span>
              <span class="muted">{{ r.date | date: 'MMM y' }}</span></div>
            <p>{{ r.comment }}</p>
          </div>
        </div>
      }
    </section>

    @if (writing()) {
      <app-modal [width]="440" (close)="writing.set(false)">
        <div class="wr">
          <h3>Write a Review</h3>
          <div class="pick">@for (s of [1,2,3,4,5]; track s) {
            <button type="button" (click)="draftRating.set(s)"><span class="icon lg" [class.fill]="s <= draftRating()">star</span></button> }</div>
          <div class="field"><label>Your name</label><input #n class="input" placeholder="Name"></div>
          <div class="field"><label>Your experience</label><textarea #c class="input" rows="4" placeholder="Tell others about the society, maintenance, security…"></textarea></div>
          <button class="btn btn-primary btn-block" (click)="add(n.value, c.value)">Post Review</button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .pad { padding: 18px; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .summary { display: flex; align-items: center; gap: 8px; margin: 12px 0 4px; b { font-size: 22px; } }
    .rv { display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--border); &:last-child { border: 0; } }
    .av { width: 36px; height: 36px; border-radius: 50%; color: #fff; display: grid; place-items: center; font-weight: 700; flex: none; }
    .body { b { font-size: 14px; } p { margin: 6px 0 0; font-size: 13.5px; color: #374151; line-height: 1.5; } }
    .meta { display: flex; gap: 8px; align-items: center; font-size: 12.5px; .icon { font-size: 16px; } }
    .wr { padding: 24px; h3 { margin-bottom: 10px; } }
    .pick { display: flex; gap: 2px; margin-bottom: 12px; button { border: 0; background: none; cursor: pointer; color: var(--star); padding: 0; } }
  `,
})
export class ReviewsComponent {
  readonly reviews = input.required<Review[]>();
  readonly rating = input.required<number>();
  readonly count = input.required<number>();
  readonly title = input('Reviews & Feedback');
  private added = signal<Review[]>([]);
  readonly list = computed(() => [...this.added(), ...this.reviews()]);
  readonly writing = signal(false);
  readonly draftRating = signal(5);

  avatar(name: string) {
    const c = ['#7c4dff', '#e2305c', '#0a6dff', '#11a54f', '#f5a524', '#0c2a4c'];
    return c[name.charCodeAt(0) % c.length];
  }
  add(author: string, comment: string) {
    if (!author.trim() || !comment.trim()) return;
    this.added.update(l => [{ id: crypto.randomUUID(), author: author.trim(), comment: comment.trim(), rating: this.draftRating(), date: new Date().toISOString() }, ...l]);
    this.writing.set(false);
  }
}
