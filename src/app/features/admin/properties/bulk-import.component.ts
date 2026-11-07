import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/admin/auth.service';
import { ImportRow, RowAction, validateRows } from '../../../core/admin/bulk-import';
import { BRAND } from '../../../core/brand';
import { ToastService } from '../../../core/services/toast.service';
import { ADMIN_UI } from '../ui';
import { MAX_ROWS, createSpreadsheet, isGoogleConfigured, readSpreadsheet } from './property-sheet';

type Filter = 'all' | 'ready' | 'issues';
const ACTION_LABEL: Record<RowAction, string> = { create: 'New', update: 'Update', unchanged: 'No change', error: 'Error' };

/**
 * Bulk create / update from Google Sheets: create the template in Drive (blank, or pre-filled with current properties) →
 * fill it → load it back → preview every row with its errors → import the selected rows in one go.
 */
@Component({
  selector: 'app-bulk-import',
  imports: [FormsModule, RouterLink, ...ADMIN_UI],
  template: `
    <a class="back" routerLink="/admin/properties"><span class="icon xs">arrow_back</span> Properties</a>
    <div class="pg-h"><div><h1>Bulk import from Google Sheets</h1>
      <p>Create new properties or update existing ones from a Google Sheet. Nothing is saved until you review the preview.</p></div></div>
    @if (!configured) {
      <div class="flag amber"><span class="icon sm">warning</span>
        Google Sheets is not connected yet. Add <b>googleOAuthClientId</b> in <code>src/environments/environment.ts</code> (and <code>environment.development.ts</code>) — see the comment there.</div>
    }

    @if (result(); as res) {
      <div class="panel body done">
        <span class="icon lg">task_alt</span>
        <h3>Import complete</h3>
        <p>{{ res.created.length }} created{{ res.created.length ? (submitNew ? ' and submitted for verification' : ' as drafts') : '' }} · {{ res.updated.length }} updated</p>
        @if (res.created.length) {
          <div class="ids"><b>New:</b> @for (id of res.created; track id) { <a [routerLink]="['/admin/properties', id]">{{ id }}</a> }</div>
        }
        @if (res.updated.length) {
          <div class="ids"><b>Updated:</b> @for (id of res.updated; track id) { <a [routerLink]="['/admin/properties', id]">{{ id }}</a> }</div>
        }
        <div class="nav">
          <a class="btn btn-ghost" routerLink="/admin/properties">Go to properties</a>
          <button class="btn btn-primary" (click)="restart()"><span class="icon sm">upload_file</span> Import another file</button>
        </div>
      </div>
    } @else {
      <div class="cards">
        <section class="panel card">
          <h3><span class="n">1</span> Create a Google Sheet</h3>
          <p class="muted small">Row 1 of the sheet tells you, for every column, whether it is required and what it is for. Dropdowns are built in. It is created in your own Google Drive.</p>
          <div class="legend">
            <span class="lg key">Key — blank = new</span><span class="lg new">Required for new *</span>
            <span class="lg cond">Conditional (*)</span><span class="lg opt">Optional</span>
          </div>
          <div class="btns">
            <button class="btn btn-primary btn-sm" [disabled]="busy()" (click)="createSheet(false)"><span class="icon sm">add_box</span> Blank sheet</button>
            @if (canEdit()) {
              <button class="btn btn-outline btn-sm" [disabled]="busy() || !exportable().length" (click)="createSheet(true)">
                <span class="icon sm">table_view</span> Current properties ({{ exportable().length }})</button>
            }
          </div>
          @if (sheetUrl()) {
            <p class="small"><span class="icon xs">check_circle</span> Sheet created — <a [href]="sheetUrl()" target="_blank" rel="noopener"><b>open in Google Sheets</b></a></p>
          }
          @if (canEdit()) { <p class="muted small">Use "Current properties" for bulk updates: edit the cells you need and load it back.</p> }
        </section>

        <section class="panel card">
          <h3><span class="n">2</span> Fill it in</h3>
          <ul class="tips">
            <li><b>New property:</b> leave <i>Property ID</i> blank and fill every <span class="req">*</span> column.</li>
            @if (canEdit()) { <li><b>Update:</b> enter the Property ID and only the cells to change — blank cells stay as they are.</li> }
            <li>Rent changes on live listings go to <b>Approvals</b> first.</li>
            <li>Up to {{ maxRows }} rows per sheet.</li>
          </ul>
        </section>

        <section class="panel card">
          <h3><span class="n">3</span> Load the sheet</h3>
          <p class="muted small">Paste the sheet's link. You'll be asked to sign in to Google once; use the account that owns or can open the sheet.</p>
          <form class="load" (ngSubmit)="load()">
            <input class="inp" name="link" [(ngModel)]="sheetLink" placeholder="https://docs.google.com/spreadsheets/d/…" autocomplete="off">
            <button class="btn btn-primary btn-sm" type="submit" [disabled]="busy() || !sheetLink.trim()">
              @if (busy()) { <span class="icon sm spin">progress_activity</span> Working… } @else { <span class="icon sm">sync</span> Load sheet }
            </button>
          </form>
        </section>
      </div>

      @if (fatal()) { <div class="flag red"><span class="icon sm">error</span> {{ fatal() }}</div> }

      @if (rows().length) {
        <div class="panel body">
          <div class="ph">
            <h3>Preview — {{ fileName() }}</h3>
            <div class="sum">
              <button [class.on]="filter() === 'all'" (click)="filter.set('all')">All {{ rows().length }}</button>
              <button class="c-new" [class.on]="filter() === 'ready'" (click)="filter.set('ready')">Ready {{ counts().create + counts().update }}</button>
              <button class="c-err" [class.on]="filter() === 'issues'" (click)="filter.set('issues')">Errors / warnings {{ counts().issues }}</button>
            </div>
          </div>
          <p class="muted small stats">
            <b>{{ counts().create }}</b> new · <b>{{ counts().update }}</b> updates · <b>{{ counts().unchanged }}</b> no change ·
            <b class="e">{{ counts().error }}</b> with errors (skipped — fix them in the sheet and load it again)
          </p>
          @for (w of headerNotes(); track w) { <div class="flag amber"><span class="icon sm">warning</span> {{ w }}</div> }

          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr>
                <th class="ck"><input type="checkbox" [checked]="allSelected()" (change)="toggleAll()" title="Select all ready rows"></th>
                <th>Row</th><th>Action</th><th>Property</th><th>Details</th><th>Issues</th>
              </tr></thead>
              <tbody>
                @for (r of shown(); track r.rowNo) {
                  <tr [class.err]="r.action === 'error'" [class.dim]="r.action === 'unchanged'">
                    <td class="ck"><input type="checkbox" [disabled]="!selectable(r)" [checked]="selected().has(r.rowNo)" (change)="toggle(r)"></td>
                    <td>{{ r.rowNo }}</td>
                    <td><span class="act" [class]="'act a-' + r.action">{{ actionLabel[r.action] }}</span></td>
                    <td>
                      @if (r.propertyId) { <a [routerLink]="['/admin/properties', r.propertyId]" target="_blank"><b>{{ r.propertyId }}</b></a> }
                      <span class="sub">{{ r.label }}</span>
                    </td>
                    <td class="det">
                      @if (r.create; as c) {
                        ₹{{ c.rent.toLocaleString('en-IN') }} + ₹{{ c.maintenance.toLocaleString('en-IN') }} · {{ c.areaSqft }} sq.ft · {{ c.furnishing }}
                        <span class="sub">Owner {{ c.newOwner?.name }} · {{ c.images?.length ?? 0 }} photo(s) · authorization {{ c.authorization.status }}</span>
                      }
                      @for (ch of r.changes; track ch) { <span class="chg">{{ ch }}</span> }
                    </td>
                    <td class="iss">
                      @for (e of r.errors; track e) { <span class="e"><span class="icon xs">error</span>{{ e }}</span> }
                      @for (w of r.warnings; track w) { <span class="w"><span class="icon xs">warning</span>{{ w }}</span> }
                      @if (r.duplicates.length && !isAgent()) {
                        <span class="w">@for (d of r.duplicates; track d.b.id) { <a [routerLink]="['/admin/properties', d.b.id]" target="_blank">{{ d.b.id }}</a> }</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="empty-row">No rows in this view.</td></tr>
                }
              </tbody>
            </table>
          </div>

          @if (error()) { <p class="err"><span class="icon xs">error</span> {{ error() }}</p> }

          <div class="nav">
            @if (selectedCreates()) {
              <div class="mode">
                <span class="muted small">New properties:</span>
                <label><input type="radio" name="m" [value]="false" [(ngModel)]="submitNew"> Save as drafts</label>
                <label><input type="radio" name="m" [value]="true" [(ngModel)]="submitNew"> Submit for verification</label>
              </div>
            }
            <span class="sp"></span>
            <button class="btn btn-ghost" (click)="restart()">Cancel</button>
            <button class="btn btn-primary" [disabled]="!selected().size" (click)="import()">
              <span class="icon sm">publish</span> Import {{ selected().size }} row{{ selected().size === 1 ? '' : 's' }}</button>
          </div>
        </div>
      } @else if (parsed() && !fatal()) {
        <div class="flag amber"><span class="icon sm">info</span> No data rows found in this sheet — rows start below the header (row 3 in the template).</div>
      }
    }
  `,
  styles: `
    .back { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; margin-bottom: 8px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 14px; }
    .card { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .body { padding: 18px; margin-bottom: 14px; }
    h3 { font-size: 15.5px; display: flex; gap: 8px; align-items: center; margin: 0; }
    .n { width: 24px; height: 24px; border-radius: 50%; background: var(--primary); color: #fff; display: grid; place-items: center; font-size: 12.5px; flex: none; }
    .small { font-size: 12.5px; margin: 0; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px; }
    .lg { font-size: 11.5px; font-weight: 600; border-radius: 5px; padding: 2px 7px;
      &.key { background: #dce8ff; color: #0b3d91; } &.new { background: #fde2e1; color: #9b1c1c; }
      &.cond { background: #fff1d6; color: #8a5600; } &.opt { background: #f1f3f5; color: #4a5568; } }
    .btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .tips { margin: 0; padding-left: 18px; font-size: 13px; li { margin: 4px 0; } .req { color: #9b1c1c; font-weight: 700; } }
    .load { display: flex; flex-direction: column; gap: 8px; align-items: stretch; .inp { width: 100%; } }
    code { font-size: 12px; }
    .ph { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    .sum { display: flex; gap: 6px; flex-wrap: wrap;
      button { border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 4px 11px; font-size: 12.5px; cursor: pointer; font-weight: 600;
        &.on { border-color: var(--navy); background: var(--gray-soft); } &.c-new { color: var(--green-text); } &.c-err { color: #b4123f; } } }
    .stats { margin: 8px 0 10px; .e { color: #b4123f; } }
    .tbl-wrap { max-height: 60vh; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
    .tbl { th { position: sticky; top: 0; z-index: 1; } td { vertical-align: top; } }
    .ck { width: 32px; }
    tr.err td { background: #fff7f7; }
    tr.dim td { opacity: .6; }
    .act { font-size: 11.5px; font-weight: 700; border-radius: 5px; padding: 2px 7px; white-space: nowrap;
      &.a-create { background: var(--green-soft); color: var(--green-text); } &.a-update { background: #dce8ff; color: #0b3d91; }
      &.a-unchanged { background: var(--gray-soft); color: var(--muted); } &.a-error { background: #fde2e1; color: #9b1c1c; } }
    .det { font-size: 13px; min-width: 220px; }
    .chg { display: block; font-size: 12.5px; }
    .iss { min-width: 260px; font-size: 12.5px;
      span { display: flex; gap: 4px; align-items: flex-start; margin: 2px 0; } .e { color: #b4123f; } .w { color: #8a5600; gap: 6px; flex-wrap: wrap; } }
    .err { color: var(--red); font-size: 13.5px; display: flex; gap: 4px; align-items: center; margin: 12px 0 0; }
    .nav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); .sp { flex: 1; } }
    .mode { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; label { display: flex; gap: 5px; align-items: center; font-size: 13.5px; } }
    .done { text-align: center; .icon { color: var(--green); font-size: 44px; } h3 { justify-content: center; margin: 6px 0; } p { margin: 0 0 10px; }
      .nav { justify-content: center; } }
    .ids { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; font-size: 13px; margin: 6px 0; }
    .flag { margin-bottom: 10px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 1000px) { .cards { grid-template-columns: 1fr; } }
  `,
})
export class BulkImportComponent {
  readonly admin = inject(AdminService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  readonly actionLabel = ACTION_LABEL;
  readonly maxRows = MAX_ROWS;

  readonly busy = signal(false);
  readonly configured = isGoogleConfigured();
  readonly sheetUrl = signal('');
  sheetLink = '';
  readonly fileName = signal('');
  readonly fatal = signal('');
  readonly error = signal('');
  readonly parsed = signal(false);
  readonly headerNotes = signal<string[]>([]);
  readonly rows = signal<ImportRow[]>([]);
  readonly selected = signal<Set<number>>(new Set());
  readonly filter = signal<Filter>('all');
  readonly result = signal<{ created: string[]; updated: string[] } | null>(null);
  submitNew = false;

  readonly isAgent = computed(() => this.auth.user()?.role === 'agent');
  readonly canEdit = computed(() => this.auth.can('property.edit'));
  /** Rented listings are closed — leave them out of the update sheet. */
  readonly exportable = computed(() => this.admin.properties().filter(p => p.status !== 'rented'));

  readonly counts = computed(() => {
    const r = this.rows();
    const n = (a: RowAction) => r.filter(x => x.action === a).length;
    return { create: n('create'), update: n('update'), unchanged: n('unchanged'), error: n('error'),
      issues: r.filter(x => x.errors.length || x.warnings.length).length };
  });
  readonly shown = computed(() => {
    const f = this.filter();
    return this.rows().filter(r => f === 'all' || (f === 'ready' ? this.selectable(r) : r.errors.length || r.warnings.length));
  });
  readonly selectedCreates = computed(() => this.rows().filter(r => r.action === 'create' && this.selected().has(r.rowNo)).length);
  readonly allSelected = computed(() => {
    const ready = this.rows().filter(r => this.selectable(r));
    return ready.length > 0 && ready.every(r => this.selected().has(r.rowNo));
  });

  selectable(r: ImportRow) { return r.action === 'create' || r.action === 'update'; }

  toggle(r: ImportRow) {
    const s = new Set(this.selected());
    if (s.has(r.rowNo)) s.delete(r.rowNo); else s.add(r.rowNo);
    this.selected.set(s);
  }
  toggleAll() {
    const ready = this.rows().filter(r => this.selectable(r)).map(r => r.rowNo);
    this.selected.set(this.allSelected() ? new Set() : new Set(ready));
  }

  /* ---------- create sheet ---------- */

  /** Creates the template in the admin's Drive, opens it, and pre-fills the link box so step 3 is one click. */
  async createSheet(withCurrent: boolean) {
    const date = new Date().toISOString().slice(0, 10);
    const title = withCurrent ? `${BRAND.company} properties ${date}` : `${BRAND.company} property import template`;
    await this.run(async () => {
      const sheet = await createSpreadsheet(this.admin.importContext(), title, withCurrent ? this.exportable() : []);
      this.sheetUrl.set(sheet.url);
      this.sheetLink = sheet.url;
      window.open(sheet.url, '_blank', 'noopener');   // may be blocked after the async sign-in — the link above is the fallback
      this.toast.show('Google Sheet created in your Drive.', 'success', 3500);
    });
  }

  /* ---------- load sheet ---------- */

  async load() {
    this.reset();
    this.fileName.set('');
    await this.run(async () => {
      const read = await readSpreadsheet(this.sheetLink);
      this.fileName.set(read.title);
      const notes: string[] = [];
      if (read.missingHeaders.length) notes.push(`Columns not found: ${read.missingHeaders.join(', ')}. New rows will fail without them — use the latest template.`);
      if (read.unknownHeaders.length) notes.push(`Ignored unknown columns: ${read.unknownHeaders.join(', ')}.`);
      this.headerNotes.set(notes);
      const rows = validateRows(read.rows, this.admin.importContext());
      this.rows.set(rows);
      // possible duplicates need an explicit tick — the same acknowledgement the wizard asks for
      this.selected.set(new Set(rows.filter(r => this.selectable(r) && !r.duplicates.length).map(r => r.rowNo)));
      this.parsed.set(true);
    }, e => this.fatal.set(e));
  }

  import() {
    this.error.set('');
    const chosen = this.rows().filter(r => this.selected().has(r.rowNo));
    const res = this.admin.bulkImport(chosen, this.submitNew);
    if (!res.ok) { this.error.set(res.error); return; }
    this.result.set(res.value);
    this.toast.show(`${res.value.created.length} created · ${res.value.updated.length} updated`, 'success', 4000);
  }

  restart() { this.reset(); this.fileName.set(''); this.result.set(null); }

  private reset() {
    this.fatal.set(''); this.error.set(''); this.rows.set([]); this.selected.set(new Set());
    this.headerNotes.set([]); this.filter.set('all'); this.parsed.set(false);
  }

  private async run(fn: () => Promise<void>, onError?: (msg: string) => void) {
    this.busy.set(true);
    try { await fn(); }
    catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      if (onError) onError(msg); else this.toast.show(msg, 'error');
    } finally { this.busy.set(false); }
  }
}
