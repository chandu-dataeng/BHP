import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AdminService } from '../../../core/admin/admin.service';
import { PropertyRecord, VERIFICATION_RESULT_LABEL, Verification, VerificationResult } from '../../../core/admin/admin.models';
import { ToastService } from '../../../core/services/toast.service';
import { InrPipe } from '../../../shared/pipes/inr.pipe';
import { AVAILABILITY_POLICY } from '../../../core/policy/availability';

/**
 * Record an availability check. A property can only be marked confirmed with WHO confirmed it,
 * HOW, and WHEN — and a rent change becomes a pending change for a manager to approve.
 */
@Component({
  selector: 'app-verify-dialog',
  imports: [ModalComponent, FormsModule, InrPipe],
  template: `
    <app-modal [width]="520" (close)="closed.emit()">
      <div class="wrap">
        <h3><span class="icon">fact_check</span> Record availability check</h3>
        <p class="muted sub">{{ property().id }} · {{ property().flat.bhk }} BHK · Tower {{ property().tower }} / {{ property().flatNo }} · current rent {{ property().flat.rent | inr }}</p>

        @if (property().conflict) {
          <div class="flag red"><span class="icon sm">report</span><span><b>Unresolved conflict:</b> {{ property().conflict }}<br>
            Availability cannot be confirmed until a manager resolves it.</span></div>
        }

        <label class="lbl">Result *</label>
        <div class="opts">
          @for (r of results; track r) {
            <label class="opt" [class.on]="result() === r" [class.dis]="!!property().conflict && (r === 'available' || r === 'rent_changed')">
              <input type="radio" name="res" [checked]="result() === r" (change)="result.set(r)"
                [disabled]="!!property().conflict && (r === 'available' || r === 'rent_changed')">{{ labels[r] }}</label>
          }
        </div>

        @if (result() === 'rent_changed') {
          <div class="field"><label>New monthly rent *</label>
            <input class="input" type="number" [(ngModel)]="newRent" placeholder="e.g. 60000">
            <small class="muted">Goes to a manager for approval before the public price changes.</small></div>
        }

        <div class="row">
          <div class="field"><label>Confirmed by *</label>
            <select class="input" [(ngModel)]="confirmedBy">
              <option>Owner</option><option>Owner's family member</option><option>Authorised agent</option><option>Society office</option><option>Current tenant</option>
            </select></div>
          <div class="field"><label>Method *</label>
            <select class="input" [(ngModel)]="method">
              <option value="call">Phone call</option><option value="whatsapp">WhatsApp</option><option value="site-visit">Site visit</option><option value="society-office">Society office</option>
            </select></div>
        </div>
        <div class="field"><label>Evidence <small class="muted">(message reference / screenshot name)</small></label>
          <input class="input" [(ngModel)]="evidence" placeholder="e.g. WhatsApp 11:05 AM, screenshot-0412.png"></div>
        <div class="field"><label>Notes {{ result() === 'conflict' ? '*' : '' }}</label>
          <textarea class="input" rows="2" [(ngModel)]="notes" [placeholder]="result() === 'conflict' ? 'Describe the conflicting information' : 'Optional'"></textarea></div>

        <p class="next muted"><span class="icon xs">event_repeat</span> {{ nextText() }}</p>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <div class="acts">
          <button class="btn btn-ghost" (click)="closed.emit()">Cancel</button>
          <button class="btn btn-primary" [disabled]="!result()" (click)="save()">Save check</button>
        </div>
      </div>
    </app-modal>
  `,
  styles: `
    .wrap { padding: 22px; }
    h3 { display: flex; gap: 8px; align-items: center; font-size: 18px; .icon { color: var(--primary); } }
    .sub { font-size: 13px; margin: 4px 0 14px; }
    .flag { display: flex; gap: 8px; padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; background: #fde8ee; color: #9b0f36; }
    .lbl { display: block; font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }
    .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 14px; }
    .opt { display: flex; gap: 6px; align-items: center; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; font-size: 13.5px; cursor: pointer;
      input { accent-color: var(--primary); } &.on { border-color: var(--primary); background: var(--primary-soft); } &.dis { opacity: .45; cursor: not-allowed; } }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .field small { font-size: 12px; }
    .next { font-size: 12.5px; display: flex; gap: 4px; align-items: center; margin: 0 0 10px; }
    .err { color: var(--red); font-size: 13px; margin: 0 0 10px; }
    .acts { display: flex; justify-content: flex-end; gap: 8px; }
  `,
})
export class VerifyDialogComponent {
  readonly property = input.required<PropertyRecord>();
  readonly closed = output<void>();
  readonly saved = output<void>();
  private admin = inject(AdminService);
  private toast = inject(ToastService);

  readonly labels = VERIFICATION_RESULT_LABEL;
  readonly results = Object.keys(VERIFICATION_RESULT_LABEL) as VerificationResult[];
  readonly result = signal<VerificationResult | null>(null);
  readonly error = signal('');
  newRent: number | null = null;
  confirmedBy = 'Owner';
  method: Verification['method'] = 'call';
  evidence = '';
  notes = '';

  nextText() {
    switch (this.result()) {
      case 'available': case 'rent_changed': return `Shown as confirmed for ${AVAILABILITY_POLICY.freshDays} days; next check scheduled automatically.`;
      case 'on_hold': return 'Shown as "on hold"; re-check in 2 days.';
      case 'rented': return 'Listing closes, flat leaves the public map, open enquiries are flagged for alternatives.';
      case 'no_response': return 'Nothing changes now; retry tomorrow. The public label degrades on its own when the confirmation goes stale.';
      case 'conflict': return 'Availability set to unconfirmed until a manager resolves the conflict.';
      default: return 'Choose a result.';
    }
  }

  save() {
    const result = this.result(); if (!result) return;
    if (result === 'conflict' && !this.notes.trim()) { this.error.set('Describe the conflicting information.'); return; }
    const r = this.admin.recordVerification(this.property().id, {
      result, confirmedBy: this.confirmedBy, method: this.method, newRent: this.newRent ?? undefined,
      notes: this.notes || undefined, evidence: this.evidence || undefined,
    });
    if (!r.ok) { this.error.set(r.error); return; }
    this.toast.show(result === 'rent_changed' ? 'Check saved — rent change sent for approval' : 'Availability check saved');
    this.saved.emit();
    this.closed.emit();
  }
}
