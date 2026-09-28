import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Des-registrar cualquier Service Worker existente para que la aplicación
// siempre se sirva desde internet y nunca desde una caché obsoleta.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    })
    .catch(() => undefined);
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));