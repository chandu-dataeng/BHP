import { Injectable, signal } from '@angular/core';

/** Flats picked for side-by-side comparison (max 3). Lives for the session; the compare page itself is driven by its URL. */
@Injectable({ providedIn: 'root' })
export class CompareService {
  static readonly MAX = 3;

  private ids = signal<string[]>([]);
  readonly all = this.ids.asReadonly();

  has(id: string) { return this.ids().includes(id); }

  /** Adds or removes; returns false when the flat could not be added because 3 are already picked. */
  toggle(id: string): boolean {
    if (this.has(id)) { this.ids.update(l => l.filter(x => x !== id)); return true; }
    if (this.ids().length >= CompareService.MAX) return false;
    this.ids.update(l => [...l, id]);
    return true;
  }

  clear() { this.ids.set([]); }
}
