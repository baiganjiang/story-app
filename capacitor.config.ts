import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aistudio.storyapp',
  appName: 'AI Story Creator',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;