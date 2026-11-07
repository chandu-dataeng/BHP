import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../modal/modal.component';
import { PropertyService } from '../../../core/services/property.service';
import { ToastService } from '../../../core/services/toast.service';
import { Enquiry } from '../../../core/models/common.models';

/** "Message us" and "Schedule a site visit" dialog — shared by Rent & Sale. */
@Component({
  selector: 'app-enquiry-dialog',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [width]="480" (close)="closed.emit()">
      <div class="wrap">
        <div class="head">
          <span class="ic"><span class="icon">{{ mode() === 'site-visit' ? 'event_available' : 'mail' }}</span></span>
          <div>
            <h3>{{ mode() === 'site-visit' ? 'Schedule a Site Visit' : 'Send a Message' }}</h3>
            <p class="muted">{{ listingTitle() }}</p>
          </div>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field"><label>Your name *</label>
            <input class="input" formControlName="name" placeholder="Full name" autocomplete="name"></div>
          <div class="row">
            <div class="field"><label>Mobile number *</label>
              <input class="input" formControlName="phone" placeholder="10-digit mobile" inputmode="numeric" maxlength="10" autocomplete="tel"></div>
            <div class="field"><label>Email</label>
              <input class="input" formControlName="email" placeholder="Optional" autocomplete="email"></div>
          </div>

          @if (mode() === 'site-visit') {
            <div class="field"><label>Preferred date *</label>
              <div class="dates">
                @for (d of nextDays; track d.iso) {
                  <button type="button" class="date" [class.active]="form.value.preferredDate === d.iso"
                          (click)="form.patchValue({ preferredDate: d.iso })">
                    <small>{{ d.dow }}</small><b>{{ d.day }}</b><small>{{ d.mon }}</small>
                  </button>
                }
              </div>
            </div>
            <div class="field"><label>Time slot *</label>
              <div class="slots">
                @for (s of slots; track s) {
                  <button type="button" class="chip" [class.active]="form.value.preferredSlot === s"
                          (click)="form.patchValue({ preferredSlot: s })">{{ s }}</button>
                }
              </div>
            </div>
          }

          <div class="field"><label>Message</label>
            <textarea class="input" rows="3" formControlName="message"></textarea></div>

          @if (showErrors() && form.invalid) {
            <p class="err"><span class="icon xs">error</span> Please fill name, a valid 10-digit mobile number{{ mode() === 'site-visit' ? ', date and time slot' : '' }}.</p>
          }
          <button class="btn btn-primary btn-block" type="submit" [disabled]="sending()">
            @if (sending()) { Sending… } @else {
              <span class="icon sm">{{ mode() === 'site-visit' ? 'event_available' : 'send' }}</span>
              {{ mode() === 'site-visit' ? 'Confirm Site Visit' : 'Send Message' }}
            }
          </button>
          <p class="note muted"><span class="icon xs">lock</span> Your details are shared only with our team. No spam.</p>
        </form>
      </div>
    </app-modal>
  `,
  styles: `
    .wrap { padding: 24px; }
    .head { display: flex; gap: 12px; align-items: center; margin-bottom: 18px; padding-right: 36px;
      h3 { font-size: 19px; } p { margin: 2px 0 0; font-size: 13.5px; } }
    .ic { width: 44px; height: 44px; border-radius: 12px; background: var(--primary-soft); color: var(--primary); display: grid; place-items: center; flex: none; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .dates { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .date { flex: none; width: 58px; padding: 8px 0; border-radius: 10px; border: 1px solid var(--border); background: #fff; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      small { font-size: 11px; color: var(--muted); } b { font-size: 17px; }
      &.active { background: var(--primary); border-color: var(--primary); color: #fff; small { color: #dbe8ff; } } }
    .slots { display: flex; flex-wrap: wrap; gap: 8px; }
    .err { color: var(--red); font-size: 13px; margin: 0 0 12px; display: flex; gap: 4px; align-items: center; }
    .note { font-size: 12px; text-align: center; margin: 10px 0 0; display: flex; gap: 4px; justify-content: center; align-items: center; }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; gap: 0; } }
  `,
})
export class EnquiryDialogComponent implements OnInit {
  readonly mode = input<'message' | 'site-visit'>('message');
  readonly listingType = input.required<'rent' | 'sale'>();
  readonly listingId = input.required<string>();
  readonly listingTitle = input.required<string>();
  readonly closed = output<void>();

  private fb = inject(FormBuilder);
  private api = inject(PropertyService);
  private toast = inject(ToastService);

  readonly sending = signal(false);
  readonly showErrors = signal(false);

  readonly slots = ['9 – 11 AM', '11 AM – 1 PM', '2 – 4 PM', '4 – 6 PM'];
  readonly nextDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1);
    return {
      iso: d.toISOString().slice(0, 10),
      dow: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: d.getDate(),
      mon: d.toLocaleDateString('en-IN', { month: 'short' }),
    };
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    email: ['', [Validators.email]],
    message: [''],
    preferredDate: [''],
    preferredSlot: [''],
  });

  ngOnInit() {
    {
      const msg = this.mode() === 'site-visit'
        ? `I'd like to visit ${this.listingTitle()}.`
        : `Hi, I'm interested in ${this.listingTitle()}. Please share more details.`;
      this.form.patchValue({ message: msg });
      if (this.mode() === 'site-visit') {
        this.form.controls.preferredDate.addValidators(Validators.required);
        this.form.controls.preferredSlot.addValidators(Validators.required);
        this.form.controls.preferredDate.updateValueAndValidity();
        this.form.controls.preferredSlot.updateValueAndValidity();
      }
    }
  }

  submit() {
    this.showErrors.set(true);
    if (this.form.invalid) return;
    this.sending.set(true);
    const v = this.form.getRawValue();
    const e: Enquiry = {
      type: this.mode(), listingType: this.listingType(), listingId: this.listingId(), listingTitle: this.listingTitle(),
      ...v,
    };
    this.api.submitEnquiry(e).subscribe(r => {
      this.sending.set(false);
      const ref = r.reference ? ` Ref ${r.reference}.` : '';
      this.toast.show(r.duplicate
        ? `We already have your request — added this to it.${ref}`
        : this.mode() === 'site-visit'
          ? `Site visit requested! We'll reconfirm availability and call you.${ref}`
          : `Message sent! We will get back to you shortly.${ref}`, 'success', 4000);
      this.closed.emit();
    });
  }
}
