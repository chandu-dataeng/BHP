import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/admin/admin.service';
import { AuthService } from '../../core/admin/auth.service';
import { LeadStatus } from '../../core/admin/admin.models';
import { freshness } from '../../core/policy/availability';
import { InrPipe, InrShortPipe } from '../../shared/pipes/inr.pipe';
import { ADMIN_UI } from './ui';

interface Exception { icon: string; tone: 'red' | 'amber' | 'blue'; text: string; link: string; count: number; }
interface Task { icon: string; title: string; sub: string; link: string; when?: string; }

const REACHED: Record<string, LeadStatus[]> = {
  qualified: ['qualified', 'visit_scheduled', 'visited', 'negotiation', 'won'],
  visited: ['visited', 'negotiation', 'won'],
  negotiation: ['negotiation', 'won'],
  won: ['won'],
};

/**
 * Role-aware home. Business owner → the five questions (inventory, sourcing, execution, economics,
 * improvement). Executives → their own work for today.
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, InrPipe, InrShortPipe, ...ADMIN_UI],
  template: `
    <div class="pg-h">
      <div><h1>Good {{ greeting }}, {{ auth.user()?.name?.split(' ')?.[0] }}</h1>
        <p>{{ today }} · {{ auth.roleMeta()?.label }}</p></div>
      <div class="acts">
        <a *appCan="'property.create'" class="btn btn-primary btn-sm" routerLink="/admin/properties/new"><span class="icon sm">add_home</span> Add property</a>
      </div>
    </div>

    <!-- 1. Inventory: what do we genuinely have available right now? -->
    @if (showInventory()) {
      <div class="kpis">
        <a class="kpi" routerLink="/admin/properties" [queryParams]="{ status: 'published' }">
          <small>Live on {{ 'FindFlat' }}</small><b>{{ inv().live }}</b><span class="muted">published, not rented</span></a>
        <a class="kpi good" routerLink="/admin/properties" [queryParams]="{ fresh: 'confirmed' }">
          <small><span class="icon xs fill">check_circle</span> Confirmed available</small><b>{{ inv().confirmed }}</b><span class="muted">checked in last 7 days</span></a>
        <a class="kpi warn" routerLink="/admin/verification">
          <small><span class="icon xs fill">schedule</span> Uncertain</small><b>{{ inv().uncertain }}</b><span class="muted">stale, conflict or on hold</span></a>
        <a class="kpi" routerLink="/admin/properties" [queryParams]="{ status: 'pipeline' }">
          <small>In pipeline</small><b>{{ inv().pipeline }}</b><span class="muted">draft → approval</span></a>
      </div>
    }

    <!-- 4. Economics -->
    @if (auth.can('dashboard.business')) {
      <div class="kpis">
        <div class="kpi"><small>Rentals closed (30 days)</small><b>{{ money().deals }}</b><span class="muted">avg rent {{ money().avgRent | inrShort }}</span></div>
        <div class="kpi"><small>Brokerage earned</small><b>{{ money().earned | inrShort }}</b><span class="muted">last 30 days</span></div>
        <div class="kpi good"><small>Cash collected</small><b>{{ money().collected | inrShort }}</b><span class="muted">{{ money().collectedPct }}% of earned</span></div>
        <div class="kpi warn"><small>Receivable · Payouts due</small><b>{{ money().receivable | inrShort }}</b><span class="muted">payouts due {{ money().payoutsDue | inr }}</span></div>
      </div>
    }

    <div class="cols">
      <div class="col">
        <!-- 3. Execution: what needs attention today -->
        @if (exceptions().length) {
          <section class="panel">
            <div class="panel-h"><h2><span class="icon">priority_high</span> Needs attention</h2></div>
            <div class="panel-b ex">
              @for (e of exceptions(); track e.text) {
                <a class="flag" [class]="'flag ' + e.tone" [routerLink]="e.link">
                  <span class="icon sm">{{ e.icon }}</span><span class="grow">{{ e.text }}</span><b>{{ e.count }}</b>
                </a>
              }
            </div>
          </section>
        }

        <section class="panel">
          <div class="panel-h"><h2><span class="icon">checklist</span> My work today</h2><span class="muted">{{ tasks().length }}</span></div>
          @for (t of tasks().slice(0, 8); track t.title + t.sub) {
            <a class="task" [routerLink]="t.link">
              <span class="ti"><span class="icon sm">{{ t.icon }}</span></span>
              <span class="tt"><b>{{ t.title }}</b><small>{{ t.sub }}</small></span>
              @if (t.when) { <span class="when">{{ t.when }}</span> }
            </a>
          } @empty {
            <p class="empty-row">Nothing due — all caught up.</p>
          }
          @if (tasks().length > 8) { <p class="more muted">+ {{ tasks().length - 8 }} more</p> }
        </section>
      </div>

      <div class="col">
        <!-- 5. Improvement: where are we losing leads? -->
        @if (auth.can('dashboard.business') || auth.can('lead.viewAll')) {
          <section class="panel">
            <div class="panel-h"><h2><span class="icon">filter_alt</span> Enquiry funnel</h2>
              <button class="link" (click)="showTable.set(!showTable())">{{ showTable() ? 'Chart' : 'Table' }}</button></div>
            <div class="panel-b">
              <p class="cap muted">Enquiries by furthest stage reached · all channels, last 14 days</p>
              @if (!showTable()) {
                <div class="funnel" role="img" [attr.aria-label]="funnelAria()">
                  @for (s of funnel(); track s.label; let i = $index) {
                    <div class="fr" (mouseenter)="hover.set(i)" (mouseleave)="hover.set(null)">
                      <span class="fl">{{ s.label }}</span>
                      <span class="track"><span class="bar" [style.width.%]="s.pct"></span></span>
                      <span class="fv"><b>{{ s.n }}</b>@if (i) { <small>{{ s.conv }}%</small> }</span>
                      @if (hover() === i) {
                        <span class="tip"><b>{{ s.label }}: {{ s.n }}</b>
                          @if (i) { <span>{{ s.conv }}% of {{ funnel()[i - 1].label.toLowerCase() }} ({{ funnel()[i - 1].n }})</span> }
                          @else { <span>All enquiries received</span> }</span>
                      }
                    </div>
                  }
                </div>
              } @else {
                <table class="tbl"><thead><tr><th>Stage</th><th class="num">Enquiries</th><th class="num">From previous</th></tr></thead>
                  <tbody>@for (s of funnel(); track s.label; let i = $index) {
                    <tr><td>{{ s.label }}</td><td class="num">{{ s.n }}</td><td class="num">{{ i ? s.conv + '%' : '—' }}</td></tr>
                  }</tbody></table>
              }
              <p class="lost muted"><span class="icon xs">info</span> {{ lostCount() }} enquiries marked lost — reasons tracking arrives with the CRM slice.</p>
            </div>
          </section>
        }

        <!-- 2. Sourcing / society performance -->
        @if (auth.can('dashboard.business')) {
          <section class="panel">
            <div class="panel-h"><h2><span class="icon">location_city</span> Societies</h2></div>
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>Society</th><th class="num">Live</th><th class="num">Confirmed</th><th class="num">Enquiries</th><th class="num">Rented</th></tr></thead>
                <tbody>
                  @for (s of societyStats(); track s.name) {
                    <tr><td>{{ s.name }}<span class="sub">{{ s.locality }}</span></td><td class="num">{{ s.live }}</td>
                      <td class="num">{{ s.confirmed }}</td><td class="num">{{ s.leads }}</td><td class="num">{{ s.rented }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 14px; }
    .kpi { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; color: var(--text); text-decoration: none !important; box-shadow: var(--shadow-sm);
      small { font-size: 12.5px; color: var(--muted); font-weight: 600; display: flex; gap: 4px; align-items: center; }
      b { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; } span { font-size: 12px; }
      &.good small .icon { color: var(--green); } &.warn small .icon { color: var(--amber); } }
    a.kpi:hover { border-color: var(--primary); }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    .col { display: grid; gap: 16px; }
    .ex { display: grid; gap: 8px; .flag { align-items: center; color: inherit; text-decoration: none !important; } .grow { flex: 1; } b { font-size: 15px; } }
    .task { display: flex; gap: 12px; align-items: center; padding: 10px 16px; border-bottom: 1px solid #eef0f3; color: var(--text); text-decoration: none !important;
      &:hover { background: #f7faff; } }
    .ti { width: 34px; height: 34px; border-radius: 8px; background: var(--primary-soft); color: var(--primary); display: grid; place-items: center; flex: none; }
    .tt { flex: 1; min-width: 0; b { display: block; font-size: 14px; } small { color: var(--muted); font-size: 12.5px; } }
    .when { font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap; }
    .more { padding: 8px 16px; font-size: 13px; margin: 0; }
    .link { border: 0; background: none; color: var(--primary); font-weight: 600; cursor: pointer; font-size: 13px; }
    .cap { font-size: 12.5px; margin: 0 0 12px; }
    .funnel { display: grid; gap: 10px; }
    .fr { position: relative; display: grid; grid-template-columns: 96px 1fr 64px; gap: 10px; align-items: center; padding: 2px 0; cursor: default; }
    .fl { font-size: 13px; color: var(--text); }
    .track { height: 22px; display: block; }
    .bar { display: block; height: 100%; min-width: 3px; background: var(--primary); border-radius: 0 4px 4px 0; transition: width .3s; }
    .fr:hover .bar { background: var(--primary-dark); }
    .fv { display: flex; gap: 6px; align-items: baseline; font-variant-numeric: tabular-nums; b { font-size: 14px; } small { font-size: 12px; color: var(--muted); } }
    .tip { position: absolute; left: 106px; top: -38px; z-index: 5; background: var(--navy); color: #fff; font-size: 12px; padding: 6px 10px; border-radius: 8px; box-shadow: var(--shadow);
      display: flex; flex-direction: column; white-space: nowrap; pointer-events: none; }
    .lost { font-size: 12.5px; margin: 14px 0 0; display: flex; gap: 4px; align-items: center; }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } .cols { grid-template-columns: 1fr; } }
  `,
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  private admin = inject(AdminService);
  readonly showTable = signal(false);
  readonly hover = signal<number | null>(null);

  readonly greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';
  readonly today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  readonly showInventory = computed(() => this.auth.can('property.view') && this.auth.user()?.role !== 'agent');

  readonly inv = computed(() => {
    const ps = this.admin.properties();
    const live = ps.filter(p => p.status === 'published' && p.availability !== 'rented');
    return {
      live: live.length,
      confirmed: live.filter(p => !p.conflict && freshness(p) === 'confirmed').length,
      uncertain: live.filter(p => p.conflict || freshness(p) !== 'confirmed').length,
      pipeline: ps.filter(p => ['draft', 'pending_verification', 'pending_approval'].includes(p.status)).length,
    };
  });

  readonly money = computed(() => {
    const since = Date.now() - 30 * 86_400_000;
    const ds = this.admin.deals().filter(d => new Date(d.closedAt).getTime() >= since);
    const earned = ds.reduce((n, d) => n + d.brokerageEarned, 0);
    const collected = ds.reduce((n, d) => n + d.brokerageCollected, 0);
    return {
      deals: ds.length, earned, collected, receivable: earned - collected,
      collectedPct: earned ? Math.round(collected / earned * 100) : 0,
      payoutsDue: ds.reduce((n, d) => n + d.sourcePayoutDue - d.sourcePayoutPaid, 0),
      avgRent: ds.length ? Math.round(ds.reduce((n, d) => n + d.agreedRent, 0) / ds.length) : 0,
    };
  });

  readonly funnel = computed(() => {
    const ls = this.admin.leads();
    const stages = [
      { label: 'Enquiries', n: ls.length },
      { label: 'Qualified', n: ls.filter(l => REACHED['qualified'].includes(l.status)).length },
      { label: 'Visited', n: ls.filter(l => REACHED['visited'].includes(l.status)).length },
      { label: 'Negotiation', n: ls.filter(l => REACHED['negotiation'].includes(l.status)).length },
      { label: 'Rented', n: ls.filter(l => REACHED['won'].includes(l.status)).length },
    ];
    const max = Math.max(1, stages[0].n);
    return stages.map((s, i) => ({ ...s, pct: (s.n / max) * 100, conv: i && stages[i - 1].n ? Math.round(s.n / stages[i - 1].n * 100) : 100 }));
  });
  readonly funnelAria = computed(() => 'Enquiry funnel: ' + this.funnel().map(s => `${s.label} ${s.n}`).join(', '));
  readonly lostCount = computed(() => this.admin.leads().filter(l => l.status === 'lost').length);

  readonly exceptions = computed<Exception[]>(() => {
    const out: Exception[] = [];
    const add = (cond: boolean, e: Exception) => { if (cond && e.count) out.push(e); };
    const ps = this.admin.properties();
    const leads = this.admin.leads();
    const now = Date.now();
    const canLeads = this.auth.can('lead.viewAll');
    add(canLeads, { icon: 'person_off', tone: 'red', text: 'Open enquiries with no owner', link: '/admin', count: leads.filter(l => !l.assignedTo && !['won', 'lost'].includes(l.status)).length });
    add(canLeads, { icon: 'alarm', tone: 'red', text: 'Follow-ups overdue', link: '/admin', count: leads.filter(l => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now && !['won', 'lost'].includes(l.status)).length });
    add(this.auth.can('verification.assign'), { icon: 'event_busy', tone: 'amber', text: 'Verifications overdue', link: '/admin/verification', count: this.admin.verificationQueue().filter(q => q.overdue).length });
    add(this.auth.can('property.approve'), { icon: 'report', tone: 'red', text: 'Conflicting availability information', link: '/admin/verification', count: ps.filter(p => p.conflict).length });
    add(this.auth.can('property.approve'), { icon: 'flag', tone: 'amber', text: 'Open reports from tenants', link: '/admin/verification', count: this.admin.reports().filter(r => r.status === 'open').length });
    add(this.auth.can('property.approve'), { icon: 'task_alt', tone: 'blue', text: 'Listings awaiting approval', link: '/admin/approvals', count: ps.filter(p => p.status === 'pending_approval').length });
    add(this.auth.can('property.approve'), { icon: 'currency_rupee', tone: 'blue', text: 'Rent changes awaiting approval', link: '/admin/approvals', count: ps.filter(p => p.pendingRentChange).length });
    add(this.auth.can('duplicates.resolve'), { icon: 'content_copy', tone: 'amber', text: 'Possible duplicate properties', link: '/admin/duplicates', count: this.admin.duplicatePairs().length });
    add(this.auth.can('property.approve'), { icon: 'gpp_maybe', tone: 'amber', text: 'Owner authorizations expiring within 7 days', link: '/admin/properties', count: ps.filter(p => p.status === 'published' && p.authorization.validTill && new Date(p.authorization.validTill).getTime() < now + 7 * 86_400_000).length });
    return out;
  });

  readonly tasks = computed<Task[]>(() => {
    const u = this.auth.user(); if (!u) return [];
    const out: Task[] = [];
    const ps = this.admin.properties();
    const soc = (id: string) => this.admin.societies.find(s => s.id === id)?.name ?? '';
    const now = Date.now();

    if (this.auth.can('verification.record')) {
      this.admin.verificationQueue().filter(q => q.property.assignedVerifier === u.id).forEach(q => out.push({
        icon: 'fact_check', title: `Verify ${q.property.id} · ${q.property.flat.bhk} BHK ${soc(q.property.flat.societyId)}`,
        sub: q.reasons.join(' · ') || 'Routine availability check', link: `/admin/properties/${q.property.id}`, when: q.overdue ? 'Overdue' : 'Due',
      }));
    }
    if (this.auth.can('property.approve')) {
      this.admin.approvalQueue().forEach(p => out.push({
        icon: 'task_alt', title: p.pendingRentChange && p.status !== 'pending_approval' ? `Approve rent change · ${p.id}` : `Approve listing · ${p.id}`,
        sub: `${p.flat.bhk} BHK ${soc(p.flat.societyId)}`, link: '/admin/approvals',
      }));
    }
    if (u.role === 'sourcer' || u.role === 'agent') {
      ps.filter(p => p.sourcedBy === u.id || (u.role === 'agent')).filter(p => p.status !== 'published' && p.status !== 'rented').forEach(p => out.push({
        icon: p.status === 'draft' ? 'edit_note' : p.status === 'rejected' ? 'block' : 'hourglass_top',
        title: `${p.id} · ${p.flat.bhk} BHK ${soc(p.flat.societyId)}`,
        sub: p.status === 'rejected' ? `Rejected: ${p.rejectionReason}` : p.status === 'draft' ? 'Draft — submit for verification' : 'Waiting for ' + (p.status === 'pending_verification' ? 'verification' : 'approval'),
        link: `/admin/properties/${p.id}`,
      }));
    }
    if (u.role === 'telecaller' || u.role === 'visit_exec') {
      this.admin.leads().filter(l => l.assignedTo === u.id && l.nextFollowUpAt && !['won', 'lost'].includes(l.status))
        .sort((a, b) => a.nextFollowUpAt!.localeCompare(b.nextFollowUpAt!))
        .forEach(l => out.push({
          icon: 'call', title: `Follow up ${l.name} · ${l.phone}`, sub: `${l.status.replace('_', ' ')} · ${l.propertyId ?? 'general requirement'}`,
          link: l.propertyId ? `/admin/properties/${l.propertyId}` : '/admin', when: new Date(l.nextFollowUpAt!).getTime() < now ? 'Overdue' : new Date(l.nextFollowUpAt!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        }));
    }
    if (u.role === 'super_admin') {
      out.push({ icon: 'admin_panel_settings', title: 'Review user access', sub: `${this.admin.users().filter(x => x.active).length} active accounts`, link: '/admin/team' });
      out.push({ icon: 'history', title: 'Review audit log', sub: 'Recent sensitive changes', link: '/admin/audit' });
    }
    return out;
  });

  readonly societyStats = computed(() => {
    const ps = this.admin.properties();
    const leads = this.admin.leads();
    return this.admin.societies.map(s => {
      const mine = ps.filter(p => p.flat.societyId === s.id);
      const live = mine.filter(p => p.status === 'published' && p.availability !== 'rented');
      return {
        name: s.name, locality: s.locality, live: live.length,
        confirmed: live.filter(p => !p.conflict && freshness(p) === 'confirmed').length,
        leads: leads.filter(l => l.societyId === s.id).length,
        rented: mine.filter(p => p.status === 'rented').length,
      };
    }).sort((a, b) => b.leads - a.leads);
  });
}
