import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BRAND } from '../../../core/brand';
import { SavedService } from '../../../core/services/saved.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header>
      <div class="inner">
        <a routerLink="/" class="logo" (click)="menu.set(false)">
          <span class="mark"><span class="icon fill">home_work</span></span>
          <span>{{ brand.name }}</span>
        </a>
        <nav [class.open]="menu()">
          <a routerLink="/sale" routerLinkActive="active" (click)="menu.set(false)"><span class="icon sm">landscape</span> Buy Plots</a>
          <a routerLink="/rent" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="menu.set(false)"><span class="icon sm">apartment</span> Rent</a>
          <a routerLink="/rent/match" routerLinkActive="active" (click)="menu.set(false)"><span class="icon sm">auto_awesome</span> Find my match</a>
          <a routerLink="/saved" routerLinkActive="active" (click)="menu.set(false)"><span class="icon sm">favorite</span> Saved
            @if (saved.count()) { <span class="cnt">{{ saved.count() }}</span> }</a>
          <a class="cta" [href]="wa" target="_blank" rel="noopener"><span class="icon sm">support_agent</span> Talk to us</a>
        </nav>
        <button class="burger" aria-label="Menu" (click)="menu.update(v => !v)"><span class="icon">{{ menu() ? 'close' : 'menu' }}</span></button>
      </div>
    </header>
  `,
  styles: `
    header { position: sticky; top: 0; z-index: 1000; background: var(--navy); color: #fff; height: var(--header-h); box-shadow: 0 2px 10px rgba(0,0,0,.15); }
    .inner { height: 100%; max-width: 1440px; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; }
    .logo { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 800; font-size: 22px; letter-spacing: -.3px; text-decoration: none !important; }
    .mark { width: 36px; height: 36px; border-radius: 10px; background: var(--primary); display: grid; place-items: center; }
    nav { display: flex; align-items: center; gap: 4px;
      a { color: #dbe6f5; padding: 8px 14px; border-radius: 8px; font-size: 15px; font-weight: 500; display: inline-flex; gap: 6px; align-items: center; text-decoration: none !important;
        &:hover { background: rgba(255,255,255,.08); color: #fff; }
        &.active { color: #fff; background: rgba(255,255,255,.12); } }
      .cta { background: var(--primary); color: #fff; margin-left: 8px; &:hover { background: var(--primary-dark); } }
    }
    .cnt { background: var(--red); color: #fff; font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; display: inline-grid; place-items: center; padding: 0 5px; }
    .burger { display: none; background: none; border: 0; color: #fff; cursor: pointer; }
    @media (max-width: 760px) {
      .burger { display: block; }
      nav { position: absolute; top: var(--header-h); left: 0; right: 0; background: var(--navy); flex-direction: column; align-items: stretch;
        padding: 8px 12px 16px; display: none; box-shadow: var(--shadow);
        &.open { display: flex; } .cta { margin: 8px 0 0; justify-content: center; } }
    }
  `,
})
export class HeaderComponent {
  readonly brand = BRAND;
  readonly saved = inject(SavedService);
  readonly menu = signal(false);
  readonly wa = `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(`Hi ${BRAND.name}, I need help finding a property.`)}`;
}
