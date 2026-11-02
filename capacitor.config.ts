import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bngss.app',
  appName: 'BNG Smart',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    // ปิดโหมดดีบักในแอปจริง (เร็วขึ้นและปลอดภัยขึ้น)
    webContentsDebuggingEnabled: false,
    backgroundColor: '#ffffff',
  },
  plugins: {
    Camera: {
      // ขอสิทธิ์กล้อง/รูปภาพในแอปเนทีฟ
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;