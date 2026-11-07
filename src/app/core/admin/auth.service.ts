import { Injectable, computed, inject, signal } from '@angular/core';
import { MockDbService } from '../mock/mock-db.service';
import { Permission, ROLE_META, roleCan } from './permissions';
import { StaffUser } from './admin.models';

const KEY = 'findflat.admin.session';

/**
 * DEMO SIGN-IN: pick a staff user to "log in as" so every role's view can be explored.
 * Replace with real authentication (OTP / SSO + JWT from the .NET API). Keep the same surface:
 * `user()`, `can(permission)`, `logout()`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private db = inject(MockDbService);
  private userId = signal<string | null>(this.load());

  readonly user = computed<StaffUser | null>(() => {
    const u = this.db.db().users.find(x => x.id === this.userId());
    return u && u.active ? u : null;   // a deactivated account loses access immediately
  });
  readonly roleMeta = computed(() => { const u = this.user(); return u ? ROLE_META[u.role] : null; });

  can(p: Permission): boolean {
    const u = this.user();
    return !!u && roleCan(u.role, p);
  }

  login(userId: string): boolean {
    const u = this.db.db().users.find(x => x.id === userId);
    if (!u?.active) return false;
    this.userId.set(userId);
    try { sessionStorage.setItem(KEY, userId); } catch { /* ignore */ }
    return true;
  }

  logout() {
    this.userId.set(null);
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  }

  private load(): string | null {
    try { return sessionStorage.getItem(KEY); } catch { return null; }
  }
}
