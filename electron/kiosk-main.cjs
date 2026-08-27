/**
 * Electron kiosk wrapper สำหรับ Kiosk Door (HP Pavilion x2 / เครื่องสเปกเบา)
 *
 * ทำไมต้องห่อด้วย Electron:
 *  - บังคับใส่ header COOP/COEP ให้ทุก response → เว็บได้ `crossOriginIsolated === true`
 *    ซึ่งปลดล็อก SharedArrayBuffer → WASM หลายเธรด (face-api / onnxruntime)
 *    บน Chromium kiosk ธรรมดาถูกบังคับเหลือ 1 เธรด ทำให้สแกนช้ากว่า ~30–50%
 *  - เปิดสิทธิ์กล้อง/ไมค์อัตโนมัติ ไม่มี prompt, ไม่มี UI เบราว์เซอร์
 *  - รีโหลดเองเมื่อ renderer ตาย และล็อกเป็น fullscreen kiosk จริง
 *
 * รัน:  KIOSK_URL="https://bngss.lovable.app/kiosk/door" electron electron/kiosk-main.cjs
 */
const { app, BrowserWindow, session, screen } = require("electron");

const KIOSK_URL = process.env.KIOSK_URL || "https://bngss.lovable.app/kiosk/door";
const ALLOW_DEVTOOLS = process.env.KIOSK_DEVTOOLS === "1";

// ── GPU / WASM flags — ช่วยให้ iGPU (Intel) ทำงานเต็มที่บนเครื่องสเปกเบา ──
app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer,WebAssemblyThreads,Vulkan,CanvasOopRasterization");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("use-gl", "desktop");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-features", "AudioServiceOutOfProcess");
// ให้ใช้กล้อง/ไมค์ได้โดยไม่ถาม
app.commandLine.appendSwitch("use-fake-ui-for-media-stream");

/** ใส่ COOP/COEP ให้ทุก response — จุดสำคัญที่ทำให้ crossOriginIsolated ทำงาน */
function applyIsolationHeaders(ses) {
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    headers["Cross-Origin-Opener-Policy"] = ["same-origin"];
    // credentialless: โหลด asset ข้ามโดเมน (CDN โมเดล/ฟอนต์) ได้โดยไม่ต้องมี CORP
    headers["Cross-Origin-Embedder-Policy"] = ["credentialless"];
    headers["Cross-Origin-Resource-Policy"] = ["cross-origin"];
    callback({ responseHeaders: headers });
  });

  // อนุญาตกล้อง/ไมค์/เสียง/fullscreen อัตโนมัติ
  ses.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(["media", "audioCapture", "videoCapture", "fullscreen", "clipboard-read", "notifications"].includes(permission));
  });
  ses.setPermissionCheckHandler(() => true);
}

let win = null;

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  win = new BrowserWindow({
    width,
    height,
    kiosk: !ALLOW_DEVTOOLS,
    fullscreen: !ALLOW_DEVTOOLS,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b1120",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      // จำเป็นสำหรับ SharedArrayBuffer ในหน้า renderer
      webSecurity: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL(KIOSK_URL);

  // renderer ตาย (OOM/crash) → โหลดใหม่ทันที ไม่ปล่อยให้จอค้าง
  win.webContents.on("render-process-gone", () => {
    setTimeout(() => win && !win.isDestroyed() && win.reload(), 2000);
  });
  win.webContents.on("did-fail-load", (_e, code) => {
    if (code === -3) return; // aborted
    setTimeout(() => win && !win.isDestroyed() && win.loadURL(KIOSK_URL), 5000);
  });

  if (ALLOW_DEVTOOLS) win.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(() => {
  applyIsolationHeaders(session.defaultSession);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());
