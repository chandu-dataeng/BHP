import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../../../core/brand';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer>
      <div class="container grid">
        <div>
          <div class="logo"><span class="mark"><span class="icon fill">home_work</span></span>{{ brand.name }}</div>
          <p>{{ brand.tagline }}. Every listing is checked by our team before it goes live.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <a routerLink="/sale">Buy Plots &amp; Ventures</a>
          <a routerLink="/rent">Flats for Rent</a>
          <a routerLink="/rent/match">Find my match</a>
          <a routerLink="/saved">Saved Properties</a>
          <a routerLink="/admin">{{ brand.company }} staff login</a>
        </div>
        <div>
          <h4>Popular areas</h4>
          <a routerLink="/sale" [queryParams]="{ q: 'Tukkuguda' }">Plots in Tukkuguda</a>
          <a routerLink="/sale" [queryParams]="{ q: 'Shankarpally' }">Plots in Shankarpally</a>
          <a routerLink="/rent" [queryParams]="{ q: 'Gachibowli' }">Flats in Gachibowli</a>
          <a routerLink="/rent" [queryParams]="{ q: 'Kondapur' }">Flats in Kondapur</a>
        </div>
        <div>
          <h4>Contact</h4>
          <p><span class="icon xs">call</span> {{ brand.phone }}</p>
          <p><span class="icon xs">mail</span> {{ brand.email }}</p>
          <p><span class="icon xs">location_on</span> {{ brand.officeAddress }}</p>
        </div>
      </div>
      <div class="bottom">© {{ year }} {{ brand.name }}. All rights reserved.</div>
    </footer>
  `,
  styles: `
    footer { background: var(--navy); color: #c4d2e6; margin-top: 48px; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.2fr; gap: 32px; padding-top: 40px; padding-bottom: 32px; }
    .logo { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 800; font-size: 20px; margin-bottom: 10px; }
    .mark { width: 32px; height: 32px; border-radius: 9px; background: var(--primary); display: grid; place-items: center; .icon { font-size: 20px; } }
    h4 { color: #fff; font-size: 15px; margin-bottom: 12px; }
    a { display: block; color: #c4d2e6; margin-bottom: 8px; &:hover { color: #fff; } }
    p { margin: 0 0 8px; line-height: 1.55; display: flex; gap: 6px; align-items: flex-start; }
    .bottom { border-top: 1px solid rgba(255,255,255,.1); text-align: center; padding: 14px; font-size: 13px; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class FooterComponent {
  readonly brand = BRAND;
  readonly year = new Date().getFullYear();
}
