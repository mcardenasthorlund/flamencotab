// Entorno de desarrollo.
// Se usa el backend de producción (mismo endpoint en ambos entornos).
// Si prefieres un backend local, cambia apiBaseUrl por '/api' y arranca
// `backend/docker-compose.yaml` (proxy en `proxy.conf.json`).
export const environment = {
  production: false,
  apiBaseUrl: 'https://appbackend.ideasypruebas2.es',
};
