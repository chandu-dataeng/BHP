import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';

/** Filter chip that opens a small panel (closes on outside click / Esc). */
@Component({
  selector: 'app-dropdown',
  template: `
    <button type="button" class="chip" [class.active]="active()" (click)="open.update(v => !v)">
      @if (icon()) { <span class="icon sm">{{ icon() }}</span> }
      {{ label() }}
      <span class="icon sm caret" [class.up]="open()">expand_more</span>
    </button>
    @if (open()) {
      <div class="panel" [class.right]="alignRight()" [style.min-width.px]="width()">
        <ng-content />
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-block; }
    .caret { transition: transform .15s; margin-right: -4px; &.up { transform: rotate(180deg); } }
    .panel { position: absolute; top: calc(100% + 8px); left: 0; z-index: 1100; background: #fff; border: 1px solid var(--border);
      border-radius: 12px; box-shadow: var(--shadow); padding: 14px; animation: d .15s ease-out;
      &.right { left: auto; right: 0; } }
    @keyframes d { from { opacity: 0; transform: translateY(-4px); } }
  `,
})
export class DropdownComponent {
  readonly label = input.required<string>();
  readonly icon = input('');
  readonly active = input(false);
  readonly width = input(240);
  readonly alignRight = input(false);
  readonly open = signal(false);
  private el = inject(ElementRef);

  close() { this.open.set(false); }

  @HostListener('document:click', ['$event'])
  outside(e: MouseEvent) { if (!this.el.nativeElement.contains(e.target)) this.open.set(false); }
  @HostListener('document:keydown.escape') esc() { this.open.set(false); }
}
