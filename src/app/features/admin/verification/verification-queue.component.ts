import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../core/admin/admin.service';
import { AuthService } from '../../../core/admin/auth.service';
import { PropertyRecord } from '../../../core/admin/admin.models';
import { AVAILABILITY_POLICY } from '../../../core/policy/availability';
import { ToastService } from '../../../core/services/toast.service';
import { ADMIN_UI } from '../ui';
import { VerifyDialogComponent } from './verify-dialog.component';

/** Availability verification work queue — prioritised: reports, conflicts, upcoming visits, new submissions, overdue. */
@Component({
  selector: 'app-verification-queue',
  imports: [FormsModule, RouterLink, VerifyDialogComponent, ...ADMIN_UI],
  template: `
    <div class="pg-h">
      <div><h1>Verification queue</h1>
        <p>{{ scope() }} · a confirmation is valid for {{ freshDays }} days, then the public label switches to "reconfirming"</p></div>
    </div>

    <div class="tabs">
      <button [class.on]="tab() === 'due'" (click)="tab.set('due')">Due now ({{ due().length }})</button>
      <button [class.on]="tab() === 'reports'" (click)="tab.set('reports')">Tenant reports ({{ openReports().length }})</button>
    </div>

    @if (tab() === 'due') {
      <div class="panel tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Priority</th><th>Property</th><th>Why</th><th>Last check</th><th>Due</th><th>Assigned</th><th></th></tr></thead>
          <tbody>
            @for (q of due(); track q.property.id) {
              <tr>
                <td><span class="pri" [class.hi]="q.priority >= 40" [class.md]="q.priority >= 20 && q.priority < 40">{{ q.priority >= 40 ? 'High' : q.priority >= 20 ? 'Medium' : 'Normal' }}</span></td>
                <td><a [routerLink]="['/admin/properties', q.property.id]"><b>{{ q.property.id }}</b></a>
                  <span class="sub">{{ q.property.flat.bhk }} BHK · {{ society(q.property.flat.societyId) }} · T{{ q.property.tower }}/{{ q.property.flatNo }}</span></td>
                <td>@for (r of q.reasons; track r) { <span class="why">{{ r }}</span> } @empty { <span class="muted">Routine</span> }</td>
                <td>{{ q.property.lastVerifiedAt ? (q.property.lastVerifiedAt | ago) : 'never' }}<span class="sub">{{ admin.userName(q.property.lastVerifiedBy) }}</span></td>
                <td [class.od]="q.overdue">{{ q.property.nextCheckDue | due }}</td>
                <td>
                  @if (auth.can('verification.assign')) {
                    <select class="input sel" [ngModel]="q.property.assignedVerifier" (ngModelChange)="assign(q.property, $event)">
                      <option [ngValue]="null">Unassigned</option>
                      @for (v of admin.verifiers(); track v.id) { <option [ngValue]="v.id">{{ v.name }}</option> }
                    </select>
                  } @else { {{ admin.userName(q.property.assignedVerifier) }} }
                </td>
                <td><button class="btn btn-primary btn-sm" (click)="verifying.set(q.property)">Record check</button></td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="empty-row"><span class="icon">task_alt</span> Nothing due. Every live listing has a current confirmation.</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="panel tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Reported</th><th>Property</th><th>Reason</th><th>Details</th><th>Contact</th><th></th></tr></thead>
          <tbody>
            @for (r of openReports(); track r.id) {
              <tr>
                <td>{{ r.at | ago }}<span class="sub">{{ r.id }}</span></td>
                <td><a [routerLink]="['/admin/properties', r.propertyId]"><b>{{ r.propertyId }}</b></a></td>
                <td><span class="why">{{ r.reason }}</span></td>
                <td>{{ r.details || '—' }}</td>
                <td>{{ r.phone || '—' }}</td>
                <td>@if (prop(r.propertyId); as p) { <button class="btn btn-primary btn-sm" (click)="verifying.set(p)">Re-check now</button> }</td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="empty-row">No open reports. Tenants can report a listing from any flat page on FindFlat.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (verifying(); as p) {
      <app-verify-dialog [property]="p" (closed)="verifying.set(null)" />
    }
  `,
  styles: `
    .pri { font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: var(--gray-soft); color: #4b5563;
      &.hi { background: #fde8ee; color: #b4123f; } &.md { background: var(--amber-soft); color: #8a5600; } }
    .why { display: inline-block; font-size: 12px; background: var(--primary-soft); color: var(--primary-dark); border-radius: 5px; padding: 2px 6px; margin: 2px 4px 2px 0; }
    .od { color: #b4123f; font-weight: 600; }
    .sel { height: 34px; font-size: 13px; min-width: 140px; }
    .empty-row .icon { color: var(--green); vertical-align: -5px; }
  `,
})
export class VerificationQueueComponent {
  readonly admin = inject(AdminService);
  readonly auth = inject(AuthService);
  private toast = inject(ToastService);
  readonly freshDays = AVAILABILITY_POLICY.freshDays;
  readonly tab = signal<'due' | 'reports'>('due');
  readonly verifying = signal<PropertyRecord | null>(null);

  readonly due = this.admin.verificationQueue;
  readonly openReports = computed(() => this.admin.reports().filter(r => r.status === 'open'));
  readonly scope = computed(() => this.auth.can('verification.assign') ? 'All verifiers' : 'Assigned to you');

  society(id: string) { return this.admin.societies.find(s => s.id === id)?.name ?? id; }
  prop(id: string) { return this.admin.property(id); }
  assign(p: PropertyRecord, userId: string) {
    const r = this.admin.assignVerifier(p.id, userId);
    this.toast.show(r.ok ? `Assigned to ${this.admin.userName(userId)}` : r.error, r.ok ? 'info' : 'error');
  }
}
