import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { PropertyService } from '../../../core/services/property.service';
import { ToastService } from '../../../core/services/toast.service';

/** "Notify me when a matching flat opens up". */
@Component({
  selector: 'app-alert-dialog',
  imports: [ModalComponent, FormsModule],
  template: `
    <app-modal [width]="420" (close)="closed.emit()">
      <div class="wrap">
        <span class="ic"><span class="icon">notifications_active</span></span>
        <h3>Get notified</h3>
        <p class="muted">We'll WhatsApp you when {{ summary() }} becomes available.</p>
        <div class="field"><label>Your name *</label><input class="input" [(ngModel)]="name" autocomplete="name"></div>
        <div class="field"><label>Mobile (WhatsApp) *</label>
          <input class="input" [(ngModel)]="phone" inputmode="numeric" maxlength="10" placeholder="10-digit mobile"></div>
        @if (error()) { <p class="err">Please enter your name and a valid 10-digit mobile number.</p> }
        <button class="btn btn-primary btn-block" [disabled]="sending()" (click)="save()">
          <span class="icon sm">notifications</span> {{ sending() ? 'Saving…' : 'Notify me' }}</button>
      </div>
    </app-modal>
  `,
  styles: `
    .wrap { padding: 24px; text-align: center; }
    .ic { width: 52px; height: 52px; border-radius: 14px; background: var(--primary-soft); color: var(--primary); display: inline-grid; place-items: center; margin-bottom: 8px; }
    h3 { font-size: 20px; } p { font-size: 14px; margin: 6px 0 16px; }
    .field { text-align: left; }
    .err { color: var(--red); font-size: 13px; margin: 0 0 10px; }
  `,
})
export class AlertDialogComponent {
  readonly societyId = input<string>();
  readonly locality = input<string>();
  readonly bhk = input<number | null>(null);
  readonly maxBudget = input<number | null>(null);
  readonly summary = input('a matching flat');
  readonly closed = output<void>();
  private api = inject(PropertyService);
  private toast = inject(ToastService);

  name = '';
  phone = '';
  readonly error = signal(false);
  readonly sending = signal(false);

  save() {
    if (this.name.trim().length < 2 || !/^[6-9]\d{9}$/.test(this.phone)) { this.error.set(true); return; }
    this.sending.set(true);
    this.api.createAlert({
      name: this.name.trim(), phone: this.phone, societyId: this.societyId(), locality: this.locality(),
      bhk: this.bhk() ?? undefined, maxBudget: this.maxBudget() ?? undefined,
    }).subscribe(() => { this.toast.show('Alert saved — we will message you.'); this.closed.emit(); });
  }
}
