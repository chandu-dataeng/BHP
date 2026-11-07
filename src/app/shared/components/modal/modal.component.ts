import { Component, HostListener, input, output } from '@angular/core';

/** Lightweight dialog: dimmed backdrop, Esc / backdrop click to close, slides up on mobile. */
@Component({
  selector: 'app-modal',
  template: `
    <div class="backdrop" (click)="close.emit()"></div>
    <div class="panel" role="dialog" aria-modal="true" [style.max-width.px]="width()">
      @if (showClose()) {
        <button class="close" type="button" aria-label="Close" (click)="close.emit()">
          <span class="icon">close</span>
        </button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 2000; display: grid; place-items: center; padding: 16px; }
    .backdrop { position: absolute; inset: 0; background: rgba(12, 22, 38, .55); backdrop-filter: blur(2px); animation: fade .2s; }
    .panel {
      position: relative; width: 100%; max-height: calc(100vh - 32px); overflow: auto;
      background: #fff; border-radius: 18px; box-shadow: var(--shadow-lg); animation: pop .22s ease-out;
      scrollbar-width: thin;
    }
    .close {
      position: absolute; top: 12px; right: 12px; z-index: 5; width: 36px; height: 36px; border-radius: 50%;
      border: 0; background: rgba(255, 255, 255, .95); box-shadow: var(--shadow-sm); cursor: pointer;
      display: grid; place-items: center; &:hover { background: #fff; }
    }
    @keyframes fade { from { opacity: 0 } }
    @keyframes pop { from { opacity: 0; transform: translateY(12px) scale(.98) } }
    @media (max-width: 640px) {
      :host { place-items: end center; padding: 0; }
      .panel { border-radius: 18px 18px 0 0; max-height: 92vh; animation: up .25s ease-out; }
      @keyframes up { from { transform: translateY(40px); opacity: 0 } }
    }
  `,
})
export class ModalComponent {
  readonly width = input(520);
  readonly showClose = input(true);
  readonly close = output<void>();

  @HostListener('document:keydown.escape') onEsc() { this.close.emit(); }
}
