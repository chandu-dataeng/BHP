import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/admin/auth.service';
import { AdminService } from '../../core/admin/admin.service';
import { Permission } from '../../core/admin/permissions';
import { BRAND } from '../../core/brand';
import { ToastService } from '../../core/services/toast.service';

interface NavItem { label: string; icon: string; link: string; perm?: Permission | Permission[]; badge?: () => number; exact?: boolean; }

/**
 * BHP Admin shell: sidebar built from the signed-in user's permissions.
 * Styles here are global but scoped under `.adm`, so they only load with the admin chunk.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="adm" [class.nav-open]="navOpen()">
      <aside class="side">
        <a class="brand" routerLink="/admin">
          <span class="mark"><span class="icon fill">home_work</span></span>
          <span><b>{{ brand.company }} Admin</b><small>{{ brand.name }} operating system</small></span>
        </a>
        <nav>
          @for (g of groups(); track g.title) {
            <p class="grp">{{ g.title }}</p>
            @for (n of g.items; track n.link) {
              <a [routerLink]="n.link" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: !!n.exact }" (click)="navOpen.set(false)">
                <span class="icon sm">{{ n.icon }}</span>{{ n.label }}
                @if (n.badge && n.badge()) { <span class="cnt">{{ n.badge() }}</span> }
              </a>
            }
          }
          <p class="grp">Coming next</p>
          @for (n of upcoming; track n.label) {
            <span class="soon" title="Next slice: CRM & transactions"><span class="icon sm">{{ n.icon }}</span>{{ n.label }}</span>
          }
        </nav>
        <div class="side-foot">
          <a href="/" target="_blank"><span class="icon xs">open_in_new</span> Public site</a>
          <button (click)="reset()"><span class="icon xs">restart_alt</span> Reset demo data</button>
        </div>
      </aside>

      <div class="main">
        <header class="top">
          <button class="burger" (click)="navOpen.update(v => !v)" aria-label="Menu"><span class="icon">menu</span></button>
          <span class="sp"></span>
          @if (auth.user(); as u) {
            <div class="me">
              <span class="av">{{ u.name.charAt(0) }}</span>
              <span class="who"><b>{{ u.name }}</b><small>{{ auth.roleMeta()?.level }} · {{ auth.roleMeta()?.label }}</small></span>
            </div>
            <button class="btn btn-ghost btn-sm" (click)="switchUser()"><span class="icon sm">switch_account</span> Switch user</button>
          }
        </header>
        <div class="content"><router-outlet /></div>
      </div>
      <div class="scrim" (click)="navOpen.set(false)"></div>
    </div>
  `,
  styles: `
    .adm { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; background: #f4f6f9; }
    .adm .side { background: var(--navy); color: #c9d6e8; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; scrollbar-width: thin; }
    .adm .brand { display: flex; gap: 10px; align-items: center; padding: 18px 16px; color: #fff; text-decoration: none !important;
      b { display: block; font-size: 16px; } small { font-size: 11px; color: #9fb3cf; } }
    .adm .mark { width: 34px; height: 34px; border-radius: 10px; background: var(--primary); display: grid; place-items: center; flex: none; }
    .adm nav { padding: 4px 10px; flex: 1; }
    .adm .grp { font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; color: #7f95b5; margin: 14px 8px 6px; font-weight: 700; }
    .adm nav a, .adm .soon { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; color: #d5e0ee; font-size: 14px; text-decoration: none !important; }
    .adm nav a:hover { background: rgba(255,255,255,.07); color: #fff; }
    .adm nav a.on { background: rgba(255,255,255,.14); color: #fff; font-weight: 600; }
    .adm .soon { opacity: .45; cursor: default; }
    .adm .cnt { margin-left: auto; background: var(--red); color: #fff; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 10px; display: grid; place-items: center; padding: 0 6px; }
    .adm .side-foot { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,.08); display: grid; gap: 6px;
      a, button { color: #9fb3cf; font-size: 12.5px; background: none; border: 0; padding: 0; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; text-align: left; }
      a:hover, button:hover { color: #fff; } }
    .adm .main { min-width: 0; display: flex; flex-direction: column; }
    .adm .top { height: 60px; background: #fff; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; padding: 0 22px; position: sticky; top: 0; z-index: 50; }
    .adm .top .sp { flex: 1; }
    .adm .burger { display: none; border: 0; background: none; cursor: pointer; }
    .adm .me { display: flex; gap: 10px; align-items: center; }
    .adm .av { width: 34px; height: 34px; border-radius: 50%; background: var(--primary-soft); color: var(--primary-dark); display: grid; place-items: center; font-weight: 700; }
    .adm .who { display: flex; flex-direction: column; line-height: 1.2; b { font-size: 14px; } small { font-size: 12px; color: var(--muted); } }
    .adm .content { padding: 24px; max-width: 1400px; width: 100%; }
    .adm .scrim { display: none; }

    /* ---------- shared admin page styles ---------- */
    .adm .pg-h { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 18px; flex-wrap: wrap;
      h1 { font-size: 23px; } p { margin: 4px 0 0; color: var(--muted); font-size: 14px; } .acts { display: flex; gap: 8px; flex-wrap: wrap; } }
    .adm .panel { background: #fff; border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-sm); }
    .adm .panel-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--border);
      h2, h3 { font-size: 15.5px; display: flex; align-items: center; gap: 8px; } .icon { color: var(--primary); } }
    .adm .panel-b { padding: 16px; }
    .adm .tbl-wrap { overflow-x: auto; }
    .adm table.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px;
      th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); font-weight: 700; padding: 10px 12px; border-bottom: 1px solid var(--border); background: #fafbfc; white-space: nowrap; }
      td { padding: 10px 12px; border-bottom: 1px solid #eef0f3; vertical-align: middle; }
      tr.click { cursor: pointer; } tr.click:hover td { background: #f7faff; }
      .sub { display: block; font-size: 12px; color: var(--muted); margin-top: 2px; }
      .num { text-align: right; font-variant-numeric: tabular-nums; } }
    .adm .st { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .adm .st-draft, .adm .st-rejected { background: var(--gray-soft); color: #4b5563; }
    .adm .st-pending_verification { background: var(--amber-soft); color: #8a5600; }
    .adm .st-pending_approval { background: var(--primary-soft); color: var(--primary-dark); }
    .adm .st-published { background: var(--green-soft); color: var(--green-text); }
    .adm .st-suspended { background: #fde8ee; color: #b4123f; }
    .adm .st-rented { background: #e6ebf2; color: var(--navy); }
    .adm .restricted { display: inline-flex; align-items: center; gap: 3px; color: #8a93a0; font-size: 12px; font-style: italic; }
    .adm .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 14px;
      .input { height: 38px; width: auto; min-width: 160px; font-size: 14px; } .grow { flex: 1; min-width: 220px; } }
    .adm .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 16px; overflow-x: auto;
      button, a { border: 0; background: none; padding: 10px 14px; font-weight: 600; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; font-size: 14px; text-decoration: none !important; }
      .on { color: var(--primary); border-bottom-color: var(--primary); } }
    .adm .kv { display: grid; grid-template-columns: 170px 1fr; gap: 8px 12px; font-size: 14px; dt { color: var(--muted); } dd { margin: 0; } }
    .adm .flag { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; font-size: 13.5px;
      &.red { background: #fde8ee; color: #9b0f36; } &.amber { background: var(--amber-soft); color: #7a4c00; } &.blue { background: var(--primary-soft); color: var(--primary-dark); } &.green { background: var(--green-soft); color: var(--green-text); } }
    .adm .empty-row { padding: 28px; text-align: center; color: var(--muted); }
    .adm .chk { display: flex; gap: 8px; align-items: flex-start; padding: 7px 0; font-size: 14px;
      .icon { font-size: 19px; } .ok { color: var(--green); } .no { color: var(--red); } small { display: block; color: var(--muted); font-size: 12px; } }
    .adm .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .adm .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .adm .field label small { font-weight: 400; }

    @media (max-width: 980px) {
      .adm { grid-template-columns: 1fr; }
      .adm .side { position: fixed; inset: 0 auto 0 0; width: 260px; z-index: 200; transform: translateX(-100%); transition: transform .2s; }
      .adm.nav-open .side { transform: none; }
      .adm.nav-open .scrim { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 150; }
      .adm .burger { display: block; }
      .adm .who { display: none; }
      .adm .content { padding: 16px; }
      .adm .grid2, .adm .grid3 { grid-template-columns: 1fr; }
      .adm .kv { grid-template-columns: 130px 1fr; }
    }
  `,
})
export class AdminShellComponent {
  readonly auth = inject(AuthService);
  private admin = inject(AdminService);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly brand = BRAND;
  readonly navOpen = signal(false);

  private readonly all: { title: string; items: NavItem[] }[] = [
    { title: 'Overview', items: [{ label: 'Dashboard', icon: 'space_dashboard', link: '/admin', exact: true }] },
    { title: 'Inventory', items: [
      { label: 'Properties', icon: 'apartment', link: '/admin/properties', perm: 'property.view', exact: true },
      { label: 'Add property', icon: 'add_home', link: '/admin/properties/new', perm: 'property.create' },
      { label: 'Bulk import (Google Sheets)', icon: 'upload_file', link: '/admin/properties/import', perm: ['property.create', 'property.edit'] },
      { label: 'Verification', icon: 'fact_check', link: '/admin/verification', perm: 'verification.record', badge: () => this.admin.verificationQueue().filter(q => q.overdue || q.reasons.length).length },
      { label: 'Approvals', icon: 'task_alt', link: '/admin/approvals', perm: 'property.approve', badge: () => this.admin.approvalQueue().length },
      { label: 'Duplicates', icon: 'content_copy', link: '/admin/duplicates', perm: 'duplicates.resolve', badge: () => this.admin.duplicatePairs().length },
    ] },
    { title: 'Directory', items: [
      { label: 'Societies', icon: 'location_city', link: '/admin/societies', perm: 'society.view' },
      { label: 'Sources & agents', icon: 'handshake', link: '/admin/sources', perm: 'source.view' },
      { label: 'Owners', icon: 'person', link: '/admin/owners', perm: 'owner.view' },
    ] },
    { title: 'Administration', items: [
      { label: 'Team & roles', icon: 'admin_panel_settings', link: '/admin/team', perm: 'team.manage' },
      { label: 'Audit log', icon: 'history', link: '/admin/audit', perm: 'audit.view' },
    ] },
  ];

  readonly groups = computed(() => {
    this.auth.user();   // re-evaluate on user switch
    return this.all.map(g => ({ ...g, items: g.items.filter(i => !i.perm || [i.perm].flat().some(p => this.auth.can(p))) })).filter(g => g.items.length);
  });

  readonly upcoming = [
    { label: 'Enquiries & follow-ups', icon: 'support_agent' }, { label: 'Site visits', icon: 'directions_walk' },
    { label: 'Negotiation & deals', icon: 'gavel' }, { label: 'Brokerage & payouts', icon: 'payments' },
  ];

  switchUser() { this.auth.logout(); this.router.navigate(['/admin/login']); }
  reset() {
    if (!confirm('Reset all demo data to the original sample records?')) return;
    this.admin.resetDemo();
    this.toast.show('Demo data reset', 'info');
  }
}
