import { Injectable, computed, signal } from '@angular/core';

/** Saved / favourite listings, kept in the browser (localStorage). */
@Injectable({ providedIn: 'root' })
export class SavedService {
  private key = 'nestly.saved.v1';
  private ids = signal<string[]>(this.load());

  readonly all = this.ids.asReadonly();
  readonly count = computed(() => this.ids().length);

  isSaved(id: string) { return this.ids().includes(id); }

  toggle(id: string): boolean {
    const next = this.isSaved(id) ? this.ids().filter(x => x !== id) : [...this.ids(), id];
    this.ids.set(next);
    try { localStorage.setItem(this.key, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next.includes(id);
  }

  private load(): string[] {
    try { return JSON.parse(localStorage.getItem(this.key) ?? '[]'); } catch { return []; }
  }
}
