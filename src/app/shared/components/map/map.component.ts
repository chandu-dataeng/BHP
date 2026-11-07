import {
  AfterViewInit, Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { BRAND } from '../../../core/brand';
import { ORR_PATH, RRR_PATH } from '../../../core/data/geo';
import { environment } from '../../../../environments/environment';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;      // name (shown on label / hover tooltip)
  subtitle?: string;  // "2BHK | 3BHK"  /  "₹22,000 per sq.yd · Shankarpally"
  color?: string;     // pin colour (Sale heat scale)
  viewed?: boolean;   // already opened by this visitor → eye pin
  muted?: boolean;
}

let googleConfigured = false;

/**
 * Map used on every screen.
 *  • With `environment.googleMapsApiKey` set → real Google Maps (satellite / hybrid view).
 *  • Without a key → free Esri satellite preview (Leaflet), so the app still works during development.
 * Inputs/outputs are identical for both engines.
 *
 * variant 'society' → round building pin + name card (Rent)
 * variant 'pin'     → coloured location pin with hover tooltip (Sale, like plotsview)
 */
@Component({
  selector: 'app-map',
  template: `
    <div #host class="map-host"></div>
    @if (previewNotice()) {
      <div class="notice"><span class="icon xs">info</span> Preview map — add your Google Maps API key in <code>environment.ts</code></div>
    }
  `,
  styleUrl: './map.component.scss',
})
export class MapComponent implements AfterViewInit {
  readonly markers = input<MapMarker[]>([]);
  readonly variant = input<'society' | 'pin'>('society');
  readonly selectedId = input<string | null>(null);
  readonly hoveredId = input<string | null>(null);
  readonly interactive = input(true);
  readonly zoom = input<number | null>(null);
  readonly showRings = input(false);          // ORR (green) + RRR (yellow)
  readonly markerClick = output<string>();

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private destroyRef = inject(DestroyRef);
  readonly previewNotice = signal(false);

  private useGoogle = !!environment.googleMapsApiKey;
  private ready = false;
  private els = new Map<string, HTMLElement>();

  // Google
  private gmap?: google.maps.Map;
  private gMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
  private gRings: google.maps.Polyline[] = [];
  private AdvMarker?: typeof google.maps.marker.AdvancedMarkerElement;

  // Leaflet fallback
  private lmap?: L.Map;
  private lLayer = L.layerGroup();
  private lRings = L.layerGroup();
  private lRefs = new Map<string, L.Marker>();

  constructor() {
    effect(() => { const m = this.markers(); if (this.ready) this.render(m); });
    effect(() => { const s = this.selectedId(); const h = this.hoveredId(); this.highlight(s, h); });
    effect(() => { const r = this.showRings(); if (this.ready) this.drawRings(r); });
  }

  async ngAfterViewInit() {
    const el = this.host().nativeElement;
    if (this.useGoogle) {
      try { await this.initGoogle(el); }
      catch (e) { console.error('Google Maps failed to load — falling back to preview map', e); this.useGoogle = false; this.initLeaflet(el); }
    } else {
      this.initLeaflet(el);
      this.previewNotice.set(!environment.production && this.interactive());
    }
    this.ready = true;
    this.drawRings(this.showRings());
    this.render(this.markers(), true);
  }

  /** Smoothly pan/zoom to a marker (used when a list card is clicked). */
  flyTo(id: string) {
    const m = this.markers().find(x => x.id === id); if (!m) return;
    if (this.gmap) { this.gmap.panTo({ lat: m.lat, lng: m.lng }); if ((this.gmap.getZoom() ?? 0) < 13) this.gmap.setZoom(13); }
    if (this.lmap) this.lmap.flyTo([m.lat, m.lng], Math.max(this.lmap.getZoom(), 13), { duration: .6 });
  }

  /* ======================= Google Maps ======================= */
  private async initGoogle(el: HTMLDivElement) {
    if (!googleConfigured) {
      setOptions({ key: environment.googleMapsApiKey, v: 'weekly', region: 'IN', language: 'en' });
      googleConfigured = true;
    }
    const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([importLibrary('maps'), importLibrary('marker')]);
    this.AdvMarker = AdvancedMarkerElement;
    const interactive = this.interactive();
    this.gmap = new Map(el, {
      center: { lat: BRAND.mapCenter[0], lng: BRAND.mapCenter[1] },
      zoom: BRAND.mapZoom,
      mapId: environment.googleMapId,
      mapTypeId: 'hybrid',                         // satellite + road names
      disableDefaultUI: !interactive,
      mapTypeControl: interactive,
      mapTypeControlOptions: {
        mapTypeIds: ['hybrid', 'roadmap'],
        position: google.maps.ControlPosition.TOP_RIGHT,
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
      },
      zoomControl: interactive,
      fullscreenControl: interactive,
      streetViewControl: false,
      clickableIcons: false,
      gestureHandling: interactive ? 'greedy' : 'none',
    });
    this.gmap.addListener('zoom_changed', () => this.compact(this.gmap!.getZoom() ?? 10));
    this.destroyRef.onDestroy(() => { this.gMarkers.forEach(m => (m.map = null)); this.gRings.forEach(r => r.setMap(null)); });
  }

  /* ======================= Leaflet (preview) ======================= */
  private initLeaflet(el: HTMLDivElement) {
    const interactive = this.interactive();
    this.lmap = L.map(el, {
      center: BRAND.mapCenter, zoom: BRAND.mapZoom, zoomControl: false,
      scrollWheelZoom: interactive, dragging: interactive, attributionControl: true,
    });
    if (interactive) L.control.zoom({ position: 'bottomright' }).addTo(this.lmap);
    this.lmap.attributionControl.setPrefix(false);
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services';
    L.tileLayer(`${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, attribution: 'Imagery © Esri' }).addTo(this.lmap);
    L.tileLayer(`${esri}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, opacity: .7 }).addTo(this.lmap);
    L.tileLayer(`${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19 }).addTo(this.lmap);
    this.lRings.addTo(this.lmap);
    this.lLayer.addTo(this.lmap);
    this.lmap.on('zoomend resize', () => this.compact(this.lmap!.getZoom()));

    const ro = new ResizeObserver(() => this.lmap?.invalidateSize());
    ro.observe(el);
    this.destroyRef.onDestroy(() => { ro.disconnect(); this.lmap?.remove(); });
  }

  /* ======================= Shared ======================= */
  private render(list: MapMarker[], first = false) {
    this.els.clear();
    if (this.gmap && this.AdvMarker) {
      this.gMarkers.forEach(m => (m.map = null));
      this.gMarkers = list.map(m => {
        const el = this.buildEl(m);
        const mk = new this.AdvMarker!({ map: this.gmap, position: { lat: m.lat, lng: m.lng }, content: el, title: m.title, gmpClickable: true });
        mk.addListener('gmp-click', () => this.markerClick.emit(m.id));
        (el as any).__mk = mk;
        return mk;
      });
    }
    if (this.lmap) {
      this.lLayer.clearLayers(); this.lRefs.clear();
      for (const m of list) {
        const el = this.buildEl(m);
        const mk = L.marker([m.lat, m.lng], { icon: L.divIcon({ className: 'mk-wrap', html: el, iconSize: [0, 0], iconAnchor: [0, 0] }), keyboard: true, title: m.title });
        mk.on('click', () => this.markerClick.emit(m.id));
        mk.addTo(this.lLayer);
        this.lRefs.set(m.id, mk);
      }
    }
    this.fit(list, first);
    this.highlight(this.selectedId(), this.hoveredId());
    this.compact(this.gmap?.getZoom() ?? this.lmap?.getZoom() ?? 10);
  }

  private fit(list: MapMarker[], first: boolean) {
    if (!list.length) return;
    const fixedZoom = this.zoom();
    const narrow = this.host().nativeElement.clientWidth < 640;
    const right = this.variant() === 'society' ? (narrow ? 40 : 190) : (narrow ? 30 : 60);
    if (this.gmap) {
      if (fixedZoom && list.length === 1) { this.gmap.setCenter({ lat: list[0].lat, lng: list[0].lng }); this.gmap.setZoom(fixedZoom); return; }
      const b = new google.maps.LatLngBounds();
      list.forEach(m => b.extend({ lat: m.lat, lng: m.lng }));
      this.gmap.fitBounds(b, { top: narrow ? 50 : 70, left: narrow ? 30 : 60, right, bottom: 40 });
      google.maps.event.addListenerOnce(this.gmap, 'idle', () => { if ((this.gmap!.getZoom() ?? 0) > 13) this.gmap!.setZoom(13); });
    }
    if (this.lmap) {
      if (fixedZoom && list.length === 1) { this.lmap.setView([list[0].lat, list[0].lng], fixedZoom); return; }
      const b = L.latLngBounds(list.map(m => [m.lat, m.lng] as [number, number]));
      this.lmap.fitBounds(b, { paddingTopLeft: narrow ? [30, 50] : [60, 70], paddingBottomRight: [right, 40], maxZoom: 13, animate: !first });
    }
  }

  private drawRings(show: boolean) {
    this.gRings.forEach(r => r.setMap(null)); this.gRings = [];
    this.lRings.clearLayers();
    if (!show) return;
    const rings = [{ path: RRR_PATH, color: '#f5c518' }, { path: ORR_PATH, color: '#22c55e' }];
    for (const r of rings) {
      if (this.gmap) {
        this.gRings.push(new google.maps.Polyline({
          map: this.gmap, path: r.path.map(([lat, lng]) => ({ lat, lng })), geodesic: true,
          strokeColor: r.color, strokeOpacity: .95, strokeWeight: 3, clickable: false, zIndex: 1,
        }));
      }
      if (this.lmap) L.polyline(r.path, { color: r.color, weight: 3, opacity: .95, smoothFactor: 1.5, interactive: false }).addTo(this.lRings);
    }
  }

  private highlight(sel: string | null, hov: string | null) {
    this.els.forEach((el, id) => {
      const on = id === sel || id === hov;
      el.classList.toggle('is-selected', id === sel);
      el.classList.toggle('is-hovered', id === hov);
      const gm = (el as any).__mk as google.maps.marker.AdvancedMarkerElement | undefined;
      if (gm) gm.zIndex = on ? 1000 : null;
      this.lRefs.get(id)?.setZIndexOffset(on ? 1000 : 0);
    });
  }

  /** Zoomed far out on a small screen → hide society name cards (they overlap). */
  private compact(zoom: number) {
    const el = this.host().nativeElement;
    el.classList.toggle('compact', zoom < 11 && el.clientWidth < 900);
  }

  /** Marker HTML — a 0×0 anchor with the visual centred on the exact location (same for both engines). */
  private buildEl(m: MapMarker): HTMLElement {
    const root = document.createElement('div');
    root.className = 'mk';
    const esc = (s = '') => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    if (this.variant() === 'pin') {
      root.innerHTML = `
        <div class="vp ${m.viewed ? 'viewed' : ''} ${m.muted ? 'muted' : ''}" style="--c:${m.color ?? '#0a6dff'}">
          <span class="icon fill">${m.viewed ? 'visibility' : 'location_on'}</span>
          <span class="tip"><b>${esc(m.title)}</b>${m.subtitle ? `<small>${esc(m.subtitle)}</small>` : ''}</span>
        </div>`;
    } else {
      root.innerHTML = `
        <div class="soc ${m.muted ? 'muted' : ''}">
          <span class="dot"><span class="icon fill">apartment</span></span>
          <span class="lbl"><b>${esc(m.title)}</b>${m.subtitle ? `<small>${esc(m.subtitle)}</small>` : ''}</span>
        </div>`;
    }
    this.els.set(m.id, root);
    return root;
  }
}
