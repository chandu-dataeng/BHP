# FindFlat × BHP — Rental discovery + brokerage operating system (Hyderabad)

Angular 21 front-end with two parts:

- **FindFlat**, the public site where tenants discover flats by society.
- **BHP Admin**, the internal operating system for the brokerage, at `/admin`.

It uses standalone components, signals, zoneless change detection and lazy-loaded routes. The backend is not built yet,
so everything runs on in-browser mock data that follows the planned API contract.

> Brand, phone, WhatsApp number and email are set in **`src/app/core/brand.ts`**.

## Run it

```bash
npm install
npm start            # http://localhost:4200
npm run build        # production build → dist/nestly/browser
```

Requires Node 20.19+ / 22.12+ (Angular 21).

## Screens & flow

| Route | Screen |
|---|---|
| `/` | **Screen 1**: two cards, *Buy Plots & Ventures* and *Rent a Flat* |
| `/sale` | **Sale**: plotsview-style layout with filters (budget, plot size, approval, status, sort), a list of ventures and a map with price tags |
| (dialog) | Tap a price tag or card to open the **Venture popup**: photos, approvals, ₹/sq.yd, available plot sizes, WhatsApp |
| `/sale/venture/:id` | **Venture detail**: gallery, EMI calculator, key details, contact, location, amenities, nearby places, reviews |
| `/rent` | **Rent screen 1**: society pins on the map with filters (BHK, rent, furnishing, tenant type, verified) |
| (dialog) | **Rent screen 2**: society popup with BHK rows (grey = 0 units, green or amber = available) |
| `/rent/society/:id?bhk=3` | **Rent screen 3**: BHK tabs, a slider of flats and all units |
| `/rent/flat/:id` | **Rent screen 4**: full property detail page, as in the reference image |
| `/rent/match` | **Tell us what you need**: free text or a form produces structured requirements. Must-haves (budget incl. maintenance, BHK, locality, parking, pets, tenant type, availability) filter flats out. Preferences only change the ranking, and every result says why it matches |
| `/saved` | Saved / favourite listings, stored in the browser |
| `/admin` | **BHP Admin** (see below) |

Public-site rules that come from the BHP operating model:
- **Availability freshness**: every flat says when it was last confirmed. After 7 days the label changes to
  "reconfirming" (`core/policy/availability.ts`). Rented flats leave the map. An old link to a rented flat shows alternatives.
- **Total monthly cost**: the budget filter can mean rent only or rent + maintenance.
- **Report a problem** on any flat sends the report to the admin verification queue. **Notify me** saves an availability alert.
- Enquiries carry the Property ID (`FF-001245`). A repeat enquiry from the same phone for the same flat is linked to the existing lead.
- The public site only receives the `RentalFlat` projection. Owner, source, commercial and workflow fields never leave
  the BHP side (`MockDbService.toPublicFlat`).

## BHP Admin (`/admin`)

Demo sign-in: choose any staff account to see what that role can see and do. The roles are Super Admin, Business Owner,
Operations Manager, Department Manager, Sourcer, Verifier, Telecaller, Site Visit Executive, External Agent and Auditor.

| Screen | What it does |
|---|---|
| Dashboard | Changes by role. The business owner sees inventory, economics, the enquiry funnel, exceptions and society performance. Executives see their work for today |
| Properties | One record per physical flat. Columns and fields are redacted by role: owner contact and commercial terms are hidden unless permitted. Agents see only their own submissions |
| Add property | Source → **AI-assisted intake** (paste a WhatsApp message) → details → **duplicate check** → owner & authorization → review. It creates a draft or submits it for verification |
| Verification | Prioritised queue covering tenant reports, conflicts, upcoming visits, new submissions and stale checks. Recording a check needs who confirmed it, how, and evidence. A rent change becomes a pending change |
| Approvals | A 7-point publish checklist (authorization, owner, fresh availability, no conflict, required fields, photos, no duplicate), plus separation of duties: you cannot approve what you sourced. Rent changes are also approved here |
| Duplicates | Side-by-side evidence, then decide: different flats, link, or merge |
| Societies / Sources & agents / Owners | Master data. Source performance shows plain counts, with no automatic scoring |
| Team & roles | Deactivating a user removes access immediately and re-assigns their open work. Includes the role × permission matrix |
| Audit log | Append-only record of who changed what and when |

The **CRM & transactions** slice is not built yet: enquiries, site visits, negotiation, deal closure, brokerage and payouts.
It is greyed out in the sidebar.

Things to try:
1. Sign in as **Anil (Ops Manager)**. Approvals blocks FF-001303 because Anil sourced it. Switch to **Shiva** and approve it.
2. As **Suresh (Verifier)**, record "Rented out" on a published flat. It disappears from `/rent`, and its open enquiries are flagged.
3. On any public flat page, click 🚩 to report a problem. It appears at the top of the verification queue.
4. As **Kiran (Sourcer)**, add a property in Lakeview Heights, Tower B, flat 1203. The duplicate check flags it.

Admin changes are saved in `localStorage` (`findflat.mockdb`). Use **Reset demo data** in the sidebar to restore the samples.

> ⚠ Permissions in the frontend shape the UI only. The .NET API must enforce the same matrix (`core/admin/permissions.ts`),
> row-level scoping and field redaction on every request. `AdminService` already behaves that way, so screens are written
> against redacted data.

Contact actions work end-to-end in mock mode:
- **Call**: opens a `tel:` link.
- **WhatsApp**: opens `wa.me` with a pre-filled message.
- **Message** and **Site Visit**: open a form dialog that calls `submitEnquiry()`.

## Project structure

```
src/app
├── core
│   ├── brand.ts                 ← brand name, phone, WhatsApp, map centre
│   ├── models/                  ← Society, RentalFlat, Venture, Plot, Enquiry …
│   ├── data/                    ← DUMMY DATA (8 societies, 20 flats, 8 ventures, ~350 plots)
│   ├── policy/availability.ts   ← freshness rules (7-day confirmation window), total-cost helper
│   ├── matching/matching.ts     ← deterministic tenant ↔ flat matching (hard filters + soft ranking)
│   ├── ai/text-extract.ts       ← MOCK "AI" extraction (WhatsApp message → property draft, text → requirement)
│   ├── admin/                   ← BHP models, roles & permissions, auth (demo), AdminService, duplicates, publish rules
│   ├── mock/                    ← MockDbService (in-browser DB + public projection) and admin seed data
│   └── services/
│       ├── property.service.ts  ← the ONLY place the public site loads data from (mock ↔ API switch)
│       ├── saved.service.ts
│       └── toast.service.ts
├── shared
│   ├── components/  map (Leaflet), modal, dropdown, gallery, enquiry-dialog,
│   │                header, footer, detail-sections (contact/amenities/location/nearby/reviews)
│   ├── styles/      shared SCSS for map pages & detail pages
│   ├── pipes/       inr ("₹58,000"), inrShort ("₹44 L")
│   └── directives/  img-fallback (shows a local illustration if a photo fails)
└── features
    ├── home/   sale/   rent/   saved/
    └── admin/  ← BHP Admin: shell, login, dashboard, properties/, verification/, approvals, duplicates, directory, team, audit
```

Theme colours (navy `#0C2A4C`, blue `#0A6DFF`, green `#11A54F` and others) were sampled from the
reference image. They live as CSS variables at the top of `src/styles.scss`.

## Replacing the dummy data

- **Photos**: dummy photos are free Unsplash URLs in `core/data/images.ts`. Replace them with your own
  URLs (CDN or Azure Blob). If a URL fails, a built-in illustration is shown instead.
- **Listings**: edit `core/data/rent.data.ts` and `core/data/sale.data.ts`. Field names match the
  interfaces in `core/models`.
- The RERA and HMDA LP numbers, ratings and reviews in the dummy data are **made up**. Replace them
  before going live.

## Connecting the .NET Core 10 backend

1. Set `useMockData: false` and `apiBaseUrl` in `src/environments/environment*.ts`.
2. Implement these endpoints. They return the same shapes as the TypeScript models, so you can
   mirror them as C# DTOs with camelCase JSON:

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/rent/societies` | `Society[]` |
| GET | `/api/rent/societies/{id}` | `Society` |
| GET | `/api/rent/societies/{id}/flats` | `RentalFlat[]` |
| GET | `/api/rent/flats` | `RentalFlat[]` |
| GET | `/api/rent/flats/{id}` | `RentalFlat` |
| GET | `/api/sale/ventures` | `Venture[]` (with `plots`) |
| GET | `/api/sale/ventures/{id}` | `Venture` |
| POST | `/api/enquiries` | body: `Enquiry` → `EnquiryResult` (server de-duplicates) |
| POST | `/api/listing-reports` | body: `ListingReport` |
| POST | `/api/availability-alerts` | body: `AvailabilityAlert` |

The public `RentalFlat` now includes `availability` and `lastVerifiedAt`. Admin endpoints will mirror the `AdminService`
methods (`createProperty`, `recordVerification`, `approve`, `decideRentChange`, …) and the types in `core/admin/admin.models.ts`.

3. Enable CORS in the API for the Angular origin (`http://localhost:4200` in dev).

## Map (Google Maps, satellite view)

All maps use **real Google Maps in hybrid view** (satellite photos with road and place names). Visitors
can switch to the normal road map with the button at the top right.

**Setup (about 10 minutes):**
1. Go to Google Cloud Console and create a project. Turn on billing (Google gives a monthly free usage allowance).
2. Under **APIs & Services → Library**, enable **Maps JavaScript API**.
3. Under **APIs & Services → Credentials**, create an **API key**. Restrict it to:
   - *Websites*: `http://localhost:4200/*` and your real domain.
   - *API*: Maps JavaScript API.
4. Optional: under **Map Management**, create a **Map ID** (type JavaScript, raster). `DEMO_MAP_ID` works
   while you develop.
5. Paste the key into `googleMapsApiKey` (and the Map ID into `googleMapId`) in
   `src/environments/environment.development.ts` and `environment.ts`.

Until a key is added, the app shows a free **Esri satellite preview map** instead. Everything still works,
and a small "Preview map" note appears in dev mode. If Google Maps fails to load, the app falls back
to the same preview map.

**Sale map (plotsview style):**
- Pins are coloured by price per sq.yd: green is cheaper, red is costlier. You can change the price bands in
  `src/app/core/data/geo.ts`.
- Hover a pin to see its name, area and price. Click it to open the venture popup.
- An eye pin marks a venture this visitor has already opened.
- The green line is the ORR and the yellow line is the proposed RRR. Both paths are approximate and can be
  replaced with official coordinates in `geo.ts`.
- The legend lets visitors filter by price band. The list of ventures opens as a side drawer.
