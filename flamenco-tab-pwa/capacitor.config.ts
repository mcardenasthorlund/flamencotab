import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'es.maniacstudio.flamencotab',
  appName: 'FlamencoTab',
  webDir: 'dist/flamenco-tab-pwa/browser',
  backgroundColor: '#2563EB',
  android: {
    // Origen https://localhost (necesario añadirlo a cors_origins del backend).
    androidScheme: 'https',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#2563EB',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
