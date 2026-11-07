import { Injectable, signal } from '@angular/core';

/** Ventures this visitor has already opened — shown with an "eye" pin on the map. */
@Injectable({ providedIn: 'root' })
export class ViewedService {
  private key = 'nestly.viewed.v1';
  readonly ids = signal<string[]>(this.load());

  mark(id: string) {
    if (this.ids().includes(id)) return;
    const next = [...this.ids(), id];
    this.ids.set(next);
    try { localStorage.setItem(this.key, JSON.stringify(next)); } catch { /* ignore */ }
  }
  has(id: string) { return this.ids().includes(id); }

  private load(): string[] {
    try { return JSON.parse(localStorage.getItem(this.key) ?? '[]'); } catch { return []; }
  }
}
