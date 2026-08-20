import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bngss.app',
  appName: 'BNGSS',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  plugins: {
    Camera: {
      // ขอสิทธิ์กล้อง/รูปภาพในแอปเนทีฟ
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;