import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d0e75e0b45764e84bd7ec0a5d429662a',
  appName: 'chearavanont2school',
  webDir: 'dist',
  server: {
    url: 'https://d0e75e0b-4576-4e84-bd7e-c0a5d429662a.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
