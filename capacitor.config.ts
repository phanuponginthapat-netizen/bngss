import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f656e9197df7479f8f52d6572399e1b5',
  appName: 'bngss',
  webDir: 'dist',
  server: {
    url: 'https://f656e919-7df7-479f-8f52-d6572399e1b5.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    Camera: {
      // ขอสิทธิ์กล้อง/รูปภาพในแอปเนทีฟ
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;
