import rawScript from "@/../scripts/kiosk/setup-mxlinux-kiosk.sh?raw";
import rawUninstall from "@/../scripts/kiosk/uninstall-mxlinux-kiosk.sh?raw";

export type KioskMode = "door" | "student";

export interface KioskScriptConfig {
  mode: KioskMode;
  kioskUrl: string;
  kioskUser?: string;
  wifiSsid?: string;
  wifiPass?: string;
  dailyReboot?: string;         // "HH:MM" or ""
  idleLogoutMin?: number;       // student: 0 = off
  idleShutdownMin?: number;     // student: shutdown after N min idle (0 = off)
  powerOn?: string;             // "HH:MM" BIOS RTC wake (empty = off)
  powerOff?: string;            // "HH:MM" scheduled shutdown (empty = off)
  battCritical?: number;         // % ต่ำสุดก่อน shutdown ปลอดภัย (0 = ปิด)
  battChargeMax?: number;        // จำกัดชาร์จสูงสุด % (0 = ไม่จำกัด)
  monitorAgentUrl?: string;
  schoolName?: string;
}

/**
 * แทรก config ของโรงเรียนลงในสคริปต์ setup MX Linux Kiosk
 * — replace ค่า default ที่บรรทัด `KIOSK_URL="${KIOSK_URL:-...}"` ให้เป็นค่าจริง
 * — ทำให้ผู้ใช้แค่รัน `sudo bash setup-*.sh` ได้เลย ไม่ต้องส่ง env var
 */
export function generateKioskSetupScript(cfg: KioskScriptConfig): string {
  const banner = [
    "# ============================================================",
    `# สร้างจาก CMS: ${cfg.schoolName || "โรงเรียน"}`,
    `# โหมด: ${cfg.mode === "student" ? "student (คอมพิวเตอร์นักเรียน)" : "door (ตู้สแกนหน้าประตู HP Pavilion x2)"}`,
    `# วันที่: ${new Date().toISOString()}`,
    `# URL: ${cfg.kioskUrl}`,
    "# ============================================================",
    "",
  ].join("\n");

  let out = rawScript;

  // MODE
  out = out.replace(
    /KIOSK_MODE="\$\{KIOSK_MODE:-[^"}]*\}"/,
    `KIOSK_MODE="\${KIOSK_MODE:-${escape(cfg.mode)}}"`,
  );

  // แทนที่ค่า default ในบรรทัด env (KIOSK_URL/DAILY_REBOOT ปรากฏ 2 ครั้งใน branch door/student → ใช้ /g)
  out = out.replace(
    /KIOSK_URL="\$\{KIOSK_URL:-[^"]*\}"/g,
    `KIOSK_URL="\${KIOSK_URL:-${escape(cfg.kioskUrl)}}"`,
  );
  if (cfg.kioskUser) {
    out = out.replace(
      /KIOSK_USER="\$\{KIOSK_USER:-[^"]*\}"/,
      `KIOSK_USER="\${KIOSK_USER:-${escape(cfg.kioskUser)}}"`,
    );
  }
  if (cfg.wifiSsid !== undefined) {
    out = out.replace(
      /KIOSK_WIFI_SSID="\$\{KIOSK_WIFI_SSID:-[^"]*\}"/,
      `KIOSK_WIFI_SSID="\${KIOSK_WIFI_SSID:-${escape(cfg.wifiSsid)}}"`,
    );
  }
  if (cfg.wifiPass !== undefined) {
    out = out.replace(
      /KIOSK_WIFI_PASS="\$\{KIOSK_WIFI_PASS:-[^"]*\}"/,
      `KIOSK_WIFI_PASS="\${KIOSK_WIFI_PASS:-${escape(cfg.wifiPass)}}"`,
    );
  }
  if (cfg.dailyReboot !== undefined) {
    out = out.replace(
      /KIOSK_DAILY_REBOOT="\$\{KIOSK_DAILY_REBOOT:-[^"]*\}"/g,
      `KIOSK_DAILY_REBOOT="\${KIOSK_DAILY_REBOOT:-${escape(cfg.dailyReboot)}}"`,
    );
  }
  if (cfg.idleLogoutMin !== undefined && cfg.mode === "student") {
    out = out.replace(
      /KIOSK_IDLE_LOGOUT_MIN="\$\{KIOSK_IDLE_LOGOUT_MIN:-[^"}]*\}"/,
      `KIOSK_IDLE_LOGOUT_MIN="\${KIOSK_IDLE_LOGOUT_MIN:-${cfg.idleLogoutMin}}"`,
    );
  }
  if (cfg.idleShutdownMin !== undefined && cfg.mode === "student") {
    out = out.replace(
      /KIOSK_IDLE_SHUTDOWN_MIN="\$\{KIOSK_IDLE_SHUTDOWN_MIN:-[^"}]*\}"/,
      `KIOSK_IDLE_SHUTDOWN_MIN="\${KIOSK_IDLE_SHUTDOWN_MIN:-${cfg.idleShutdownMin}}"`,
    );
  }
  if (cfg.powerOn !== undefined) {
    out = out.replace(
      /KIOSK_POWER_ON="\$\{KIOSK_POWER_ON:-[^"]*\}"/g,
      `KIOSK_POWER_ON="\${KIOSK_POWER_ON:-${escape(cfg.powerOn)}}"`,
    );
  }
  if (cfg.powerOff !== undefined) {
    out = out.replace(
      /KIOSK_POWER_OFF="\$\{KIOSK_POWER_OFF:-[^"]*\}"/g,
      `KIOSK_POWER_OFF="\${KIOSK_POWER_OFF:-${escape(cfg.powerOff)}}"`,
    );
  }
  if (cfg.battCritical !== undefined) {
    out = out.replace(
      /KIOSK_BATT_CRITICAL="\$\{KIOSK_BATT_CRITICAL:-[^"}]*\}"/,
      `KIOSK_BATT_CRITICAL="\${KIOSK_BATT_CRITICAL:-${cfg.battCritical}}"`,
    );
  }
  if (cfg.battChargeMax !== undefined) {
    out = out.replace(
      /KIOSK_BATT_CHARGE_MAX="\$\{KIOSK_BATT_CHARGE_MAX:-[^"}]*\}"/,
      `KIOSK_BATT_CHARGE_MAX="\${KIOSK_BATT_CHARGE_MAX:-${cfg.battChargeMax}}"`,
    );
  }
  if (cfg.monitorAgentUrl && cfg.mode === "student") {
    out = out.replace(
      /KIOSK_MONITOR_AGENT_URL="\$\{KIOSK_MONITOR_AGENT_URL:-[^"]*\}"/,
      `KIOSK_MONITOR_AGENT_URL="\${KIOSK_MONITOR_AGENT_URL:-${escape(cfg.monitorAgentUrl)}}"`,
    );
  }

  return banner + out;
}

export function getUninstallScript(): string {
  return rawUninstall;
}

/** escape สำหรับใส่ในสตริง shell double-quoted */
function escape(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`");
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/x-shellscript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
