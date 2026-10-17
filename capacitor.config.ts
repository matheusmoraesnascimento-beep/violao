import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.violao.app',
  appName: 'Violão',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  backgroundColor: '#14161a',
};

export default config;
