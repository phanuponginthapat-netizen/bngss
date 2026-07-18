import JSZip from "jszip";
import { Archive } from "libarchive.js";
// @ts-ignore - vite raw url import
import libarchiveWorkerUrl from "libarchive.js/dist/worker-bundle.js?url";
import { supabase } from "@/integrations/supabase/client";

let _libarchiveReady = false;
function ensureLibarchive() {
  if (_libarchiveReady) return;
  Archive.init({ workerUrl: libarchiveWorkerUrl });
  _libarchiveReady = true;
}


const BUCKET = "learning-content";
const MAX_ZIP_BYTES = 100 * 1024 * 1024; // 100 MB
const BLOCKED_EXT = new Set([
  "exe","bat","cmd","sh","php","jsp","asp","aspx","py","rb","pl","cgi","dll","so","msi",
]);

const ALLOWED_EXT = new Set([
  "html","htm","js","mjs","css","json","xml","txt","map","wasm",
  "png","jpg","jpeg","gif","webp","svg","ico","bmp",
  "mp3","ogg","wav","m4a","flac",
  "mp4","webm","mov",
  "pdf",
  "ttf","otf","woff","woff2",
  "csv","yml","yaml","md",
]);

function safeName(name: string) {
  // strip leading slashes and unsafe chars; preserve subfolder structure
  return name.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\.\//g, "");
}

function extOf(p: string) { return (p.split(".").pop() || "").toLowerCase(); }

/**
 * อัปไฟล์ HTML เดี่ยว — เก็บที่ {contentId}/index.html
 */
export async function uploadSingleHtml(contentId: string, file: File) {
  if (!/\.html?$/i.test(file.name)) throw new Error("ต้องเป็นไฟล์ .html");
  if (file.size > 25 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 25 MB");
  const path = `${contentId}/index.html`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: "text/html",
  });
  if (error) throw error;
  return { path: contentId, entryFile: "index.html", size: file.size };
}

/**
 * อัปไฟล์ PDF — เก็บที่ {contentId}/document.pdf
 */
export async function uploadPdf(contentId: string, file: File) {
  if (!/\.pdf$/i.test(file.name)) throw new Error("ต้องเป็นไฟล์ .pdf");
  if (file.size > 50 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 50 MB");
  const path = `${contentId}/document.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw error;
  return { path: contentId, entryFile: "document.pdf", size: file.size };
}

/**
 * อัปไฟล์ Flash .swf — ห่อด้วย Ruffle (HTML5) ให้เล่นได้บนเว็บ
 * เก็บที่ {contentId}/index.html (Ruffle loader) + {contentId}/game.swf
 */
export async function uploadSwfAsRuffle(contentId: string, file: File) {
  if (!/\.swf$/i.test(file.name)) throw new Error("ต้องเป็นไฟล์ .swf");
  if (file.size > 50 * 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 50 MB");

  const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Flash Player</title>
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:sans-serif;color:#fff}
  #wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
  #player{width:100%;height:100%}
  .loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);opacity:.6}
</style>
</head>
<body>
<div id="wrap"><div id="player"></div></div>
<div class="loading" id="loading">กำลังโหลด Flash Player...</div>
<script src="https://unpkg.com/@ruffle-rs/ruffle"></script>
<script>
  window.RufflePlayer = window.RufflePlayer || {};
  window.addEventListener('load', function () {
    var ruffle = window.RufflePlayer.newest();
    var player = ruffle.createPlayer();
    var container = document.getElementById('player');
    container.appendChild(player);
    player.style.width = '100%';
    player.style.height = '100%';
    player.load({
      url: './game.swf',
      autoplay: 'on',
      unmuteOverlay: 'visible',
      letterbox: 'on',
      scale: 'showAll',
      quality: 'high',
      contextMenu: 'off'
    }).then(function(){
      var l = document.getElementById('loading');
      if (l) l.remove();
    }).catch(function(err){
      document.getElementById('loading').textContent = 'โหลดไม่สำเร็จ: ' + err;
    });
  });
</script>
</body>
</html>`;

  const htmlPath = `${contentId}/index.html`;
  const swfPath = `${contentId}/game.swf`;

  const { error: htmlErr } = await supabase.storage.from(BUCKET).upload(htmlPath, new Blob([html], { type: "text/html" }), {
    upsert: true, contentType: "text/html",
  });
  if (htmlErr) throw htmlErr;

  const { error: swfErr } = await supabase.storage.from(BUCKET).upload(swfPath, file, {
    upsert: true, contentType: "application/x-shockwave-flash",
  });
  if (swfErr) throw swfErr;

  return { path: contentId, entryFile: "index.html", size: file.size };
}

/**
 * แตก ZIP แล้วอัปแต่ละไฟล์ขึ้น storage ภายใต้ {contentId}/...
 * คืนค่า entry file (มักเป็น index.html)
 */
export async function uploadZipPackage(
  contentId: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
) {
  return uploadArchivePackage(contentId, file, onProgress);
}

const ARCHIVE_EXT_RE = /\.(zip|rar|7z|tar|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz)$/i;

/**
 * อัปไฟล์ archive (zip / rar / 7z / tar / tar.gz / tar.bz2 / tar.xz)
 * - .zip ใช้ JSZip (เร็ว, ไม่ต้องโหลด wasm)
 * - format อื่นๆ ใช้ libarchive.js (WASM worker)
 */
export async function uploadArchivePackage(
  contentId: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
) {
  if (file.size > MAX_ZIP_BYTES) throw new Error("ไฟล์ใหญ่เกิน 100 MB");
  if (!ARCHIVE_EXT_RE.test(file.name)) {
    throw new Error("รองรับเฉพาะ .zip / .rar / .7z / .tar / .tar.gz / .tar.bz2 / .tar.xz");
  }

  // ดึง entries ออกมาเป็น { path, getBlob } ก่อน เพื่อจัดการรวมกัน
  type Entry = { path: string; size: number; getBlob: () => Promise<Blob> };
  let rawEntries: Entry[] = [];

  if (/\.zip$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(file);
    rawEntries = Object.values(zip.files)
      .filter(e => !e.dir)
      .map(e => ({
        path: safeName(e.name),
        size: (e as any)._data?.uncompressedSize || 0,
        getBlob: () => e.async("blob"),
      }));
  } else {
    ensureLibarchive();
    const archive = await Archive.open(file);
    try {
      const list = await archive.getFilesArray();
      rawEntries = list.map((item: any) => {
        const fullPath = safeName(item.path ? `${item.path}${item.file.name}` : item.file.name);
        return {
          path: fullPath,
          size: item.file.size || 0,
          getBlob: async () => {
            // item.file เป็น File-like; ถ้ายังไม่ extract → extract แบบ on-demand
            if (typeof item.file.extract === "function") {
              const f: File = await item.file.extract();
              return f;
            }
            return item.file as File;
          },
        };
      });
    } finally {
      // libarchive.js ไม่มี close API จริง ปล่อย GC
    }
  }

  if (rawEntries.length === 0) throw new Error("ไฟล์ archive ว่างเปล่า");

  const allPaths = rawEntries.map(e => e.path);

  // 1) ลองหา index.html ที่ root
  let entryFile = allPaths.find(p => /^index\.html?$/i.test(p));
  let stripPrefix = "";
  // 2) ถ้าไม่มี ลองหาในโฟลเดอร์ root เดียว
  if (!entryFile) {
    const rootDirs = new Set(allPaths.map(p => p.split("/")[0]));
    if (rootDirs.size === 1) {
      const prefix = [...rootDirs][0] + "/";
      const candidate = allPaths.find(p => p === `${prefix}index.html` || p === `${prefix}index.htm`);
      if (candidate) { entryFile = "index.html"; stripPrefix = prefix; }
    }
  }
  // 3) ถ้ายังไม่มี เอา html ตัวแรกที่เจอ
  if (!entryFile) {
    const firstHtml = allPaths.find(p => /\.html?$/i.test(p));
    if (!firstHtml) throw new Error("ไม่พบไฟล์ .html ใน archive — ต้องมี index.html");
    entryFile = firstHtml;
  }

  // ตรวจไฟล์ blocked
  for (const p of allPaths) {
    if (BLOCKED_EXT.has(extOf(p))) throw new Error(`พบไฟล์ที่ไม่อนุญาต: ${p}`);
  }

  let totalSize = rawEntries.reduce((s, e) => s + e.size, 0) || 1;
  let uploadedSize = 0;

  for (const entry of rawEntries) {
    const rawPath = entry.path;
    if (stripPrefix && !rawPath.startsWith(stripPrefix)) continue;
    const relPath = stripPrefix ? rawPath.slice(stripPrefix.length) : rawPath;
    if (!relPath) continue;
    const ext = extOf(relPath);
    if (BLOCKED_EXT.has(ext)) continue;
    if (ext && !ALLOWED_EXT.has(ext)) continue;

    const blob = await entry.getBlob();
    const fullPath = `${contentId}/${relPath}`;
    const { error } = await supabase.storage.from(BUCKET).upload(fullPath, blob, { upsert: true });
    if (error) throw new Error(`อัป ${relPath} ล้มเหลว: ${error.message}`);

    uploadedSize += blob.size;
    onProgress?.(uploadedSize, totalSize);
  }

  return { path: contentId, entryFile, size: totalSize };
}


/**
 * ลบทั้งโฟลเดอร์ของ content (recursive)
 */
export async function deleteContentFiles(contentId: string) {
  const { data: list } = await supabase.storage.from(BUCKET).list(contentId, { limit: 1000 });
  if (!list || list.length === 0) return;
  const paths: string[] = [];
  for (const item of list) {
    if ((item as any).id) paths.push(`${contentId}/${item.name}`);
    // recurse 1 ระดับ
    const { data: sub } = await supabase.storage.from(BUCKET).list(`${contentId}/${item.name}`, { limit: 1000 });
    if (sub && sub.length > 0) {
      for (const s of sub) paths.push(`${contentId}/${item.name}/${s.name}`);
    }
  }
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
}
