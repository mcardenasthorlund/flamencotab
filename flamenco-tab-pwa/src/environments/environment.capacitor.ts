// Entorno para la app nativa (Capacitor / Android).
// La app va empaquetada localmente, así que las actualizaciones llegan por la
// tienda (Play Store) y el Service Worker no aporta nada; además podría servir
// caché obsoleta tras actualizar el APK. Por eso se desactiva aquí.
export const environment = {
  production: true,
  apiBaseUrl: 'https://appbackend.ideasypruebas2.es',
  serviceWorker: false,
};
