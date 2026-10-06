import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shgonzals.garage',
  appName: 'Garage',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      androidIsEncryption: false,
      iosIsEncryption: false,
    },
  },
};

export default config;
