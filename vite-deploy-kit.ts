// สร้าง deploy-kit.json = โค้ด edge functions + ไฟล์ migration ทั้งหมด
// ใช้ให้ Full Backup แนบ RLS/Schema migration + edge functions ไปด้วย
// เข้าถึงได้ที่ /deploy-kit.json ทั้งตอน dev และหลัง build
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

function readDir(dir: string, exts: string[], root: string, out: Record<string, string>) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readDir(full, exts, root, out);
    else if (exts.some((e) => entry.name.endsWith(e))) {
      out[path.relative(root, full).split(path.sep).join("/")] = fs.readFileSync(full, "utf8");
    }
  }
}

export function buildDeployKit(root: string) {
  const functions: Record<string, string> = {};
  const migrations: Record<string, string> = {};
  readDir(path.join(root, "supabase/functions"), [".ts", ".json", ".toml"], path.join(root, "supabase/functions"), functions);
  readDir(path.join(root, "supabase/migrations"), [".sql"], path.join(root, "supabase/migrations"), migrations);
  let config = "";
  try {
    config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
  } catch {
    /* optional */
  }
  return {
    generated_at: new Date().toISOString(),
    counts: { functions: Object.keys(functions).length, migrations: Object.keys(migrations).length },
    config_toml: config,
    functions,
    migrations,
  };
}

export function deployKitPlugin(): Plugin {
  const root = process.cwd();
  return {
    name: "bng-deploy-kit",
    configureServer(server) {
      server.middlewares.use("/deploy-kit.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(buildDeployKit(root)));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "deploy-kit.json",
        source: JSON.stringify(buildDeployKit(root)),
      });
    },
  };
}
