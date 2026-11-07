import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/admin/admin.service';

/** Append-only history of important changes (who, what, when). */
@Component({
  selector: 'app-audit',
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <div class="pg-h"><div><h1>Audit log</h1><p>Every important change is traceable. Entries are never edited or deleted.</p></div></div>
    <div class="filters">
      <input class="input grow" placeholder="Search action, record ID, detail…" [ngModel]="q()" (ngModelChange)="q.set($event)">
      <select class="input" [ngModel]="actor()" (ngModelChange)="actor.set($event)">
        <option value="">Everyone</option><option value="public">Website visitors</option>
        @for (u of admin.users(); track u.id) { <option [value]="u.id">{{ u.name }}</option> }
      </select>
    </div>
    <div class="panel tbl-wrap">
      <table class="tbl">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead>
        <tbody>
          @for (a of rows().slice(0, limit()); track a.id) {
            <tr><td class="nw">{{ a.at | date: 'd MMM y, h:mm a' }}</td><td>{{ admin.userName(a.actor) }}</td><td><code>{{ a.action }}</code></td>
              <td>@if (a.entity === 'property') { <a [routerLink]="['/admin/properties', a.entityId]">{{ a.entityId }}</a> } @else { {{ a.entityId }} }</td>
              <td>{{ a.detail }}</td></tr>
          } @empty { <tr><td colspan="5" class="empty-row">No entries.</td></tr> }
        </tbody>
      </table>
      @if (rows().length > limit()) { <button class="btn btn-ghost btn-sm more" (click)="limit.set(limit() + 100)">Show more</button> }
    </div>
  `,
  styles: `
    code { font-size: 12px; background: var(--gray-soft); padding: 2px 6px; border-radius: 4px; }
    .nw { white-space: nowrap; }
    .more { margin: 10px; }
  `,
})
export class AuditComponent {
  readonly admin = inject(AdminService);
  readonly q = signal('');
  readonly actor = signal('');
  readonly limit = signal(100);
  readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    return [...this.admin.audit()]
      .filter(a => !this.actor() || a.actor === this.actor())
      .filter(a => !q || `${a.action} ${a.entityId} ${a.detail}`.toLowerCase().includes(q))
      .sort((a, b) => b.at.localeCompare(a.at));
  });
}
