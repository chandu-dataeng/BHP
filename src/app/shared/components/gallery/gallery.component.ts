import { Component, HostListener, computed, input, signal } from '@angular/core';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { MapComponent, MapMarker } from '../map/map.component';

export interface GalleryTab { key: string; label: string; images?: string[]; }

/** Big photo viewer with tabs (Photos / Video / Floor Plan / Society / Map), thumbnails and full-screen mode. */
@Component({
  selector: 'app-gallery',
  imports: [ImgFallbackDirective, MapComponent],
  template: `
    <div class="viewer">
      @if (tab() === 'map') {
        <app-map [markers]="marker()" [zoom]="14" [selectedId]="'x'" />
      } @else if (current().length) {
        <img [src]="current()[index()]" [appImgFallback]="fallback()" alt="Property photo" (click)="full.set(true)">
        @if (current().length > 1) {
          <button class="nav prev" aria-label="Previous" (click)="prev()"><span class="icon">chevron_left</span></button>
          <button class="nav next" aria-label="Next" (click)="next()"><span class="icon">chevron_right</span></button>
        }
        <span class="count">{{ index() + 1 }}/{{ current().length }}</span>
        <button class="expand" aria-label="Full screen" (click)="full.set(true)"><span class="icon sm">fullscreen</span></button>
      } @else {
        <div class="empty"><span class="icon lg">{{ tab() === 'video' ? 'videocam' : 'architecture' }}</span>
          <p>{{ tab() === 'video' ? 'Video walkthrough' : 'Floor plan' }} will be available soon.<br>Ask our team for it on WhatsApp.</p></div>
      }
    </div>

    <div class="tabs">
      @for (t of tabs(); track t.key) {
        <button [class.active]="tab() === t.key" (click)="select(t.key)">{{ t.label }}</button>
      }
    </div>

    @if (tab() !== 'map' && current().length > 1) {
      <div class="thumbs">
        @for (src of current(); track $index) {
          <button [class.active]="$index === index()" (click)="index.set($index)">
            <img [src]="src" [appImgFallback]="fallback()" alt="" loading="lazy">
          </button>
        }
      </div>
    }

    @if (full()) {
      <div class="lightbox" (click)="full.set(false)">
        <img [src]="current()[index()]" [appImgFallback]="fallback()" alt="" (click)="$event.stopPropagation()">
        <button class="lb-close" aria-label="Close"><span class="icon">close</span></button>
        <button class="nav prev" (click)="prev(); $event.stopPropagation()"><span class="icon">chevron_left</span></button>
        <button class="nav next" (click)="next(); $event.stopPropagation()"><span class="icon">chevron_right</span></button>
        <span class="count">{{ index() + 1 }}/{{ current().length }}</span>
      </div>
    }
  `,
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent {
  readonly tabs = input.required<GalleryTab[]>();
  readonly lat = input(0);
  readonly lng = input(0);
  readonly title = input('');
  readonly fallback = input<'building' | 'interior' | 'land'>('interior');

  readonly tab = signal('photos');
  readonly index = signal(0);
  readonly full = signal(false);

  readonly current = computed(() => this.tabs().find(t => t.key === this.tab())?.images ?? []);
  readonly marker = computed<MapMarker[]>(() => [{ id: 'x', lat: this.lat(), lng: this.lng(), title: this.title() }]);

  select(k: string) { this.tab.set(k); this.index.set(0); }
  next() { const n = this.current().length; this.index.update(i => (i + 1) % n); }
  prev() { const n = this.current().length; this.index.update(i => (i - 1 + n) % n); }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (!this.current().length) return;
    if (e.key === 'ArrowRight') this.next();
    if (e.key === 'ArrowLeft') this.prev();
    if (e.key === 'Escape') this.full.set(false);
  }
}
