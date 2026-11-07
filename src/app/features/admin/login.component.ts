import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/admin/auth.service';
import { MockDbService } from '../../core/mock/mock-db.service';
import { ROLE_META } from '../../core/admin/permissions';
import { BRAND } from '../../core/brand';
import { ToastService } from '../../core/services/toast.service';

/** DEMO sign-in — choose a staff account to explore each role. Replace with OTP / SSO login. */
@Component({
  selector: 'app-admin-login',
  imports: [RouterLink],
  template: `
    <div class="wrap">
      <div class="box">
        <div class="hd">
          <span class="mark"><span class="icon fill">home_work</span></span>
          <div><h1>{{ brand.company }} Admin</h1><p>Sign in to the {{ brand.name }} operating system</p></div>
        </div>
        <p class="demo"><span class="icon xs">science</span> Demo mode — pick an account to see what that role can see and do.
          Real login (OTP / SSO) comes with the backend.</p>
        <div class="list">
          @for (u of users(); track u.id) {
            <button class="u" [disabled]="!u.active" (click)="login(u.id)">
              <span class="av">{{ u.name.charAt(0) }}</span>
              <span class="t">
                <b>{{ u.name }}</b>
                <small>{{ meta[u.role].level }} · {{ meta[u.role].label }} — {{ meta[u.role].description }}</small>
              </span>
              @if (!u.active) { <span class="off">Deactivated</span> } @else { <span class="icon sm">arrow_forward</span> }
            </button>
          }
        </div>
        <a routerLink="/" class="back"><span class="icon xs">arrow_back</span> Back to {{ brand.name }}</a>
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: linear-gradient(160deg, var(--navy), #1b4f8a); }
    .box { background: #fff; border-radius: 18px; box-shadow: var(--shadow-lg); width: 100%; max-width: 560px; padding: 26px; }
    .hd { display: flex; gap: 12px; align-items: center; h1 { font-size: 22px; } p { margin: 2px 0 0; color: var(--muted); font-size: 14px; } }
    .mark { width: 44px; height: 44px; border-radius: 12px; background: var(--primary); color: #fff; display: grid; place-items: center; }
    .demo { background: var(--amber-soft); color: #7a4c00; border-radius: 10px; padding: 10px 12px; font-size: 13px; margin: 18px 0 14px; }
    .list { display: grid; gap: 8px; max-height: 60vh; overflow-y: auto; scrollbar-width: thin; }
    .u { display: flex; gap: 12px; align-items: center; text-align: left; border: 1px solid var(--border); background: #fff; border-radius: 12px; padding: 10px 12px; cursor: pointer;
      &:hover:not(:disabled) { border-color: var(--primary); background: #f7faff; }
      &:disabled { opacity: .55; cursor: not-allowed; }
      .t { flex: 1; min-width: 0; b { display: block; font-size: 14.5px; } small { color: var(--muted); font-size: 12px; } }
      .icon { color: var(--primary); } }
    .av { width: 36px; height: 36px; border-radius: 50%; background: var(--primary-soft); color: var(--primary-dark); display: grid; place-items: center; font-weight: 700; flex: none; }
    .off { font-size: 11px; font-weight: 700; color: var(--red); }
    .back { display: inline-flex; gap: 4px; align-items: center; margin-top: 16px; font-size: 13.5px; }
  `,
})
export class AdminLoginComponent {
  private auth = inject(AuthService);
  private db = inject(MockDbService);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly brand = BRAND;
  readonly meta = ROLE_META;
  readonly users = computed(() => this.db.db().users);

  login(id: string) {
    if (!this.auth.login(id)) { this.toast.show('This account is deactivated.', 'error'); return; }
    this.router.navigate(['/admin']);
  }
}
