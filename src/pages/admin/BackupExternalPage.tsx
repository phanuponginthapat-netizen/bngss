import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RefreshCw, Copy, FolderOpen, FileSpreadsheet, Search, ExternalLink,
  ShieldCheck, Cloud, Save, Code2, Sparkles,
} from "lucide-react";

const GAS_CODE = String.raw`/**
 * Lovable School — Google Drive / Sheets Backup Web App
 * Deploy: Apps Script → "ปรับใช้" → ปรับใช้เป็นเว็บแอป
 *   - ดำเนินการในนาม: ฉัน
 *   - เข้าถึงโดย: ทุกคน (Anyone)
 * จากนั้นคัดลอก URL ไปวางในระบบ และตั้งค่า Script Properties:
 *   SHARED_SECRET   = (ค่าลับเดียวกับในระบบ)
 *   ROOT_FOLDER_ID  = ID ของโฟลเดอร์ Drive ที่ใช้เก็บไฟล์
 *   SHEET_ID        = ID ของ Google Sheet ที่ใช้บันทึกข้อมูล
 */

function P(k){ return PropertiesService.getScriptProperties().getProperty(k); }
function out(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e){
  try{
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== P('SHARED_SECRET')) return out({error:'unauthorized'});
    if (body.op === 'backup') return out(doBackup(body));
    if (body.op === 'upload_file') return out(doUploadFile(body));
    return out({error:'unknown op'});
  } catch(err){ return out({error:String(err)}); }
}

function doGet(e){
  if (e.parameter.secret !== P('SHARED_SECRET')) return out({error:'unauthorized'});
  const op = e.parameter.op || 'row';
  if (op === 'row')  return out(lookupRow(e.parameter.table, e.parameter.id));
  if (op === 'file') return out(lookupFile(e.parameter.table, e.parameter.id));
  if (op === 'ping') return out({ok:true, time:new Date().toISOString()});
  return out({error:'unknown op'});
}

/* ───── Backup: write every table to its own sheet tab + JSON snapshot in Drive ───── */
function doBackup(body){
  const ss = SpreadsheetApp.openById(P('SHEET_ID'));
  const root = DriveApp.getFolderById(P('ROOT_FOLDER_ID'));
  const dateFolder = getOrCreate(root, Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd'));
  const summary = [];

  for (const table of Object.keys(body.tables || {})){
    const rows = body.tables[table] || [];
    // 1) Sheet tab — pretty header, frozen, auto-sized
    let sh = ss.getSheetByName(table) || ss.insertSheet(table);
    sh.clear();
    if (rows.length){
      const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
      sh.getRange(1,1,1,headers.length).setValues([headers])
        .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      sh.setFrozenRows(1);
      const data = rows.map(r => headers.map(h => fmt(r[h])));
      sh.getRange(2,1,data.length,headers.length).setValues(data);
      sh.setColumnWidths(1, headers.length, 160);
      sh.getRange(2,1,data.length,headers.length).setVerticalAlignment('middle').setWrap(true);
      // freeze id column if exists
      const idIdx = headers.indexOf('id');
      if (idIdx === 0) sh.setFrozenColumns(1);
      try { sh.autoResizeColumns(1, Math.min(headers.length, 12)); } catch(_){}
    }
    // 2) JSON snapshot in topic folder under today's folder
    const topic = getOrCreate(dateFolder, table);
    topic.createFile(table + '.json', JSON.stringify(rows, null, 2), 'application/json');
    summary.push({table, rows: rows.length});
  }
  // Index "_meta" tab
  let meta = ss.getSheetByName('_meta') || ss.insertSheet('_meta');
  meta.clear();
  meta.getRange(1,1,1,3).setValues([['table','rows','last_backup']])
      .setFontWeight('bold').setBackground('#0f766e').setFontColor('#fff');
  meta.setFrozenRows(1);
  if (summary.length) meta.getRange(2,1,summary.length,3).setValues(
    summary.map(s => [s.table, s.rows, new Date()])
  );
  return {ok:true, summary, snapshot_folder: dateFolder.getUrl()};
}

/* ───── File upload (from system) → Drive folder per table + index in _files_index ───── */
function doUploadFile(body){
  const root = DriveApp.getFolderById(P('ROOT_FOLDER_ID'));
  const tableFolder = getOrCreate(getOrCreate(root, '_files'), body.table);
  const bytes = Utilities.base64Decode(body.base64);
  const blob = Utilities.newBlob(bytes, body.mime || 'application/octet-stream', body.name || 'file');
  const file = tableFolder.createFile(blob);
  indexFile(body.table, body.record_id, file, body.name, body.mime);
  return {ok:true, file_id: file.getId(), view_url: file.getUrl()};
}

function indexFile(table, recordId, file, name, mime){
  const ss = SpreadsheetApp.openById(P('SHEET_ID'));
  let sh = ss.getSheetByName('_files_index');
  if (!sh){
    sh = ss.insertSheet('_files_index');
    sh.getRange(1,1,1,8).setValues([['key','table','record_id','file_id','view_url','download_url','name','mime']])
      .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#fff');
    sh.setFrozenRows(1);
  }
  sh.appendRow([
    table + '::' + recordId, table, recordId, file.getId(),
    file.getUrl(),
    'https://drive.google.com/uc?export=download&id=' + file.getId(),
    name || file.getName(), mime || file.getMimeType(),
  ]);
}

/* ───── Direct lookup (fast) — uses TextFinder, no full scan ───── */
function lookupRow(table, id){
  const ss = SpreadsheetApp.openById(P('SHEET_ID'));
  const sh = ss.getSheetByName(table);
  if (!sh) return {found:false, reason:'sheet not found'};
  const idCol = findIdColumn(sh);
  if (!idCol) return {found:false, reason:'id column missing'};
  const range = sh.getRange(2, idCol, Math.max(sh.getLastRow()-1, 1), 1);
  const cell = range.createTextFinder(id).matchEntireCell(true).findNext();
  if (!cell) return {found:false};
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const values = sh.getRange(cell.getRow(),1,1,headers.length).getValues()[0];
  const row = {}; headers.forEach((h,i)=> row[h]=values[i]);
  return {found:true, row};
}

function lookupFile(table, id){
  const ss = SpreadsheetApp.openById(P('SHEET_ID'));
  const sh = ss.getSheetByName('_files_index');
  if (!sh) return {found:false};
  const cell = sh.getRange(2,1,Math.max(sh.getLastRow()-1,1),1)
    .createTextFinder(table + '::' + id).matchEntireCell(true).findNext();
  if (!cell) return {found:false};
  const v = sh.getRange(cell.getRow(),1,1,8).getValues()[0];
  return {found:true, table:v[1], record_id:v[2], file_id:v[3], view_url:v[4], download_url:v[5], name:v[6], mime:v[7]};
}

/* helpers */
function getOrCreate(parent, name){
  let cur = parent;
  for (const part of String(name).split('/').filter(Boolean)){
    const it = cur.getFoldersByName(part);
    cur = it.hasNext() ? it.next() : cur.createFolder(part);
  }
  return cur;
}
function findIdColumn(sh){
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const i = headers.indexOf('id');
  return i >= 0 ? i+1 : 0;
}
function fmt(v){
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}
`;

const CFG_KEYS = ["gas_webapp_url", "gas_shared_secret", "gas_drive_folder_url", "gas_sheet_url"] as const;
type CfgKey = typeof CFG_KEYS[number];

export default function BackupExternalPage() {
  const [cfg, setCfg] = useState<Record<CfgKey, string>>({
    gas_webapp_url: "", gas_shared_secret: "", gas_drive_folder_url: "", gas_sheet_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<any>(null);
  const [lkTable, setLkTable] = useState("students");
  const [lkId, setLkId] = useState("");
  const [lkResult, setLkResult] = useState<any>(null);
  const [lkBusy, setLkBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("school_settings")
      .select("setting_key,setting_value")
      .in("setting_key", [...CFG_KEYS, "last_gdrive_backup"]);
    const map: any = {};
    (data || []).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
    setCfg({
      gas_webapp_url: map.gas_webapp_url || "",
      gas_shared_secret: map.gas_shared_secret || "",
      gas_drive_folder_url: map.gas_drive_folder_url || "",
      gas_sheet_url: map.gas_sheet_url || "",
    });
    if (map.last_gdrive_backup) { try { setLast(JSON.parse(map.last_gdrive_backup)); } catch {} }
  };
  useEffect(() => { load(); }, []);

  const saveCfg = async () => {
    setSaving(true);
    try {
      const rows = CFG_KEYS.map((k) => ({ setting_key: k, setting_value: cfg[k] || "" }));
      const { error } = await supabase.from("school_settings").upsert(rows, { onConflict: "setting_key" });
      if (error) throw error;
      toast.success("บันทึกการตั้งค่าแล้ว");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const runBackup = async () => {
    if (!cfg.gas_webapp_url || !cfg.gas_shared_secret) return toast.error("ใส่ Web App URL และ Shared Secret ก่อน");
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-backup", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const ok = (data as any).summary?.filter((s: any) => s.ok).length || 0;
      toast.success(`สำรองสำเร็จ ${ok} ตาราง → Google Sheets + Drive`);
      load();
    } catch (e: any) { toast.error(`ล้มเหลว: ${e.message}`); }
    finally { setRunning(false); }
  };

  const lookup = async (op: "row" | "file") => {
    if (!lkTable || !lkId) return toast.error("ใส่ตารางและ ID");
    setLkBusy(true); setLkResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdrive-lookup?op=${op}&table=${encodeURIComponent(lkTable)}&id=${encodeURIComponent(lkId)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setLkResult(j);
      if (op === "file" && j.found && j.view_url) {
        window.open(j.view_url, "_blank");
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setLkBusy(false); }
  };

  const copyGas = () => { navigator.clipboard.writeText(GAS_CODE); toast.success("คัดลอกโค้ด GAS แล้ว"); };

  const isConfigured = useMemo(() => !!cfg.gas_webapp_url && !!cfg.gas_shared_secret, [cfg]);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-info/10 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Cloud className="h-6 w-6 text-primary" /> สำรองข้อมูล → Google Drive / Sheets
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
              สำรองข้อมูลทุกตารางหลักของระบบไปยัง <b>Google Sheets</b> (แยกชีตต่อหัวข้อ + จัดคอลัมน์สวยงาม)
              และ <b>Google Drive</b> (แยกโฟลเดอร์ตามวันที่/หัวข้อ) — แม้ระบบจะลบข้อมูลหลัง 3 ปี ไฟล์ใน Drive ยังอยู่ครบ
            </p>
          </div>
          <Badge variant={isConfigured ? "default" : "secondary"} className="gap-1 h-7">
            <Sparkles className="h-3.5 w-3.5" /> {isConfigured ? "พร้อมใช้งาน" : "ยังไม่ได้ตั้งค่า"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="settings"><ShieldCheck className="h-4 w-4 mr-1" /> ตั้งค่า</TabsTrigger>
          <TabsTrigger value="run"><RefreshCw className="h-4 w-4 mr-1" /> สำรองข้อมูล</TabsTrigger>
          <TabsTrigger value="lookup"><Search className="h-4 w-4 mr-1" /> เปิดไฟล์/ดึงข้อมูล</TabsTrigger>
          <TabsTrigger value="gas"><Code2 className="h-4 w-4 mr-1" /> โค้ด GAS</TabsTrigger>
        </TabsList>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>วิธีตั้งค่า (ครั้งเดียว)</AlertTitle>
            <AlertDescription className="text-xs space-y-1 leading-relaxed">
              1. สร้าง <b>โฟลเดอร์ Drive</b> และ <b>Google Sheet</b> เปล่าๆ สำหรับเก็บข้อมูล<br />
              2. เปิดแท็บ <b>"โค้ด GAS"</b> → คัดลอกโค้ดทั้งหมด → วางใน script.google.com (สร้าง New Project)<br />
              3. ใน Apps Script → <b>Project Settings → Script Properties</b> ใส่ค่า <code>SHARED_SECRET</code>, <code>ROOT_FOLDER_ID</code>, <code>SHEET_ID</code><br />
              4. <b>ปรับใช้ (Deploy) → Web App</b> (Execute as: ฉัน · Access: Anyone) → คัดลอก URL<br />
              5. นำ URL + Secret + ลิงก์โฟลเดอร์ + ลิงก์ชีต มาใส่ในฟอร์มด้านล่าง
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader><CardTitle className="text-base">ลิงก์และข้อมูลเชื่อมต่อ</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">GAS Web App URL</Label>
                <Input value={cfg.gas_webapp_url} onChange={(e) => setCfg({ ...cfg, gas_webapp_url: e.target.value })}
                  placeholder="https://script.google.com/macros/s/AKfy.../exec" className="font-mono text-xs" />
              </div>
              <div>
                <Label className="text-xs">Shared Secret (ค่าเดียวกับใน Script Properties)</Label>
                <Input type="password" value={cfg.gas_shared_secret} onChange={(e) => setCfg({ ...cfg, gas_shared_secret: e.target.value })}
                  placeholder="•••••••••••••••" className="font-mono text-xs" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><FolderOpen className="h-3 w-3" /> ลิงก์โฟลเดอร์ Drive</Label>
                  <Input value={cfg.gas_drive_folder_url} onChange={(e) => setCfg({ ...cfg, gas_drive_folder_url: e.target.value })}
                    placeholder="https://drive.google.com/drive/folders/..." className="font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><FileSpreadsheet className="h-3 w-3" /> ลิงก์ Google Sheet</Label>
                  <Input value={cfg.gas_sheet_url} onChange={(e) => setCfg({ ...cfg, gas_sheet_url: e.target.value })}
                    placeholder="https://docs.google.com/spreadsheets/d/..." className="font-mono text-xs" />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={saveCfg} disabled={saving} className="gap-1">
                  <Save className="h-4 w-4" /> {saving ? "กำลังบันทึก…" : "บันทึก"}
                </Button>
                {cfg.gas_drive_folder_url && (
                  <Button variant="outline" asChild><a href={cfg.gas_drive_folder_url} target="_blank" rel="noreferrer"><FolderOpen className="h-4 w-4 mr-1" /> เปิดโฟลเดอร์</a></Button>
                )}
                {cfg.gas_sheet_url && (
                  <Button variant="outline" asChild><a href={cfg.gas_sheet_url} target="_blank" rel="noreferrer"><FileSpreadsheet className="h-4 w-4 mr-1" /> เปิดชีต</a></Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RUN */}
        <TabsContent value="run" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">สำรองข้อมูลทันที</CardTitle>
              <CardDescription>เขียนข้อมูลทุกตารางหลักลง Google Sheets + เก็บ JSON snapshot ใน Drive แยกตามวันที่/หัวข้อ</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={runBackup} disabled={running || !isConfigured} size="lg" className="gap-2">
                <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
                {running ? "กำลังสำรอง…" : "เริ่มสำรองข้อมูลตอนนี้"}
              </Button>
              {!isConfigured && <p className="text-xs text-warning mt-2">⚠️ ตั้งค่า URL + Secret ก่อน</p>}
            </CardContent>
          </Card>

          {last && (
            <Card>
              <CardHeader><CardTitle className="text-base">สำรองครั้งล่าสุด</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap text-sm">
                  <Badge variant="outline">เวลา: {last.ran_at && new Date(last.ran_at).toLocaleString("th-TH")}</Badge>
                  <Badge className="bg-success">สำเร็จ {last.ok ?? 0}</Badge>
                  {last.failed > 0 && <Badge variant="destructive">ล้มเหลว {last.failed}</Badge>}
                  {last.gas_summary && <Badge variant="secondary">GAS เขียน {last.gas_summary.length} ชีต</Badge>}
                </div>
                <div className="border rounded divide-y max-h-80 overflow-y-auto text-sm">
                  {(last.results ?? []).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5">
                      <span className="font-mono text-xs">{r.table}</span>
                      {r.ok ? <span className="text-success text-xs">{r.rows} แถว ✓</span>
                            : <span className="text-destructive text-xs truncate max-w-[260px]">{r.error}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* LOOKUP */}
        <TabsContent value="lookup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ดึงข้อมูล / เปิดไฟล์โดยตรง</CardTitle>
              <CardDescription>
                ดึงข้อมูลแถวเดียวจาก Sheet โดยใช้ <b>TextFinder</b> (ค้นหาตรงไม่ scan ทั้งชีต) — เร็วมากแม้ข้อมูลเป็นหมื่นแถว
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <div><Label className="text-xs">ตาราง</Label>
                  <Input value={lkTable} onChange={(e) => setLkTable(e.target.value)} placeholder="students" className="font-mono text-xs" /></div>
                <div><Label className="text-xs">ID</Label>
                  <Input value={lkId} onChange={(e) => setLkId(e.target.value)} placeholder="uuid…" className="font-mono text-xs" /></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => lookup("row")} disabled={lkBusy || !isConfigured} className="gap-1">
                  <Search className="h-4 w-4" /> ดึงข้อมูลจาก Sheet
                </Button>
                <Button onClick={() => lookup("file")} disabled={lkBusy || !isConfigured} variant="outline" className="gap-1">
                  <ExternalLink className="h-4 w-4" /> เปิดไฟล์จาก Drive
                </Button>
              </div>
              {lkResult && (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                  {!lkResult.found ? (
                    <p className="text-muted-foreground">ไม่พบข้อมูล: {lkResult.reason || "—"}</p>
                  ) : lkResult.view_url ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2"><Badge>{lkResult.mime}</Badge><span className="font-mono">{lkResult.name}</span></div>
                      <a href={lkResult.view_url} target="_blank" rel="noreferrer" className="text-primary underline flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> เปิดใน Drive
                      </a>
                    </div>
                  ) : (
                    <pre className="overflow-auto max-h-80">{JSON.stringify(lkResult.row, null, 2)}</pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GAS CODE */}
        <TabsContent value="gas" className="space-y-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4" /> โค้ด Google Apps Script</CardTitle>
                  <CardDescription>คัดลอกทั้งหมด → วางที่ <a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline">script.google.com</a> → Deploy เป็น Web App</CardDescription>
                </div>
                <Button onClick={copyGas} className="gap-1"><Copy className="h-4 w-4" /> คัดลอกโค้ดทั้งหมด</Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted rounded-lg p-3 text-[11px] leading-relaxed overflow-auto max-h-[60vh] font-mono">{GAS_CODE}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
