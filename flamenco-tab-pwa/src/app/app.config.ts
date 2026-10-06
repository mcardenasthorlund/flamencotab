import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { SYNC_PROVIDER } from './core/sync/providers/sync-provider';
import { HttpSyncProvider } from './core/sync/providers/http-sync.provider';
import { SYNC_CONFIG, DEFAULT_SYNC_CONFIG } from './core/sync/models/sync-config';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    { provide: SYNC_PROVIDER, useExisting: HttpSyncProvider },
    {
      provide: SYNC_CONFIG,
      useValue: { ...DEFAULT_SYNC_CONFIG, apiBaseUrl: environment.apiBaseUrl },
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
  ],
};