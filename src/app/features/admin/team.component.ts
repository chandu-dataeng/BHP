import { Component, computed, inject, signal } from '@angular/core';
import { AdminService } from '../../core/admin/admin.service';
import { Permission, ROLE_META, ROLE_PERMISSIONS, Role } from '../../core/admin/permissions';
import { StaffUser } from '../../core/admin/admin.models';
import { ToastService } from '../../core/services/toast.service';

const PERM_LABEL: Record<Permission, string> = {
  'dashboard.business': 'Business dashboard & revenue', 'property.view': 'View properties', 'property.create': 'Add properties',
  'property.edit': 'Edit properties', 'property.viewOwner': 'See owner contact', 'property.viewCommercial': 'See commercial terms',
  'property.approve': 'Approve listings & rent changes', 'property.suspend': 'Suspend listings', 'verification.record': 'Record availability checks',
  'verification.assign': 'Assign verifications', 'duplicates.resolve': 'Resolve duplicates', 'lead.viewAll': 'See all enquiries',
  'source.view': 'View sources', 'source.manage': 'Manage sources', 'owner.view': 'Owner directory', 'society.view': 'Society master',
  'team.manage': 'Manage users & roles', 'audit.view': 'Audit log', 'finance.view': 'Finance', 'system.configure': 'System settings',
};

/** Users, activation (leavers lose access instantly, open work is re-assigned), and the role × permission matrix. */
@Component({
  selector: 'app-team',
  template: `
    <div class="pg-h"><div><h1>Team & roles</h1><p>Least privilege: each role sees only what its job needs. The API enforces the same matrix.</p></div></div>
    <div class="tabs">
      <button [class.on]="tab() === 'users'" (click)="tab.set('users')">Users ({{ admin.users().length }})</button>
      <button [class.on]="tab() === 'matrix'" (click)="tab.set('matrix')">Permission matrix</button>
    </div>

    @if (tab() === 'users') {
      <div class="panel tbl-wrap">
        <table class="tbl">
          <thead><tr><th>User</th><th>Role</th><th>Contact</th><th>Open work</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (u of admin.users(); track u.id) {
              <tr>
                <td><b>{{ u.name }}</b><span class="sub">{{ u.id }}</span></td>
                <td>{{ meta[u.role].level }} · {{ meta[u.role].label }}</td>
                <td>{{ u.phone }}<span class="sub">{{ u.email }}</span></td>
                <td>{{ openWork(u) }}</td>
                <td><span class="st" [class]="u.active ? 'st st-published' : 'st st-rejected'">{{ u.active ? 'Active' : 'Deactivated' }}</span></td>
                <td>
                  @if (u.active) { <button class="btn btn-ghost btn-sm" (click)="toggle(u)">Deactivate</button> }
                  @else { <button class="btn btn-outline btn-sm" (click)="toggle(u)">Re-activate</button> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="muted note">Adding users and editing roles arrives with real authentication. Deactivation here is live: the account can no longer sign in, and its verifications and enquiries move to a colleague.</p>
    } @else {
      <div class="panel tbl-wrap">
        <table class="tbl matrix">
          <thead><tr><th>Permission</th>@for (r of roles; track r) { <th class="c" [title]="meta[r].description">{{ meta[r].level }}<br>{{ meta[r].label }}</th> }</tr></thead>
          <tbody>
            @for (p of perms; track p) {
              <tr><td>{{ permLabel[p] }}<span class="sub">{{ p }}</span></td>
                @for (r of roles; track r) { <td class="c">@if (has(r, p)) { <span class="icon fill ok">check_circle</span> } @else { <span class="no">·</span> }</td> }</tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .note { font-size: 12.5px; margin-top: 10px; }
    .matrix th.c { text-align: center; font-size: 10.5px; line-height: 1.3; white-space: normal; min-width: 78px; }
    .matrix td.c { text-align: center; } .ok { color: var(--green); font-size: 18px; } .no { color: #c7ccd4; }
  `,
})
export class TeamComponent {
  readonly admin = inject(AdminService);
  private toast = inject(ToastService);
  readonly tab = signal<'users' | 'matrix'>('users');
  readonly meta = ROLE_META;
  readonly permLabel = PERM_LABEL;
  readonly roles = Object.keys(ROLE_META) as Role[];
  readonly perms = Object.keys(PERM_LABEL) as Permission[];

  private props = computed(() => this.admin.properties());
  has(r: Role, p: Permission) { return ROLE_PERMISSIONS[r].includes(p); }
  openWork(u: StaffUser) {
    const v = this.props().filter(p => p.assignedVerifier === u.id && p.status !== 'rented' && p.status !== 'rejected').length;
    return v ? `${v} verification(s)` : '—';
  }
  toggle(u: StaffUser) {
    if (u.active && !confirm(`Deactivate ${u.name}? They lose access immediately and open work is re-assigned.`)) return;
    const r = this.admin.setUserActive(u.id, !u.active);
    this.toast.show(r.ok ? (u.active ? `${u.name} deactivated` : `${u.name} re-activated`) : r.error, r.ok ? 'info' : 'error');
  }
}
