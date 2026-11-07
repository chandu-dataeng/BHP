import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from '../../core/admin/auth.service';
import { Permission } from '../../core/admin/permissions';
import { ToastService } from '../../core/services/toast.service';

/** Signed-in staff only. */
const signedIn: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user() ? true : inject(Router).createUrlTree(['/admin/login']);
};

/** Route-level permission — any one of them (convenience — the API enforces the same rule). */
const allow = (...ps: Permission[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  if (ps.some(p => auth.can(p))) return true;
  inject(ToastService).show('Your role does not have access to that page.', 'error');
  return inject(Router).createUrlTree(['/admin']);
};

export const ADMIN_ROUTES: Routes = [
  { path: 'login', title: 'BHP Admin — Sign in', loadComponent: () => import('./login.component').then(m => m.AdminLoginComponent) },
  {
    path: '', canActivate: [signedIn],
    loadComponent: () => import('./admin-shell.component').then(m => m.AdminShellComponent),
    children: [
      { path: '', title: 'BHP Admin — Dashboard', loadComponent: () => import('./dashboard.component').then(m => m.DashboardComponent) },
      { path: 'properties', title: 'BHP Admin — Properties', canActivate: [allow('property.view')],
        loadComponent: () => import('./properties/property-list.component').then(m => m.PropertyListComponent) },
      { path: 'properties/new', title: 'BHP Admin — Add property', canActivate: [allow('property.create')],
        loadComponent: () => import('./properties/property-wizard.component').then(m => m.PropertyWizardComponent) },
      { path: 'properties/import', title: 'BHP Admin — Bulk import', canActivate: [allow('property.create', 'property.edit')],
        loadComponent: () => import('./properties/bulk-import.component').then(m => m.BulkImportComponent) },
      { path: 'properties/:id', title: 'BHP Admin — Property', canActivate: [allow('property.view')],
        loadComponent: () => import('./properties/property-detail.component').then(m => m.PropertyDetailComponent) },
      { path: 'verification', title: 'BHP Admin — Verification queue', canActivate: [allow('verification.record')],
        loadComponent: () => import('./verification/verification-queue.component').then(m => m.VerificationQueueComponent) },
      { path: 'approvals', title: 'BHP Admin — Approvals', canActivate: [allow('property.approve')],
        loadComponent: () => import('./approvals.component').then(m => m.ApprovalsComponent) },
      { path: 'duplicates', title: 'BHP Admin — Duplicates', canActivate: [allow('duplicates.resolve')],
        loadComponent: () => import('./duplicates.component').then(m => m.DuplicatesComponent) },
      { path: 'societies', title: 'BHP Admin — Societies', canActivate: [allow('society.view')], data: { tab: 'societies' },
        loadComponent: () => import('./directory.component').then(m => m.DirectoryComponent) },
      { path: 'sources', title: 'BHP Admin — Sources & agents', canActivate: [allow('source.view')], data: { tab: 'sources' },
        loadComponent: () => import('./directory.component').then(m => m.DirectoryComponent) },
      { path: 'owners', title: 'BHP Admin — Owners', canActivate: [allow('owner.view')], data: { tab: 'owners' },
        loadComponent: () => import('./directory.component').then(m => m.DirectoryComponent) },
      { path: 'team', title: 'BHP Admin — Team & roles', canActivate: [allow('team.manage')],
        loadComponent: () => import('./team.component').then(m => m.TeamComponent) },
      { path: 'audit', title: 'BHP Admin — Audit log', canActivate: [allow('audit.view')],
        loadComponent: () => import('./audit.component').then(m => m.AuditComponent) },
      { path: '**', redirectTo: '' },
    ],
  },
];
