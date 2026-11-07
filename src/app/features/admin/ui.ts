/** Small building blocks shared by BHP Admin screens. */
import { Component, Directive, Pipe, PipeTransform, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { ListingStatus, STATUS_LABEL } from '../../core/admin/admin.models';
import { AuthService } from '../../core/admin/auth.service';
import { Permission } from '../../core/admin/permissions';
import { agoText } from '../../core/policy/availability';

@Component({
  selector: 'app-status',
  template: `<span class="st" [class]="'st st-' + status()">{{ label[status()] }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<ListingStatus>();
  readonly label = STATUS_LABEL;
}

/** Placeholder shown where a field is redacted for the viewer's role. */
@Component({
  selector: 'app-restricted',
  template: `<span class="restricted" title="Hidden for your role"><span class="icon xs">lock</span>{{ text() }}</span>`,
})
export class RestrictedComponent { readonly text = input('Restricted'); }

/** *appCan="'property.approve'" — renders only if the signed-in user has the permission. */
@Directive({ selector: '[appCan]' })
export class CanDirective {
  readonly appCan = input.required<Permission>();
  private tpl = inject(TemplateRef);
  private vcr = inject(ViewContainerRef);
  private auth = inject(AuthService);
  private shown = false;
  constructor() {
    effect(() => {
      const allowed = this.auth.can(this.appCan());
      if (allowed && !this.shown) { this.vcr.createEmbeddedView(this.tpl); this.shown = true; }
      else if (!allowed && this.shown) { this.vcr.clear(); this.shown = false; }
    });
  }
}

/** ISO → "3 days ago" */
@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(v: string | null | undefined): string { return agoText(v); }
}

/** ISO → "in 2 days" / "3 days overdue" */
@Pipe({ name: 'due' })
export class DuePipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '—';
    const d = Math.round((new Date(v).getTime() - Date.now()) / 86_400_000);
    if (d === 0) return 'today';
    return d > 0 ? `in ${d} day${d === 1 ? '' : 's'}` : `${-d} day${d === -1 ? '' : 's'} overdue`;
  }
}

export const ADMIN_UI = [StatusBadgeComponent, RestrictedComponent, CanDirective, AgoPipe, DuePipe];
