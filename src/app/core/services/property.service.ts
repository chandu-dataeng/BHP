import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, delay, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BRAND } from '../brand';
import { cleanFeedFlat } from '../data/feed';
import { SOCIETIES } from '../data/rent.data';
import { VENTURES } from '../data/sale.data';
import { RentalFlat, Society } from '../models/rent.models';
import { Venture } from '../models/sale.models';
import { AvailabilityAlert, Enquiry, EnquiryResult, ListingReport } from '../models/common.models';
import { MockDbService } from '../mock/mock-db.service';

/** What the Google Sheet's Apps Script web app returns (approved rows only). */
interface ListingsFeed { updatedAt: string; flats: Partial<RentalFlat>[]; }

/**
 * Single place that provides all listing data.
 *
 * Three modes, chosen by the environment file:
 *  - listingsFeedUrl set (production): rent listings are the approved rows published by the Google Sheet's Apps Script.
 *    Enquiries, reports and alerts open WhatsApp to the business number, pre-filled — there is no server to store them.
 *  - useMockData: dummy data; rent listings come from MockDbService's PUBLIC projection (what BHP Admin published).
 *  - otherwise: the .NET Core API at apiBaseUrl (the endpoints below are the suggested contract).
 */
@Injectable({ providedIn: 'root' })
export class PropertyService {
  private http = inject(HttpClient);
  private api = environment.apiBaseUrl;
  private mock = environment.useMockData;
  private db = inject(MockDbService);
  private latency = 120;

  /** Fetched once per visit and shared by every page. A failed fetch shows no listings rather than breaking the site. */
  private feed$: Observable<RentalFlat[]> | null = environment.listingsFeedUrl
    ? this.http.get<ListingsFeed>(environment.listingsFeedUrl).pipe(
        map(f => (f.flats ?? []).map(cleanFeedFlat).filter((x): x is RentalFlat => !!x)),
        catchError(() => of([] as RentalFlat[])),
        shareReplay(1))
    : null;

  /** True when leads can't be stored anywhere and go to WhatsApp instead. */
  readonly leadsViaWhatsApp = !!environment.listingsFeedUrl;

  /* ---------------- Rent ---------------- */

  /** GET /api/rent/societies */
  getSocieties(): Observable<Society[]> {
    // live feed: only societies that actually have a flat right now — no empty pins on the map
    if (this.feed$) return this.getFlats().pipe(map(fl => SOCIETIES.filter(s => fl.some(f => f.societyId === s.id))));
    return this.mock ? of(SOCIETIES).pipe(delay(this.latency))
      : this.http.get<Society[]>(`${this.api}/rent/societies`);
  }

  /** GET /api/rent/societies/{id} */
  getSociety(id: string): Observable<Society | undefined> {
    return this.mock || this.feed$ ? of(SOCIETIES.find(s => s.id === id)).pipe(delay(this.latency))
      : this.http.get<Society>(`${this.api}/rent/societies/${id}`);
  }

  /** GET /api/rent/flats  (published, not-rented flats — used for map filters) */
  getFlats(): Observable<RentalFlat[]> {
    if (this.feed$) return this.feed$.pipe(map(l => l.filter(f => f.availability !== 'rented')));
    return this.mock ? of(this.db.publicFlats()).pipe(delay(this.latency))
      : this.http.get<RentalFlat[]>(`${this.api}/rent/flats`);
  }

  /** GET /api/rent/societies/{id}/flats */
  getFlatsBySociety(societyId: string): Observable<RentalFlat[]> {
    if (this.feed$) return this.getFlats().pipe(map(l => l.filter(f => f.societyId === societyId)));
    return this.mock ? of(this.db.publicFlats().filter(f => f.societyId === societyId)).pipe(delay(this.latency))
      : this.http.get<RentalFlat[]>(`${this.api}/rent/societies/${societyId}/flats`);
  }

  /** GET /api/rent/flats/{id}  (also returns rented flats, flagged, so old links can offer alternatives) */
  getFlat(id: string): Observable<RentalFlat | undefined> {
    if (this.feed$) return this.feed$.pipe(map(l => l.find(f => f.id === id)));
    return this.mock ? of(this.db.publicFlat(id)).pipe(delay(this.latency))
      : this.http.get<RentalFlat>(`${this.api}/rent/flats/${id}`);
  }

  /* ---------------- Sale ---------------- */

  /** GET /api/sale/ventures */
  getVentures(): Observable<Venture[]> {
    return this.mock || this.feed$ ? of(VENTURES).pipe(delay(this.latency))
      : this.http.get<Venture[]>(`${this.api}/sale/ventures`);
  }

  /** GET /api/sale/ventures/{id} */
  getVenture(id: string): Observable<Venture | undefined> {
    return this.mock || this.feed$ ? of(VENTURES.find(v => v.id === id)).pipe(delay(this.latency))
      : this.http.get<Venture>(`${this.api}/sale/ventures/${id}`);
  }

  /* ---------------- Leads ---------------- */

  /** POST /api/enquiries  — server de-duplicates (same phone + same property while still open). */
  submitEnquiry(e: Enquiry): Observable<EnquiryResult> {
    if (this.leadsViaWhatsApp) {
      const kind = e.type === 'site-visit' ? 'Site visit request' : e.type === 'callback' ? 'Call-back request' : 'Enquiry';
      this.whatsApp([
        `${kind} — ${e.listingTitle} (${e.listingId})`,
        `Name: ${e.name}`, `Phone: ${e.phone}`, e.email && `Email: ${e.email}`,
        e.preferredDate && `Preferred date: ${e.preferredDate}${e.preferredSlot ? `, ${e.preferredSlot}` : ''}`,
        e.message && `Message: ${e.message}`,
      ]);
      return of({ ok: true, duplicate: false, reference: '' });   // synchronous: keeps the popup inside the click
    }
    return this.mock ? of(this.db.submitEnquiry(e)).pipe(delay(400))
      : this.http.post<EnquiryResult>(`${this.api}/enquiries`, e);
  }

  /** POST /api/listing-reports  — "already rented / wrong price…" from a tenant. */
  reportListing(r: ListingReport): Observable<boolean> {
    if (this.leadsViaWhatsApp) {
      this.whatsApp([`Problem with listing ${r.propertyCode}: ${r.reason.replace(/-/g, ' ')}`, r.details && `Details: ${r.details}`, r.phone && `My phone: ${r.phone}`]);
      return of(true);
    }
    if (this.mock) { this.db.reportListing(r); return of(true).pipe(delay(300)); }
    return this.http.post(`${this.api}/listing-reports`, r).pipe(map(() => true));
  }

  /** POST /api/availability-alerts */
  createAlert(a: AvailabilityAlert): Observable<boolean> {
    if (this.leadsViaWhatsApp) {
      const soc = a.societyId ? this.societyName(a.societyId) : a.locality;
      this.whatsApp([`Please tell me when a flat opens up`, `Name: ${a.name}`, `Phone: ${a.phone}`,
        soc && `Where: ${soc}`, a.bhk && `BHK: ${a.bhk}`, a.maxBudget && `Budget up to: ₹${a.maxBudget.toLocaleString('en-IN')}`]);
      return of(true);
    }
    if (this.mock) { this.db.createAlert(a); return of(true).pipe(delay(300)); }
    return this.http.post(`${this.api}/availability-alerts`, a).pipe(map(() => true));
  }

  private whatsApp(lines: (string | number | false | undefined | null)[]) {
    const text = lines.filter(Boolean).join('\n');
    window.open(`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  /* -------- synchronous helpers (dummy data only, used for small lookups) -------- */
  societyName(id: string) { return SOCIETIES.find(s => s.id === id)?.name ?? ''; }
}
