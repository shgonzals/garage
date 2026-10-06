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
    LocalNotifications: {
      // android/app/src/main/res/drawable/ic_stat_garage.xml: el rayo, en blanco (Android lo tiñe).
      smallIcon: 'ic_stat_garage',
      iconColor: '#F5C518',
    },
  },
};

export default config;
