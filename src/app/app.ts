import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { HeaderComponent } from './shared/components/header/header.component';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent],
  template: `
    @if (!isAdmin()) { <app-header /> }
    <main><router-outlet /></main>
    <div class="toast-host" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="t.kind">
          <span class="icon fill sm">{{ t.kind === 'success' ? 'check_circle' : t.kind === 'error' ? 'error' : 'info' }}</span>
          {{ t.text }}
        </div>
      }
    </div>
  `,
  styles: `
    .toast { display: flex; gap: 8px; align-items: center; background: var(--navy); color: #fff; padding: 12px 16px;
      border-radius: 10px; box-shadow: var(--shadow-lg); font-size: 14px; font-weight: 500; animation: in .25s ease-out; max-width: 92vw;
      &.success .icon { color: #5fe08e; } &.error .icon { color: #ff7b98; } }
    @keyframes in { from { opacity: 0; transform: translateY(10px); } }
  `,
})
export class App {
  readonly toast = inject(ToastService);
  private router = inject(Router);
  /** BHP Admin has its own shell, so the public header is hidden there. */
  readonly isAdmin = toSignal(this.router.events.pipe(
    filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects.startsWith('/admin'))),
    { initialValue: location.pathname.startsWith('/admin') });
}
