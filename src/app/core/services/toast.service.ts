import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; kind: 'success' | 'info' | 'error'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'success', ms = 2800) {
    const t = { id: ++this.seq, text, kind };
    this.toasts.update(l => [...l, t]);
    setTimeout(() => this.toasts.update(l => l.filter(x => x.id !== t.id)), ms);
  }
}
