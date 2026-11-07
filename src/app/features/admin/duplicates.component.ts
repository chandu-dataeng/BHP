import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/admin/admin.service';
import { DuplicateDecision, PropertyRecord } from '../../core/admin/admin.models';
import { DuplicateMatch } from '../../core/admin/duplicates';
import { ToastService } from '../../core/services/toast.service';
import { InrPipe } from '../../shared/pipes/inr.pipe';
import { ADMIN_UI } from './ui';

/** Side-by-side review of possible duplicate records, with the evidence for each match. */
@Component({
  selector: 'app-duplicates',
  imports: [RouterLink, DatePipe, InrPipe, ...ADMIN_UI],
  template: `
    <div class="pg-h">
      <div><h1>Possible duplicates</h1>
        <p>Signals: same society, tower, flat no., floor, area, owner phone. The score ranks — it is not a probability. You decide.</p></div>
    </div>

    @for (m of admin.duplicatePairs(); track m.a.id + m.b.id) {
      <section class="panel pair">
        <div class="ph">
          <span class="str" [class.strong]="m.strength === 'strong'">{{ m.strength === 'strong' ? 'Strong match' : 'Possible match' }} · {{ m.score }}</span>
          <div class="sig">@for (s of m.signals; track s.label) { <span>{{ s.label }}</span> }</div>
        </div>
        <div class="cmp">
          @for (r of [m.a, m.b]; track r.id) {
            <div class="rec">
              <div class="rh"><a [routerLink]="['/admin/properties', r.id]"><b>{{ r.id }}</b></a> <app-status [status]="r.status" /></div>
              <dl class="kv">
                <dt>Unit</dt><dd>Tower {{ r.tower }} / {{ r.flatNo }} · Floor {{ r.flat.floor }} · {{ r.flat.bhk }} BHK · {{ r.flat.areaSqft }} sq.ft</dd>
                <dt>Rent</dt><dd>{{ r.flat.rent | inr }}</dd>
                <dt>Source</dt><dd>{{ admin.sourceName(r.sourceId) }} <span class="muted">{{ r.sourceId }}</span></dd>
                <dt>Recorded</dt><dd>{{ r.sourcedAt | date: 'd MMM y, h:mm a' }} by {{ admin.userName(r.sourcedBy) }}</dd>
                <dt>Owner</dt><dd>@if (r.ownerId) { {{ admin.owner(r.ownerId)?.name }} } @else { <app-restricted /> }</dd>
                <dt>Enquiries</dt><dd>{{ leadCount(r) }}</dd>
              </dl>
            </div>
          }
        </div>
        <div class="acts">
          <span class="muted small">Merging keeps the earlier record, moves enquiries to it and preserves both source claims for attribution review.</span>
          <span class="sp"></span>
          <button class="btn btn-ghost btn-sm" (click)="decide(m, 'not_duplicate')">Different flats</button>
          <button class="btn btn-outline btn-sm" (click)="decide(m, 'linked')">Link (same flat, keep both)</button>
          <button class="btn btn-primary btn-sm" (click)="decide(m, 'merged')">Merge</button>
        </div>
      </section>
    } @empty {
      <div class="panel empty-row"><span class="icon">task_alt</span> No unresolved duplicates.</div>
    }
  `,
  styles: `
    .pair { margin-bottom: 14px; }
    .ph { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .str { font-weight: 700; font-size: 13px; color: #8a5600; &.strong { color: #b4123f; } }
    .sig { display: flex; gap: 6px; flex-wrap: wrap; span { font-size: 12px; background: var(--gray-soft); border-radius: 5px; padding: 2px 7px; } }
    .cmp { display: grid; grid-template-columns: 1fr 1fr; }
    .rec { padding: 14px 16px; & + .rec { border-left: 1px solid var(--border); } .kv { grid-template-columns: 90px 1fr; font-size: 13px; } }
    .rh { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
    .acts { display: flex; gap: 8px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--border); flex-wrap: wrap; .sp { flex: 1; } }
    .small { font-size: 12.5px; }
    .empty-row .icon { color: var(--green); vertical-align: -5px; }
    @media (max-width: 800px) { .cmp { grid-template-columns: 1fr; } .rec + .rec { border-left: 0; border-top: 1px solid var(--border); } }
  `,
})
export class DuplicatesComponent {
  readonly admin = inject(AdminService);
  private toast = inject(ToastService);

  leadCount(r: PropertyRecord) { return this.admin.leads().filter(l => l.propertyId === r.id).length; }

  decide(m: DuplicateMatch, d: DuplicateDecision['decision']) {
    const r = this.admin.resolveDuplicate(m.a.id, m.b.id, d);
    this.toast.show(r.ok ? (d === 'merged' ? 'Records merged' : d === 'linked' ? 'Records linked' : 'Marked as different flats') : r.error, r.ok ? 'success' : 'error');
  }
}
