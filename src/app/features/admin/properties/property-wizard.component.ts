import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService, NewPropertyInput } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/admin/auth.service';
import { SOURCE_TYPE_LABEL } from '../../../core/admin/admin.models';
import { DuplicateMatch } from '../../../core/admin/duplicates';
import { MIN_PHOTOS } from '../../../core/admin/publish-rules';
import { Extracted, PropertyExtraction, extractProperty } from '../../../core/ai/text-extract';
import { Facing, Furnishing, TenantType } from '../../../core/models/rent.models';
import { ToastService } from '../../../core/services/toast.service';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { ADMIN_UI } from '../ui';

type Step = 0 | 1 | 2 | 3 | 4;

/**
 * Property intake: Source (+ AI-assisted message extraction) → Details → Duplicate check →
 * Owner & authorization → Review. Nothing is published from here — submission goes to verification.
 */
@Component({
  selector: 'app-property-wizard',
  imports: [FormsModule, RouterLink, InrPipe, ...ADMIN_UI],
  template: `
    <a class="back" routerLink="/admin/properties"><span class="icon xs">arrow_back</span> Properties</a>
    <div class="pg-h"><div><h1>Add property</h1><p>Creates a draft. It goes live only after verification and a manager's approval.</p></div></div>

    <ol class="steps">
      @for (s of stepNames; track s; let i = $index) {
        <li [class.on]="step() === i" [class.done]="step() > i"><span>{{ step() > i ? '✓' : i + 1 }}</span>{{ s }}</li>
      }
    </ol>

    <div class="panel body">
      <!-- STEP 0: source + AI intake -->
      @if (step() === 0) {
        <div class="grid2">
          <div>
            <h3>Where did this property come from?</h3>
            @if (isAgent()) {
              <div class="flag blue"><span class="icon sm">handshake</span> Submitting as <b>{{ admin.sourceName(f.sourceId) }}</b> ({{ f.sourceId }}). BHP will verify with the owner before listing.</div>
            } @else {
              <div class="field"><label>Source *</label>
                <select class="input" [(ngModel)]="f.sourceId">
                  @for (s of admin.sources(); track s.id) { <option [value]="s.id">{{ s.name }} — {{ typeLabel[s.type] }} ({{ s.id }})</option> }
                </select></div>
              <p class="muted small">Record the source exactly. When two agents bring the same flat, attribution is decided on evidence — not on who typed it in first.</p>
            }
          </div>
          <div>
            <h3><span class="icon">auto_awesome</span> Paste the message <span class="tag">AI assist · beta</span></h3>
            <textarea class="input" rows="6" [(ngModel)]="f.intakeMessage"
              placeholder="Paste the WhatsApp message from the agent or owner, e.g.&#10;3 BHK Skyline Residency tower B 9th floor flat 902, 1560 sft, semi furnished, rent 48k, maintenance 4500 per month, 2 months deposit, available immediately"></textarea>
            <button class="btn btn-outline btn-sm" [disabled]="!f.intakeMessage?.trim()" (click)="extract()"><span class="icon sm">auto_awesome</span> Extract details</button>
            @if (extraction(); as x) {
              <div class="ext">
                <p class="small"><b>{{ extractedCount() }} fields filled</b> — please review every value on the next step. The original message is kept on the record.</p>
                <div class="chips">
                  @for (e of extractedList(); track e.k) {
                    <span class="xc" [class.med]="e.c !== 'high'" [title]="'From: ' + e.ev">{{ e.k }}: <b>{{ e.v }}</b></span>
                  }
                </div>
                @if (x.questions.length) {
                  <p class="small q-h">Follow-up questions:</p>
                  <ul class="qs">@for (q of x.questions; track q) { <li>{{ q }}</li> }</ul>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- STEP 1: details -->
      @if (step() === 1) {
        <h3>Flat details</h3>
        <div class="form-grid">
          <div class="field span2"><label>Society *</label>
            <select class="input" [(ngModel)]="f.societyId" [class.hl]="hl('societyId')">
              <option value="">Select society</option>
              @for (s of admin.societies; track s.id) { <option [value]="s.id">{{ s.name }} — {{ s.locality }}</option> }
            </select></div>
          <div class="field"><label>Tower / block *</label><input class="input" [(ngModel)]="f.tower" [class.hl]="hl('tower')"></div>
          <div class="field"><label>Flat no. *</label><input class="input" [(ngModel)]="f.flatNo" [class.hl]="hl('flatNo')"></div>
          <div class="field"><label>BHK *</label>
            <select class="input" [(ngModel)]="f.bhk" [class.hl]="hl('bhk')">@for (b of [1,2,3,4,5]; track b) { <option [ngValue]="b">{{ b }} BHK</option> }</select></div>
          <div class="field"><label>Area (sq.ft) *</label><input class="input" type="number" [(ngModel)]="f.areaSqft" [class.hl]="hl('areaSqft')"></div>
          <div class="field"><label>Floor</label><input class="input" type="number" [(ngModel)]="f.floor" [class.hl]="hl('floor')"></div>
          <div class="field"><label>Total floors</label><input class="input" type="number" [(ngModel)]="f.totalFloors"></div>
          <div class="field"><label>Rent / month *</label><input class="input" type="number" [(ngModel)]="f.rent" [class.hl]="hl('rent')"></div>
          <div class="field"><label>Maintenance / month *</label><input class="input" type="number" [(ngModel)]="f.maintenance" [class.hl]="hl('maintenance')"></div>
          <div class="field"><label>Deposit (months) *</label><input class="input" type="number" [(ngModel)]="f.depositMonths" [class.hl]="hl('depositMonths')"></div>
          <div class="field"><label>Available from</label><input class="input" type="date" [(ngModel)]="f.availableFrom" [class.hl]="hl('availableFrom')"></div>
          <div class="field"><label>Furnishing</label>
            <select class="input" [(ngModel)]="f.furnishing" [class.hl]="hl('furnishing')">@for (x of furnishings; track x) { <option [value]="x">{{ x }}</option> }</select></div>
          <div class="field"><label>Facing</label>
            <select class="input" [(ngModel)]="f.facing">@for (x of facings; track x) { <option [value]="x">{{ x }}</option> }</select></div>
          <div class="field"><label>Tenants</label>
            <select class="input" [(ngModel)]="f.tenantType">@for (x of tenantTypes; track x) { <option [value]="x">{{ x }}</option> }</select></div>
          <div class="field"><label>Parking</label><input class="input" [(ngModel)]="f.parking"></div>
          <div class="field"><label>Photos <small class="muted">(min {{ minPhotos }} to publish)</small></label>
            <div class="photos">
              @for (i of photoSlots(); track i) { <span class="ph"><span class="icon sm">image</span></span> }
              <button class="ph add" (click)="f.photos = f.photos + 1" title="Add photo (demo)"><span class="icon sm">add_a_photo</span></button>
              @if (f.photos) { <button class="link" (click)="f.photos = f.photos - 1">remove</button> }
            </div></div>
          <div class="field chk-f"><label><input type="checkbox" [(ngModel)]="f.petsAllowed"> Pets allowed</label></div>
          <div class="field span4"><label>Description <small class="muted">(optional — a standard one is generated)</small></label>
            <textarea class="input" rows="2" [(ngModel)]="f.description"></textarea></div>
        </div>
        @if (f.rent && f.maintenance) {
          <p class="muted small">Tenants will see an all-in cost of <b>{{ f.rent + f.maintenance | inr }}</b> / month · deposit {{ f.rent * f.depositMonths | inr }}.</p>
        }
        @if (f.maintenance > f.rent && f.rent) { <div class="flag amber"><span class="icon sm">warning</span> Maintenance is higher than rent — are they swapped?</div> }
      }

      <!-- STEP 2: duplicate check -->
      @if (step() === 2) {
        <h3>Duplicate check</h3>
        @if (!dups().length) {
          <div class="flag green"><span class="icon sm">check_circle</span> No existing record looks like this flat (same society, tower, flat number, area, owner).</div>
        } @else if (isAgent()) {
          <!-- agents must not see other sources' records: generic notice only -->
          <div class="flag amber"><span class="icon sm">content_copy</span> This flat may already be on BHP's books. You can still submit — BHP will review it, and attribution is decided on evidence (who introduced it, when, and the owner's confirmation).</div>
          <label class="ack"><input type="checkbox" [(ngModel)]="dupAck"> Submit anyway for BHP review</label>
        } @else {
          <div class="flag amber"><span class="icon sm">content_copy</span> {{ dups().length }} existing record(s) may be this same flat. Check before creating a new one.</div>
          @for (m of dups(); track m.b.id) {
            <div class="dup">
              <div class="dh">
                <a [routerLink]="['/admin/properties', m.b.id]" target="_blank"><b>{{ m.b.id }}</b></a>
                <app-status [status]="m.b.status" />
                <span class="str" [class.strong]="m.strength === 'strong'">{{ m.strength === 'strong' ? 'Strong match' : 'Possible match' }}</span>
                <span class="muted small">source {{ m.b.sourceId }} · recorded {{ m.b.sourcedAt | ago }} by {{ admin.userName(m.b.sourcedBy) }}</span>
              </div>
              <div class="sig">@for (s of m.signals; track s.label) { <span>{{ s.label }}</span> }</div>
            </div>
          }
          <label class="ack"><input type="checkbox" [(ngModel)]="dupAck"> I've checked — this is a <b>different flat</b>. (If it's the same flat, don't create a new record: add your source's evidence on the existing one.)</label>
        }
      }

      <!-- STEP 3: owner & authorization -->
      @if (step() === 3) {
        <div class="grid2">
          <div>
            <h3>Owner</h3>
            @if (canSeeOwners()) {
              <div class="field"><label>Existing owner</label>
                <select class="input" [(ngModel)]="f.ownerId">
                  <option [ngValue]="null">— New owner —</option>
                  @for (o of admin.owners(); track o.id) { <option [ngValue]="o.id">{{ o.name }} · {{ o.phone }}</option> }
                </select></div>
            }
            @if (!f.ownerId) {
              <div class="row2">
                <div class="field"><label>Owner name *</label><input class="input" [(ngModel)]="newOwner.name"></div>
                <div class="field"><label>Owner mobile *</label><input class="input" [(ngModel)]="newOwner.phone" maxlength="10" inputmode="numeric"></div>
              </div>
              <p class="muted small">If this number already exists, the property is linked to that owner automatically.</p>
            }
          </div>
          <div>
            <h3>Owner authorization</h3>
            <div class="field"><label>Status *</label>
              <select class="input" [(ngModel)]="f.authorization.status">
                <option value="pending">Pending — verifier will obtain it</option>
                <option value="received">Received</option>
              </select></div>
            @if (f.authorization.status === 'received') {
              <div class="row2">
                <div class="field"><label>How</label>
                  <select class="input" [(ngModel)]="f.authorization.method">
                    <option value="written">Written / signed</option><option value="whatsapp">WhatsApp</option>
                    <option value="call-recorded">Recorded call</option><option value="agreement">Listing agreement</option>
                  </select></div>
                <div class="field"><label>Valid till</label><input class="input" type="date" [(ngModel)]="authValidTill"></div>
              </div>
            }
            <h3 class="mt">Commercial terms</h3>
            @if (auth.can('property.viewCommercial')) {
              <div class="row2">
                <div class="field"><label>Tenant brokerage</label><input class="input" [(ngModel)]="commercial.tenantBrokerage"></div>
                <div class="field"><label>Source share %</label><input class="input" type="number" [(ngModel)]="commercial.sourceSharePct"></div>
                <div class="field"><label>Owner brokerage</label><input class="input" [(ngModel)]="commercial.ownerBrokerage"></div>
                <div class="field"><label>Negotiation floor (rent)</label><input class="input" type="number" [(ngModel)]="commercial.minAcceptableRent"></div>
              </div>
            } @else {
              <p class="muted small"><span class="icon xs">lock</span> Defaults from the source's agreement are applied. The business owner can adjust them.</p>
            }
          </div>
        </div>
      }

      <!-- STEP 4: review -->
      @if (step() === 4) {
        <h3>Review</h3>
        <div class="grid2">
          <dl class="kv">
            <dt>Society</dt><dd>{{ societyName() }} · Tower {{ f.tower }} / {{ f.flatNo }} · Floor {{ f.floor }}</dd>
            <dt>Flat</dt><dd>{{ f.bhk }} BHK · {{ f.areaSqft }} sq.ft · {{ f.furnishing }} · {{ f.facing }}</dd>
            <dt>Rent</dt><dd>{{ f.rent | inr }} + {{ f.maintenance | inr }} maintenance · {{ f.depositMonths }} months deposit</dd>
            <dt>Available</dt><dd>{{ f.availableFrom }} · {{ f.tenantType }} · {{ f.parking }}</dd>
            <dt>Photos</dt><dd>{{ f.photos }} @if (f.photos < minPhotos) { <span class="warn">— needs {{ minPhotos }} before publishing</span> }</dd>
          </dl>
          <dl class="kv">
            <dt>Source</dt><dd>{{ admin.sourceName(f.sourceId) }} ({{ f.sourceId }})</dd>
            <dt>Owner</dt><dd>{{ ownerSummary() }}</dd>
            <dt>Authorization</dt><dd>{{ f.authorization.status }}</dd>
            <dt>Duplicates</dt><dd>{{ dups().length ? dups().length + ' possible — acknowledged as different flat' : 'None found' }}</dd>
            <dt>Next</dt><dd>Assigned to a verifier → availability + authorization check → manager approval → live</dd>
          </dl>
        </div>
      }

      @if (error()) { <p class="err"><span class="icon xs">error</span> {{ error() }}</p> }

      <div class="nav">
        @if (step() > 0) { <button class="btn btn-ghost" (click)="go(-1)"><span class="icon sm">arrow_back</span> Back</button> }
        <span class="sp"></span>
        @if (step() < 4) {
          <button class="btn btn-primary" (click)="go(1)">Next <span class="icon sm">arrow_forward</span></button>
        } @else {
          <button class="btn btn-ghost" (click)="save(false)">Save draft</button>
          <button class="btn btn-primary" (click)="save(true)"><span class="icon sm">send</span> Submit for verification</button>
        }
      </div>
    </div>
  `,
  styles: `
    .back { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; margin-bottom: 8px; }
    .steps { list-style: none; padding: 0; margin: 0 0 14px; display: flex; gap: 6px; flex-wrap: wrap;
      li { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-radius: 999px; background: #fff; border: 1px solid var(--border); font-size: 13px; color: var(--muted); font-weight: 600;
        span { width: 22px; height: 22px; border-radius: 50%; background: var(--gray-soft); display: grid; place-items: center; font-size: 12px; }
        &.on { border-color: var(--primary); color: var(--primary-dark); span { background: var(--primary); color: #fff; } }
        &.done span { background: var(--green); color: #fff; } } }
    .body { padding: 20px; }
    h3 { font-size: 16px; margin-bottom: 12px; display: flex; gap: 6px; align-items: center; .icon { color: var(--primary); } }
    .mt { margin-top: 18px; }
    .tag { background: var(--primary-soft); color: var(--primary-dark); border-radius: 4px; padding: 1px 6px; font-size: 10.5px; font-weight: 700; }
    .small { font-size: 12.5px; }
    textarea { margin-bottom: 8px; }
    .ext { margin-top: 12px; background: #f7faff; border: 1px solid #d8e6ff; border-radius: 10px; padding: 12px; p { margin: 0 0 8px; } }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .xc { font-size: 12px; background: var(--green-soft); color: var(--green-text); border-radius: 6px; padding: 3px 8px; &.med { background: var(--amber-soft); color: #8a5600; } }
    .q-h { margin-top: 10px !important; font-weight: 700; }
    .qs { margin: 0; padding-left: 18px; font-size: 13px; li { margin: 2px 0; } }
    .form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0 14px; .span2 { grid-column: span 2; } .span4 { grid-column: span 4; } }
    .input.hl { border-color: #9cc2ff; background: #f5f9ff; }
    .photos { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .ph { width: 40px; height: 40px; border-radius: 8px; background: var(--gray-soft); display: grid; place-items: center; color: var(--muted); border: 0; }
    .ph.add { background: var(--primary-soft); color: var(--primary); cursor: pointer; }
    .link { border: 0; background: none; color: var(--primary); font-size: 12px; cursor: pointer; }
    .chk-f { justify-content: flex-end; label { display: flex; gap: 8px; align-items: center; font-size: 14px; color: var(--text); } }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .dup { border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-top: 10px; }
    .dh { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .str { font-size: 12px; font-weight: 700; color: #8a5600; &.strong { color: #b4123f; } }
    .sig { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; span { font-size: 12px; background: var(--gray-soft); border-radius: 5px; padding: 2px 7px; } }
    .ack { display: flex; gap: 8px; align-items: flex-start; margin-top: 14px; font-size: 13.5px; input { margin-top: 3px; } }
    .warn { color: #9a6200; }
    .err { color: var(--red); font-size: 13.5px; display: flex; gap: 4px; align-items: center; margin: 14px 0 0; }
    .nav { display: flex; gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); .sp { flex: 1; } }
    @media (max-width: 900px) { .form-grid { grid-template-columns: 1fr 1fr; .span4 { grid-column: span 2; } } }
  `,
})
export class PropertyWizardComponent {
  readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  readonly stepNames = ['Source', 'Details', 'Duplicate check', 'Owner & terms', 'Review'];
  readonly typeLabel = SOURCE_TYPE_LABEL;
  readonly furnishings: Furnishing[] = ['Furnished', 'Semi Furnished', 'Unfurnished'];
  readonly facings: Facing[] = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
  readonly tenantTypes: TenantType[] = ['Both Allowed', 'Family Only', 'Bachelors Only'];
  readonly minPhotos = MIN_PHOTOS;

  readonly step = signal<Step>(0);
  readonly error = signal('');
  readonly extraction = signal<PropertyExtraction | null>(null);
  readonly dups = signal<DuplicateMatch[]>([]);
  private filled = new Set<string>();
  dupAck = false;

  readonly isAgent = computed(() => this.auth.user()?.role === 'agent');
  readonly canSeeOwners = computed(() => this.admin.owners().length > 0);

  f: NewPropertyInput = {
    societyId: '', tower: '', flatNo: '', bhk: 3, areaSqft: 0, floor: 1, totalFloors: 14, facing: 'East', furnishing: 'Semi Furnished',
    tenantType: 'Both Allowed', rent: 0, maintenance: 0, depositMonths: 2, parking: '1 Covered',
    availableFrom: new Date().toISOString().slice(0, 10), petsAllowed: false, description: '', photos: 0,
    sourceId: this.auth.user()?.sourceId ?? this.admin.sources()[0]?.id ?? 'SRC-DIRECT', ownerId: null,
    authorization: { status: 'pending' }, intakeMessage: '',
  };
  newOwner = { name: '', phone: '' };
  authValidTill = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  commercial = { tenantBrokerage: '15 days rent', ownerBrokerage: 'None', sourceSharePct: 0, minAcceptableRent: 0 };

  photoSlots() { return Array.from({ length: this.f.photos }, (_, i) => i); }
  hl(k: string) { return this.filled.has(k); }
  societyName() { return this.admin.societies.find(s => s.id === this.f.societyId)?.name ?? '—'; }
  ownerSummary() {
    if (this.f.ownerId) return this.admin.owner(this.f.ownerId)?.name ?? this.f.ownerId;
    return this.newOwner.name ? `${this.newOwner.name} · ${this.newOwner.phone} (new)` : '—';
  }

  /* ---------- AI-assisted intake (mock extractor) ---------- */
  extract() {
    const x = extractProperty(this.f.intakeMessage ?? '', this.admin.societies);
    this.extraction.set(x);
    this.filled.clear();
    const put = <K extends keyof NewPropertyInput>(k: K, e: Extracted<NewPropertyInput[K]> | undefined) => {
      if (e) { this.f[k] = e.value; this.filled.add(k); }
    };
    if (x.society) { this.f.societyId = x.society.value.id; this.filled.add('societyId'); }
    put('bhk', x.bhk); put('areaSqft', x.areaSqft); put('furnishing', x.furnishing); put('rent', x.rent);
    put('maintenance', x.maintenance); put('depositMonths', x.depositMonths); put('floor', x.floor);
    put('tower', x.tower); put('flatNo', x.flatNo); put('availableFrom', x.availableFrom);
  }
  readonly extractedList = computed(() => {
    const x = this.extraction(); if (!x) return [];
    const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
    const rows: { k: string; v: string; c: string; ev: string }[] = [];
    const add = (k: string, e: Extracted<unknown> | undefined, fmt: (v: never) => string = v => String(v)) => {
      if (e) rows.push({ k, v: fmt(e.value as never), c: e.confidence, ev: e.evidence });
    };
    add('Society', x.society, (s: { name: string }) => s.name); add('Locality', x.locality); add('BHK', x.bhk); add('Area', x.areaSqft, (v: number) => `${v} sq.ft`);
    add('Furnishing', x.furnishing); add('Rent', x.rent, inr); add('Maintenance', x.maintenance, inr); add('Deposit', x.depositMonths, (v: number) => `${v} months`);
    add('Tower', x.tower); add('Flat', x.flatNo); add('Floor', x.floor); add('Available', x.availableFrom);
    return rows;
  });
  readonly extractedCount = computed(() => this.extractedList().length);

  /* ---------- navigation & validation ---------- */
  private validate(step: Step): string {
    const f = this.f;
    if (step === 0 && !f.sourceId) return 'Choose the source.';
    if (step === 1) {
      const missing = [!f.societyId && 'society', !f.tower.trim() && 'tower', !f.flatNo.trim() && 'flat no.', !f.areaSqft && 'area',
        !f.rent && 'rent', !f.maintenance && 'maintenance', !f.depositMonths && 'deposit months'].filter(Boolean);
      if (missing.length) return `Please fill: ${missing.join(', ')}.`;
    }
    if (step === 2 && this.dups().length && !this.dupAck) return 'Confirm this is a different flat, or stop and update the existing record.';
    if (step === 3 && !f.ownerId && (this.newOwner.name.trim().length < 2 || !/^[6-9]\d{9}$/.test(this.newOwner.phone))) {
      return 'Enter the owner name and a valid 10-digit mobile (needed for verification and duplicate checks).';
    }
    return '';
  }

  go(d: 1 | -1) {
    if (d === 1) {
      const e = this.validate(this.step()); this.error.set(e); if (e) return;
      if (this.step() === 1 || this.step() === 3) this.runDupCheck();
    } else this.error.set('');
    this.step.update(s => (s + d) as Step);
  }

  private runDupCheck() {
    const before = this.dups().map(m => m.b.id).join();
    this.dups.set(this.admin.checkDuplicates({ ...this.f, newOwner: this.f.ownerId ? undefined : this.newOwner }));
    if (this.dups().map(m => m.b.id).join() !== before) this.dupAck = false;
  }

  save(submit: boolean) {
    // owner phone may have surfaced a new duplicate on step 3
    if (this.dups().length && !this.dupAck) { this.step.set(2); this.error.set('A possible duplicate was found using the owner phone — please review.'); return; }
    const input: NewPropertyInput = {
      ...this.f,
      newOwner: this.f.ownerId ? undefined : { ...this.newOwner },
      authorization: this.f.authorization.status === 'received'
        ? { status: 'received', method: this.f.authorization.method ?? 'whatsapp', receivedAt: new Date().toISOString(), validTill: new Date(this.authValidTill).toISOString() }
        : { status: 'pending' },
      commercial: this.auth.can('property.viewCommercial') ? { ...this.commercial, minAcceptableRent: this.commercial.minAcceptableRent || this.f.rent } : undefined,
      intakeMessage: this.f.intakeMessage?.trim() || undefined,
    };
    const r = this.admin.createProperty(input, submit);
    if (!r.ok) { this.error.set(r.error); return; }
    this.toast.show(submit ? `${r.value.id} submitted — assigned to ${this.admin.userName(r.value.assignedVerifier)}` : `${r.value.id} saved as draft`, 'success', 4000);
    this.router.navigate(['/admin/properties', r.value.id]);
  }
}
