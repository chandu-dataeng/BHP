import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, delay, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SOCIETIES } from '../data/rent.data';
import { VENTURES } from '../data/sale.data';
import { RentalFlat, Society } from '../models/rent.models';
import { Venture } from '../models/sale.models';
import { AvailabilityAlert, Enquiry, EnquiryResult, ListingReport } from '../models/common.models';
import { MockDbService } from '../mock/mock-db.service';

/**
 * Single place that provides all listing data.
 *
 * Today: returns dummy data. Rent listings come from MockDbService's PUBLIC projection — only flats that
 * BHP Admin has published, with no owner / commercial / workflow fields.
 * Later: set `environment.useMockData = false` and point `apiBaseUrl`
 * at your .NET Core 10 API — the endpoints below are the suggested contract.
 */
@Injectable({ providedIn: 'root' })
export class PropertyService {
  private http = inject(HttpClient);
  private api = environment.apiBaseUrl;
  private mock = environment.useMockData;
  private db = inject(MockDbService);
  private latency = 120;

  /* ---------------- Rent ---------------- */

  /** GET /api/rent/societies */
  getSocieties(): Observable<Society[]> {
    return this.mock ? of(SOCIETIES).pipe(delay(this.latency))
      : this.http.get<Society[]>(`${this.api}/rent/societies`);
  }

  /** GET /api/rent/societies/{id} */
  getSociety(id: string): Observable<Society | undefined> {
    return this.mock ? of(SOCIETIES.find(s => s.id === id)).pipe(delay(this.latency))
      : this.http.get<Society>(`${this.api}/rent/societies/${id}`);
  }

  /** GET /api/rent/flats  (published, not-rented flats — used for map filters) */
  getFlats(): Observable<RentalFlat[]> {
    return this.mock ? of(this.db.publicFlats()).pipe(delay(this.latency))
      : this.http.get<RentalFlat[]>(`${this.api}/rent/flats`);
  }

  /** GET /api/rent/societies/{id}/flats */
  getFlatsBySociety(societyId: string): Observable<RentalFlat[]> {
    return this.mock ? of(this.db.publicFlats().filter(f => f.societyId === societyId)).pipe(delay(this.latency))
      : this.http.get<RentalFlat[]>(`${this.api}/rent/societies/${societyId}/flats`);
  }

  /** GET /api/rent/flats/{id}  (also returns rented flats, flagged, so old links can offer alternatives) */
  getFlat(id: string): Observable<RentalFlat | undefined> {
    return this.mock ? of(this.db.publicFlat(id)).pipe(delay(this.latency))
      : this.http.get<RentalFlat>(`${this.api}/rent/flats/${id}`);
  }

  /* ---------------- Sale ---------------- */

  /** GET /api/sale/ventures */
  getVentures(): Observable<Venture[]> {
    return this.mock ? of(VENTURES).pipe(delay(this.latency))
      : this.http.get<Venture[]>(`${this.api}/sale/ventures`);
  }

  /** GET /api/sale/ventures/{id} */
  getVenture(id: string): Observable<Venture | undefined> {
    return this.mock ? of(VENTURES.find(v => v.id === id)).pipe(delay(this.latency))
      : this.http.get<Venture>(`${this.api}/sale/ventures/${id}`);
  }

  /* ---------------- Leads ---------------- */

  /** POST /api/enquiries  — server de-duplicates (same phone + same property while still open). */
  submitEnquiry(e: Enquiry): Observable<EnquiryResult> {
    return this.mock ? of(this.db.submitEnquiry(e)).pipe(delay(400))
      : this.http.post<EnquiryResult>(`${this.api}/enquiries`, e);
  }

  /** POST /api/listing-reports  — "already rented / wrong price…" from a tenant. */
  reportListing(r: ListingReport): Observable<boolean> {
    if (this.mock) { this.db.reportListing(r); return of(true).pipe(delay(300)); }
    return this.http.post(`${this.api}/listing-reports`, r).pipe(map(() => true));
  }

  /** POST /api/availability-alerts */
  createAlert(a: AvailabilityAlert): Observable<boolean> {
    if (this.mock) { this.db.createAlert(a); return of(true).pipe(delay(300)); }
    return this.http.post(`${this.api}/availability-alerts`, a).pipe(map(() => true));
  }

  /* -------- synchronous helpers (dummy data only, used for small lookups) -------- */
  societyName(id: string) { return SOCIETIES.find(s => s.id === id)?.name ?? ''; }
}
