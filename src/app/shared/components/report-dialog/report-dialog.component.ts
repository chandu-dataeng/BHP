import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { PropertyService } from '../../../core/services/property.service';
import { ToastService } from '../../../core/services/toast.service';
import { ReportReason } from '../../../core/models/common.models';

/** "Report a problem with this listing" — goes straight to the BHP verification queue. */
@Component({
  selector: 'app-report-dialog',
  imports: [ModalComponent, FormsModule],
  template: `
    <app-modal [width]="440" (close)="closed.emit()">
      <div class="wrap">
        <h3><span class="icon">flag</span> Report a problem</h3>
        <p class="muted sub">Property {{ propertyCode() }} · Our team re-checks reported listings first.</p>
        <div class="opts">
          @for (r of reasons; track r.key) {
            <label class="opt" [class.on]="reason() === r.key">
              <input type="radio" name="reason" [checked]="reason() === r.key" (change)="reason.set(r.key)">
              <span class="icon sm">{{ r.icon }}</span> {{ r.label }}
            </label>
          }
        </div>
        <div class="field"><label>Details (optional)</label>
          <textarea class="input" rows="3" [(ngModel)]="details" placeholder="e.g. Owner told me it was rented last week"></textarea></div>
        <div class="field"><label>Your mobile (optional, if we may call back)</label>
          <input class="input" [(ngModel)]="phone" inputmode="numeric" maxlength="10" placeholder="10-digit mobile"></div>
        <button class="btn btn-primary btn-block" [disabled]="!reason() || sending()" (click)="send()">
          {{ sending() ? 'Sending…' : 'Send report' }}</button>
      </div>
    </app-modal>
  `,
  styles: `
    .wrap { padding: 22px; }
    h3 { display: flex; gap: 8px; align-items: center; font-size: 19px; .icon { color: var(--red); } }
    .sub { font-size: 13px; margin: 4px 0 14px; }
    .opts { display: grid; gap: 8px; margin-bottom: 14px; }
    .opt { display: flex; gap: 8px; align-items: center; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; cursor: pointer; font-size: 14px;
      input { display: none; } &.on { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-dark); } }
  `,
})
export class ReportDialogComponent {
  readonly flatId = input.required<string>();
  readonly propertyCode = input.required<string>();
  readonly closed = output<void>();
  private api = inject(PropertyService);
  private toast = inject(ToastService);

  readonly reasons: { key: ReportReason; label: string; icon: string }[] = [
    { key: 'already-rented', label: 'Already rented / not available', icon: 'block' },
    { key: 'wrong-price', label: 'Rent or deposit is different', icon: 'currency_rupee' },
    { key: 'wrong-photos', label: 'Photos don’t match the flat', icon: 'image_not_supported' },
    { key: 'wrong-details', label: 'Other details are wrong', icon: 'edit_note' },
    { key: 'other', label: 'Something else', icon: 'more_horiz' },
  ];
  readonly reason = signal<ReportReason | null>(null);
  readonly sending = signal(false);
  details = '';
  phone = '';

  send() {
    const reason = this.reason(); if (!reason) return;
    this.sending.set(true);
    this.api.reportListing({ flatId: this.flatId(), propertyCode: this.propertyCode(), reason, details: this.details || undefined, phone: this.phone || undefined })
      .subscribe(() => { this.toast.show('Thanks! Our team will re-check this listing.'); this.closed.emit(); });
  }
}
