import { Routes } from '@angular/router';
import { environment } from '../environments/environment';

/** All feature screens are lazy-loaded so the first page opens fast. */
export const routes: Routes = [
  { path: '', title: 'FindFlat — Flats for Rent & Plots in Hyderabad',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent) },

  // SALE  (Screen-2 plots map → venture dialog → venture detail)
  { path: 'sale', title: 'Plots & Ventures for Sale in Hyderabad',
    loadComponent: () => import('./features/sale/sale-map.component').then(m => m.SaleMapComponent) },
  { path: 'sale/venture/:id', title: 'Venture Details',
    loadComponent: () => import('./features/sale/venture-detail.component').then(m => m.VentureDetailComponent) },

  // RENT  (map → society dialog → BHK-wise listing → flat detail)
  { path: 'rent', title: 'Flats for Rent in Hyderabad',
    loadComponent: () => import('./features/rent/rent-map.component').then(m => m.RentMapComponent) },
  { path: 'rent/match', title: 'Find a Flat That Fits Your Needs',
    loadComponent: () => import('./features/rent/match.component').then(m => m.MatchComponent) },
  { path: 'rent/compare', title: 'Compare Flats',
    loadComponent: () => import('./features/rent/compare.component').then(m => m.CompareComponent) },
  { path: 'rent/society/:id', title: 'Available Flats',
    loadComponent: () => import('./features/rent/society-flats.component').then(m => m.SocietyFlatsComponent) },
  { path: 'rent/flat/:id', title: 'Flat Details',
    loadComponent: () => import('./features/rent/flat-detail.component').then(m => m.FlatDetailComponent) },

  { path: 'saved', title: 'Saved Properties',
    loadComponent: () => import('./features/saved/saved.component').then(m => m.SavedComponent) },

  // BHP ADMIN (internal operating system) — its own shell, lazy-loaded. Its login is demo-only (pick a role, no
  // password), so the public production build leaves it out entirely until the .NET API provides real sign-in.
  ...(environment.adminEnabled
    ? [{ path: 'admin', loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES) }]
    : []),

  { path: '**', redirectTo: '' },
];
