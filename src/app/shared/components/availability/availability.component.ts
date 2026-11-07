import { Component, computed, input } from '@angular/core';
import { AvailabilityState } from '../../../core/models/rent.models';
import { freshnessLabel } from '../../../core/policy/availability';

/**
 * Availability freshness indicator. `pill` for cards, `banner` for the detail page.
 * Never says "available" without saying WHEN it was last confirmed.
 */
@Component({
  selector: 'app-availability',
  template: `
    @if (variant() === 'banner') {
      <div class="banner" [class]="label().tone">
        <span class="icon fill">{{ label().icon }}</span>
        <span>{{ label().text }}</span>
      </div>
    } @else {
      <span class="badge" [class]="'badge-' + label().tone" [title]="label().text">
        <span class="icon xs fill">{{ label().icon }}</span>{{ label().short }}
      </span>
    }
  `,
  styles: `
    :host { display: contents; }
    .banner { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 10px; font-size: 13.5px; font-weight: 600;
      &.green { background: var(--green-soft); color: var(--green-text); }
      &.amber { background: var(--amber-soft); color: #8a5600; }
      &.gray { background: var(--gray-soft); color: #4b5563; } }
  `,
})
export class AvailabilityComponent {
  readonly flat = input.required<{ availability: AvailabilityState; lastVerifiedAt: string | null }>();
  readonly variant = input<'pill' | 'banner'>('pill');
  readonly label = computed(() => freshnessLabel(this.flat()));
}
