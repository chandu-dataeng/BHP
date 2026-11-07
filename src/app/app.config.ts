import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes,
      withComponentInputBinding(),   // route params → component inputs (e.g. id)
      withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withFetch()),  // ready for the .NET Core API
  ],
};
