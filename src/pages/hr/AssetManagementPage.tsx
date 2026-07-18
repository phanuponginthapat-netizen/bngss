import { useState, useMemo, useEffect } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus, Trash2, Package, Image as ImageIcon, AlertTriangle, Camera,
  Search, Filter, TrendingDown, MapPin, User, Edit, Eye, X,
  CheckCircle2, XCircle, Wrench, BarChart3, ArrowUpDown, ScanLine, QrCode, AlertCircle,
  Building2, Printer,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import BarcodeScanner from "@/components/BarcodeScanner";
import AssetQRCode from "@/components/AssetQRCode";
import AssetBulkQRSheet from "@/components/assets/AssetBulkQRSheet";
import MapPicker from "@/components/MapPicker";
import { Link, useNavigate } from "react-router-dom";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { swal } from "@/lib/swal";
import { ASSET_CATEGORIES, ASSET_CATEGORIES_FULL, getCategoryDef, BUDGET_SOURCES } from "@/lib/assetCategories";

const CONDITIONS = [
  { value: "ปกติ", color: "bg-success-soft text-success", icon: CheckCircle2 },
  { value: "ชำรุด", color: "bg-warning-soft text-warning", icon: Wrench },
  { value: "จำหน่าย", color: "bg-danger-soft text-danger", icon: XCircle },
];

const STATUSES = [
  { value: "active", label: "ใช้งาน", color: "bg-success-soft text-success" },
  { value: "maintenance", label: "ซ่อมบำรุง", color: "bg-warning-soft text-warning" },
  { value: "disposed", label: "จำหน่ายแล้ว", color: "bg-danger-soft text-danger" },
];

type SortField = "asset_code" | "asset_name" | "acquisition_cost" | "acquisition_date" | "current_value";
type SortDir = "asc" | "desc";

const emptyForm = () => ({
  asset_code: "", asset_name: "", category: "ครุภัณฑ์สำนักงาน",
  acquisition_cost: "", depreciation_rate: "12.5", location: "",
  responsible_person: "", responsible_user_id: "", condition: "ปกติ", notes: "",
  useful_life_years: "8", acquisition_date: todayBangkok(),
  serial_number: "", barcode: "", quantity: "1",
  building: "", room: "", floor: "",
  latitude: "" as string | "", longitude: "" as string | "",
  gfmis_code: "", budget_source: "เงินอุดหนุนรายหัว", supplier: "", warranty_until: "",
  photos: [] as string[],
});

const AssetManagementPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { role } = useUserRole();
  const canManage = role === "admin" || role === "director";
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [detailAsset, setDetailAsset] = useState<any>(null);
  const [editAsset, setEditAsset] = useState<any>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState("assets");
  const [scannerTarget, setScannerTarget] = useState<"add" | "edit" | null>(null);
  const [qrAsset, setQrAsset] = useState<any | null>(null);
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [lookupScanOpen, setLookupScanOpen] = useState(false);
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortField, setSortField] = useState<SortField>("asset_code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [form, setForm] = useState(emptyForm());

  const [reportAssetId, setReportAssetId] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reporterName, setReporterName] = useState("");

  // S/N validation
  const SN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_/.]{2,49}$/;
  const validateSN = (sn: string): string | null => {
    if (!sn) return null;
    const v = sn.trim();
    if (v.length < 3) return "S/N ต้องมีอย่างน้อย 3 ตัวอักษร";
    if (v.length > 50) return "S/N ต้องไม่เกิน 50 ตัวอักษร";
    if (!SN_PATTERN.test(v)) return "S/N รองรับเฉพาะตัวอักษร/ตัวเลข และ - _ / . เท่านั้น";
    return null;
  };

  const { data: records = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data } = await supabase.from("assets").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel-list", "staff-only"],
    queryFn: async () => {
      // ดึงเฉพาะบุคลากร (admin/director/teacher) ผ่าน security-definer RPC
      // เพราะ RLS ของ user_roles ไม่ให้ผู้ใช้ทั่วไปอ่านของคนอื่น
      const { data, error } = await supabase.rpc("get_staff_profiles");
      if (error) {
        console.error("get_staff_profiles failed", error);
        return [];
      }
      return ((data as any[]) || []).map((p) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        phone: p.phone,
        position: p.position_title,
      }));
    },
  });

  const findDuplicateSN = (sn: string, excludeId?: string) => {
    const v = sn.trim().toLowerCase();
    if (!v) return null;
    return records.find((r: any) =>
      r.id !== excludeId &&
      ((r.serial_number || "").toLowerCase() === v ||
       (r.barcode || "").toLowerCase() === v)
    ) || null;
  };

  const addSnError = validateSN(form.serial_number);
  const addSnDuplicate = !addSnError ? findDuplicateSN(form.serial_number) : null;
  const editSnError = editAsset ? validateSN(editAsset.serial_number || "") : null;
  const editSnDuplicate = editAsset && !editSnError ? findDuplicateSN(editAsset.serial_number || "", editAsset.id) : null;

  const { data: damageReports = [] } = useQuery({
    queryKey: ["asset_damage_reports"],
    queryFn: async () => {
      const { data } = await supabase.from("asset_damage_reports").select("*, assets(asset_code, asset_name)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Auto-apply category defaults on category change (add form only)
  const handleCategoryChange = (categoryName: string) => {
    const def = getCategoryDef(categoryName);
    setForm((p) => ({
      ...p,
      category: categoryName,
      useful_life_years: def ? String(def.usefulLife) : p.useful_life_years,
      depreciation_rate: def ? String(def.depreciationRate) : p.depreciation_rate,
    }));
  };

  // Filtered and sorted records
  const filteredRecords = useMemo(() => {
    let result = records.filter((r: any) => {
      const matchSearch = !searchTerm ||
        r.asset_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.responsible_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.building?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.room?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = filterCategory === "all" || r.category === filterCategory;
      const def = getCategoryDef(r.category);
      const matchGroup = filterGroup === "all" || def?.group === filterGroup;
      const matchCondition = filterCondition === "all" || r.condition === filterCondition;
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      return matchSearch && matchCategory && matchGroup && matchCondition && matchStatus;
    });

    result.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      aVal = String(aVal || "");
      bVal = String(bVal || "");
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return result;
  }, [records, searchTerm, filterCategory, filterGroup, filterCondition, filterStatus, sortField, sortDir]);

  // Stats
  const totalValue = records.reduce((s: number, r: any) => s + Number(r.current_value || 0), 0);
  const totalCost = records.reduce((s: number, r: any) => s + Number(r.acquisition_cost || 0), 0);
  const depreciation = totalCost - totalValue;
  const activeCount = records.filter((r: any) => r.status === "active").length;
  const expiredCount = records.filter((r: any) => isExpired(r.acquisition_date, r.useful_life_years)).length;
  const pendingReports = damageReports.filter((r: any) => r.status === "pending").length;
  const damagedCount = records.filter((r: any) => r.condition === "ชำรุด").length;
  const equipmentCount = records.filter((r: any) => getCategoryDef(r.category)?.group === "ครุภัณฑ์").length;
  const materialCount = records.filter((r: any) => getCategoryDef(r.category)?.group === "วัสดุ").length;

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    records.forEach((r: any) => {
      if (!map[r.category]) map[r.category] = { count: 0, value: 0 };
      map[r.category].count++;
      map[r.category].value += Number(r.acquisition_cost || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].value - a[1].value);
  }, [records]);

  // Upload one or many photos -> returns array of (long-lived signed) URLs
  const uploadPhotos = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    const { compressImage } = await import("@/lib/imageCompress");
    const { uploadAssetPhoto } = await import("@/lib/assetPhotoUrl");
    const urls: string[] = [];
    for (const f of files) {
      try {
        const compressed = await compressImage(f, { maxWidth: 1280, maxSizeKB: 150 });
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const url = await uploadAssetPhoto(path, compressed);
        urls.push(url);
      } catch (e: any) {
        toast.error(`อัปโหลดไม่สำเร็จ: ${f.name}`);
      }
    }
    return urls;
  };


  const handleAdd = async () => {
    if (!form.asset_code || !form.asset_name || !form.acquisition_cost) {
      toast.error("กรุณากรอกข้อมูลให้ครบ"); return;
    }
    const snErr = validateSN(form.serial_number);
    if (snErr) { toast.error(snErr); return; }
    const dup = findDuplicateSN(form.serial_number);
    if (dup) {
      toast.error(`S/N นี้ถูกใช้แล้วกับ "${dup.asset_name}" (${dup.asset_code})`);
      return;
    }
    setUploading(true);
    const newUrls = await uploadPhotos(photoFiles);
    const allPhotos = [...form.photos, ...newUrls];
    const cost = parseFloat(form.acquisition_cost);
    const depRate = parseFloat(form.depreciation_rate) / 100;

    // Get responsible name from profile if user_id selected
    let responsibleName = form.responsible_person;
    if (form.responsible_user_id) {
      const p = personnel.find((x: any) => x.id === form.responsible_user_id);
      if (p) responsibleName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || responsibleName;
    }

    const { error } = await supabase.from("assets").insert({
      asset_code: form.asset_code, asset_name: form.asset_name, category: form.category,
      acquisition_cost: cost, depreciation_rate: parseFloat(form.depreciation_rate),
      current_value: cost * (1 - depRate), location: form.location,
      responsible_person: responsibleName,
      responsible_user_id: form.responsible_user_id || null,
      condition: form.condition,
      notes: form.notes, useful_life_years: parseInt(form.useful_life_years),
      acquisition_date: form.acquisition_date,
      serial_number: form.serial_number || null,
      barcode: form.barcode || null,
      quantity: Math.max(1, parseInt(form.quantity) || 1),
      building: form.building || null, room: form.room || null, floor: form.floor || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      gfmis_code: form.gfmis_code || null,
      budget_source: form.budget_source || null,
      supplier: form.supplier || null,
      warranty_until: form.warranty_until || null,
      photos: allPhotos,
      ...(allPhotos[0] ? { photo_url: allPhotos[0] } : {}),
    } as any);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("ลงทะเบียนสินทรัพย์สำเร็จ");
    qc.invalidateQueries({ queryKey: ["assets"] });
    setOpen(false); setPhotoFiles([]);
    setForm(emptyForm());
  };

  const handleEdit = async () => {
    if (!editAsset) return;
    const snErr = validateSN(editAsset.serial_number || "");
    if (snErr) { toast.error(snErr); return; }
    const dup = findDuplicateSN(editAsset.serial_number || "", editAsset.id);
    if (dup) {
      toast.error(`S/N นี้ถูกใช้แล้วกับ "${dup.asset_name}" (${dup.asset_code})`);
      return;
    }
    setUploading(true);
    const newUrls = await uploadPhotos(photoFiles);
    const existing = Array.isArray(editAsset.photos) ? editAsset.photos : [];
    const allPhotos = [...existing, ...newUrls];

    const cost = parseFloat(editAsset.acquisition_cost);
    const depRate = parseFloat(editAsset.depreciation_rate) / 100;
    const ageYears = editAsset.acquisition_date
      ? (Date.now() - new Date(editAsset.acquisition_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;
    const currentValue = Math.max(0, cost * Math.pow(1 - depRate, Math.floor(ageYears)));

    let responsibleName = editAsset.responsible_person;
    if (editAsset.responsible_user_id) {
      const p = personnel.find((x: any) => x.id === editAsset.responsible_user_id);
      if (p) responsibleName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || responsibleName;
    }

    const { error } = await supabase.from("assets").update({
      asset_code: editAsset.asset_code, asset_name: editAsset.asset_name,
      category: editAsset.category, acquisition_cost: cost,
      depreciation_rate: parseFloat(editAsset.depreciation_rate),
      current_value: currentValue, location: editAsset.location,
      responsible_person: responsibleName,
      responsible_user_id: editAsset.responsible_user_id || null,
      condition: editAsset.condition,
      notes: editAsset.notes, useful_life_years: parseInt(editAsset.useful_life_years),
      acquisition_date: editAsset.acquisition_date,
      photos: allPhotos,
      photo_url: allPhotos[0] || editAsset.photo_url || null,
      serial_number: editAsset.serial_number || null,
      barcode: editAsset.barcode || null,
      quantity: Math.max(1, parseInt(editAsset.quantity) || 1),
      building: editAsset.building || null, room: editAsset.room || null, floor: editAsset.floor || null,
      latitude: editAsset.latitude ? parseFloat(editAsset.latitude) : null,
      longitude: editAsset.longitude ? parseFloat(editAsset.longitude) : null,
      gfmis_code: editAsset.gfmis_code || null,
      budget_source: editAsset.budget_source || null,
      supplier: editAsset.supplier || null,
      warranty_until: editAsset.warranty_until || null,
    } as any).eq("id", editAsset.id);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("แก้ไขสำเร็จ");
    qc.invalidateQueries({ queryKey: ["assets"] });
    setEditAsset(null); setPhotoFiles([]);
  };

  const removeExistingPhoto = (idx: number, mode: "add" | "edit") => {
    if (mode === "add") {
      setForm((p) => ({ ...p, photos: p.photos.filter((_, i) => i !== idx) }));
    } else if (editAsset) {
      const next = (editAsset.photos || []).filter((_: any, i: number) => i !== idx);
      setEditAsset({ ...editAsset, photos: next });
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await swal.confirm({ title: "ต้องการลบสินทรัพย์นี้หรือไม่?", danger: true }))) return;
    await supabase.from("assets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["assets"] });
    toast.success("ลบสำเร็จ");
  };

  const handleReportDamage = async () => {
    if (!reportAssetId || !reportDesc || !reporterName) {
      toast.error("กรุณากรอกข้อมูลให้ครบ"); return;
    }
    const { error } = await supabase.from("asset_damage_reports").insert({
      asset_id: reportAssetId, description: reportDesc, reporter_name: reporterName,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("แจ้งชำรุดสำเร็จ");
    qc.invalidateQueries({ queryKey: ["asset_damage_reports"] });
    setReportOpen(false); setReportAssetId(""); setReportDesc(""); setReporterName("");
  };

  const handleUpdateReportStatus = async (id: string, status: string, resolution_notes?: string) => {
    await supabase.from("asset_damage_reports").update({
      status, ...(status === "resolved" ? { resolved_at: new Date().toISOString(), resolution_notes } : {}),
    } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["asset_damage_reports"] });
    toast.success("อัปเดตสถานะสำเร็จ");
  };

  const formatMoney = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

  const getAssetAge = (acquisitionDate: string | null) => {
    if (!acquisitionDate) return "-";
    const years = (Date.now() - new Date(acquisitionDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return years < 1 ? `${Math.round(years * 12)} เดือน` : `${Math.floor(years)} ปี ${Math.round((years % 1) * 12)} เดือน`;
  };

  const getUsagePercent = (acquisitionDate: string | null, usefulLife: number | null) => {
    if (!acquisitionDate || !usefulLife) return 0;
    const ageYears = (Date.now() - new Date(acquisitionDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return Math.min(100, Math.round((ageYears / usefulLife) * 100));
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sortField === field ? "text-primary" : "text-muted-foreground/50"}`} />
  );

  const reportStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: "รอดำเนินการ", color: "bg-warning-soft text-warning" },
      in_progress: { label: "กำลังดำเนินการ", color: "bg-info-soft text-info" },
      resolved: { label: "แก้ไขแล้ว", color: "bg-success-soft text-success" },
      rejected: { label: "ปฏิเสธ", color: "bg-danger-soft text-danger" },
    };
    const s = map[status] || { label: status, color: "" };
    return <Badge className={s.color}>{s.label}</Badge>;
  };

  const depreciationPercent = totalCost > 0 ? Math.round((depreciation / totalCost) * 100) : 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredRecords.map((r: any) => r.id)));
  };
  const selectedAssets = filteredRecords.filter((r: any) => selectedIds.has(r.id));

  const responsibleDisplay = (a: any) => {
    if (a.responsible_user_id) {
      const p = personnel.find((x: any) => x.id === a.responsible_user_id);
      if (p) return `${p.first_name || ""} ${p.last_name || ""}`.trim();
    }
    return a.responsible_person || "-";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-7 h-7 text-primary" />
            ระบบทะเบียนวัสดุ-ครุภัณฑ์ (สพฐ.)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            จำแนกตามเกณฑ์ สพฐ. • นับอายุการใช้งาน • QR Code • ปักหมุดแผนที่ • อาคาร/ห้อง • ผู้รับผิดชอบ
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setLookupScanOpen(true)}>
            <ScanLine className="w-4 h-4 mr-2" />สแกน QR
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard/finance/assets/reports">
              <BarChart3 className="w-4 h-4 mr-2" />รายงาน
            </Link>
          </Button>
          {selectedIds.size > 0 && (
            <Button variant="outline" onClick={() => setBulkPrintOpen(true)}>
              <Printer className="w-4 h-4 mr-2" />พิมพ์ QR ({selectedIds.size})
            </Button>
          )}
          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="relative">
                <AlertTriangle className="w-4 h-4 mr-2" />แจ้งชำรุด
                {pendingReports > 0 && (
                  <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                    {pendingReports}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" />แจ้งอุปกรณ์ชำรุด/เสียหาย</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>เลือกสินทรัพย์ *</Label>
                  <Select value={reportAssetId} onValueChange={setReportAssetId}>
                    <SelectTrigger><SelectValue placeholder="เลือกสินทรัพย์" /></SelectTrigger>
                    <SelectContent>
                      {records.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.asset_code} - {r.asset_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>ชื่อผู้แจ้ง *</Label><Input value={reporterName} onChange={e => setReporterName(e.target.value)} placeholder="ชื่อ-นามสกุล" /></div>
                <div><Label>รายละเอียดความเสียหาย *</Label><Textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} rows={3} placeholder="อธิบายอาการเสียหรือชำรุด" /></div>
                <Button onClick={handleReportDamage} className="w-full">ส่งแจ้งชำรุด</Button>
              </div>
            </DialogContent>
          </Dialog>
          {canManage && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPhotoFiles([]); setForm(emptyForm()); } }}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />เพิ่มสินทรัพย์</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-primary" />ลงทะเบียนวัสดุ/ครุภัณฑ์ใหม่</DialogTitle></DialogHeader>
                <AssetForm
                  mode="add"
                  form={form}
                  setForm={setForm}
                  personnel={personnel}
                  photoFiles={photoFiles}
                  setPhotoFiles={setPhotoFiles}
                  snError={addSnError}
                  snDuplicate={addSnDuplicate}
                  onCategoryChange={handleCategoryChange}
                  removeExistingPhoto={(i) => removeExistingPhoto(i, "add")}
                  onScan={() => setScannerTarget("add")}
                />
                <Button onClick={handleAdd} className="w-full" disabled={uploading}>
                  {uploading ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">รวมทั้งหมด</p>
                <p className="text-3xl font-bold text-foreground mt-1">{records.length}</p>
                <p className="text-xs text-muted-foreground mt-1">ครุภัณฑ์ {equipmentCount} • วัสดุ {materialCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">มูลค่ารวม</p>
                <p className="text-2xl font-bold text-foreground mt-1">฿{formatMoney(totalCost)}</p>
                <p className="text-xs text-muted-foreground mt-1">ปัจจุบัน ฿{formatMoney(totalValue)}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ค่าเสื่อมราคาสะสม</p>
                <p className="text-2xl font-bold text-warning mt-1">฿{formatMoney(depreciation)}</p>
                <div className="mt-2">
                  <Progress value={depreciationPercent} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{depreciationPercent}% ของมูลค่า</p>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${expiredCount > 0 || pendingReports > 0 ? "border-l-red-500" : "border-l-emerald-500"}`}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ต้องดำเนินการ</p>
                <p className="text-3xl font-bold text-foreground mt-1">{expiredCount + pendingReports}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {expiredCount > 0 && <span className="text-danger">หมดอายุ {expiredCount}</span>}
                  {expiredCount > 0 && pendingReports > 0 && " • "}
                  {pendingReports > 0 && <span className="text-warning">แจ้งซ่อม {pendingReports}</span>}
                  {expiredCount === 0 && pendingReports === 0 && <span className="text-success">ไม่มีรายการค้าง</span>}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${expiredCount > 0 || pendingReports > 0 ? "bg-danger/10" : "bg-success/10"}`}>
                <AlertTriangle className={`w-6 h-6 ${expiredCount > 0 || pendingReports > 0 ? "text-danger" : "text-success"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="assets">
            <Package className="w-4 h-4 mr-1.5" />ทะเบียนวัสดุ-ครุภัณฑ์
          </TabsTrigger>
          <TabsTrigger value="reports" className="relative">
            <Wrench className="w-4 h-4 mr-1.5" />แจ้งชำรุด
            {pendingReports > 0 && <span className="ml-1.5 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5 py-0.5">{pendingReports}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          {/* Search & Filter Bar */}
          <Card className="mb-4">
            <CardContent className="py-3 px-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหา รหัส, ชื่อ, ผู้รับผิดชอบ, อาคาร, ห้อง..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterGroup} onValueChange={setFilterGroup}>
                    <SelectTrigger className="w-[130px]"><SelectValue placeholder="ประเภท" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกประเภท</SelectItem>
                      <SelectItem value="ครุภัณฑ์">ครุภัณฑ์</SelectItem>
                      <SelectItem value="วัสดุ">วัสดุ</SelectItem>
                      <SelectItem value="สิ่งก่อสร้าง">สิ่งก่อสร้าง</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[180px]"><Filter className="w-3 h-3 mr-1.5" /><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                      {ASSET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterCondition} onValueChange={setFilterCondition}>
                    <SelectTrigger className="w-[120px]"><SelectValue placeholder="สภาพ" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกสภาพ</SelectItem>
                      {CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(searchTerm || filterCategory !== "all" || filterGroup !== "all" || filterCondition !== "all") && (
                    <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setFilterCategory("all"); setFilterGroup("all"); setFilterCondition("all"); setFilterStatus("all"); }}>
                      <X className="w-4 h-4 mr-1" />ล้าง
                    </Button>
                  )}
                </div>
              </div>
              {filteredRecords.length !== records.length && (
                <p className="text-xs text-muted-foreground mt-2">แสดง {filteredRecords.length} จาก {records.length} รายการ</p>
              )}
            </CardContent>
          </Card>

          {/* Asset Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[50px]">รูป</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("asset_code")}>
                      รหัส <SortIcon field="asset_code" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("asset_name")}>
                      ชื่อ <SortIcon field="asset_name" />
                    </TableHead>
                    <TableHead>หมวด</TableHead>
                    <TableHead>อาคาร/ห้อง</TableHead>
                    <TableHead>ผู้รับผิดชอบ</TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("acquisition_cost")}>
                      ราคา <SortIcon field="acquisition_cost" />
                    </TableHead>
                    <TableHead>อายุการใช้งาน</TableHead>
                    <TableHead>สภาพ</TableHead>
                    <TableHead className="text-center w-[120px]">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r: any) => {
                    const cond = CONDITIONS.find(c => c.value === r.condition);
                    const expired = isExpired(r.acquisition_date, r.useful_life_years);
                    const usagePercent = getUsagePercent(r.acquisition_date, r.useful_life_years);
                    const CondIcon = cond?.icon || CheckCircle2;
                    const def = getCategoryDef(r.category);
                    return (
                      <TableRow key={r.id} className={`group hover:bg-muted/50 transition-colors ${expired ? "bg-danger/30" : ""}`}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                        </TableCell>
                        <TableCell>
                          {r.photo_url ? (
                            <img src={r.photo_url} alt={r.asset_name} className="w-10 h-10 rounded-lg object-cover border shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center border">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-medium bg-muted px-1.5 py-0.5 rounded">{r.asset_code}</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{r.asset_name}</div>
                          {r.quantity > 1 && (
                            <span className="text-[11px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">×{r.quantity}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-normal">{r.category}</Badge>
                          {def && (
                            <div className="text-[9px] text-muted-foreground mt-0.5">{def.group}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {(r.building || r.room) ? (
                            <div className="flex items-start gap-1">
                              <Building2 className="w-3 h-3 mt-0.5 text-muted-foreground" />
                              <div>
                                {r.building && <div>{r.building}</div>}
                                {r.room && <div className="text-muted-foreground">ห้อง {r.room}{r.floor ? ` ชั้น ${r.floor}` : ""}</div>}
                              </div>
                            </div>
                          ) : r.location ? (
                            <span className="text-muted-foreground">{r.location}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">{responsibleDisplay(r)}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm">฿{formatMoney(Number(r.acquisition_cost))}</span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs ${expired ? "text-danger font-semibold" : ""}`}>
                                {getAssetAge(r.acquisition_date)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{usagePercent}%</span>
                            </div>
                            <Progress
                              value={usagePercent}
                              className={`h-1.5 ${usagePercent >= 100 ? "[&>div]:bg-danger" : usagePercent >= 75 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
                            />
                            {expired && (
                              <Badge className="bg-danger-soft text-danger text-[9px] px-1.5 py-0">หมดอายุ</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${cond?.color || ""} flex items-center gap-1 w-fit`}>
                            <CondIcon className="w-3 h-3" />{r.condition}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailAsset(r)}>
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQrAsset(r)} title="QR Code">
                              <QrCode className="w-4 h-4 text-primary" />
                            </Button>
                            {canManage && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditAsset({ ...r, photos: Array.isArray(r.photos) ? r.photos : [] }); setPhotoFiles([]); }}>
                                  <Edit className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(r.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12">
                        <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-muted-foreground">{searchTerm ? "ไม่พบสินทรัพย์ที่ค้นหา" : "ยังไม่มีข้อมูลสินทรัพย์"}</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>วันที่แจ้ง</TableHead>
                    <TableHead>สินทรัพย์</TableHead>
                    <TableHead>ผู้แจ้ง</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                    <TableHead>สถานะ</TableHead>
                    {canManage && <TableHead className="text-center">จัดการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {damageReports.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="whitespace-nowrap text-sm">{r.report_date}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{(r.assets as any)?.asset_code}</div>
                        <div className="text-xs text-muted-foreground">{(r.assets as any)?.asset_name}</div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm"><User className="w-3 h-3" />{r.reporter_name || "-"}</span>
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <p className="text-sm truncate">{r.description}</p>
                        {r.resolution_notes && <p className="text-xs text-success mt-0.5">✓ {r.resolution_notes}</p>}
                      </TableCell>
                      <TableCell>{reportStatusBadge(r.status)}</TableCell>
                      {canManage && (
                        <TableCell className="text-center">
                          {r.status === "pending" && (
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="outline" onClick={() => handleUpdateReportStatus(r.id, "in_progress")}>
                                <Wrench className="w-3 h-3 mr-1" />รับเรื่อง
                              </Button>
                              <Button size="sm" variant="ghost" className="text-danger" onClick={() => handleUpdateReportStatus(r.id, "rejected")}>ปฏิเสธ</Button>
                            </div>
                          )}
                          {r.status === "in_progress" && (
                            <Button size="sm" onClick={() => handleUpdateReportStatus(r.id, "resolved", "แก้ไขเรียบร้อย")}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />แก้ไขแล้ว
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {damageReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canManage ? 6 : 5} className="text-center py-12">
                        <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
                        <p className="text-muted-foreground">ไม่มีรายการแจ้งชำรุด</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detailAsset} onOpenChange={() => setDetailAsset(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />รายละเอียดสินทรัพย์</DialogTitle></DialogHeader>
          {detailAsset && (
            <AssetDetailView
              asset={detailAsset}
              personnel={personnel}
              formatMoney={formatMoney}
              getAssetAge={getAssetAge}
              getUsagePercent={getUsagePercent}
              responsibleDisplay={responsibleDisplay}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editAsset} onOpenChange={() => { setEditAsset(null); setPhotoFiles([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5" />แก้ไขสินทรัพย์</DialogTitle></DialogHeader>
          {editAsset && (
            <>
              <AssetForm
                mode="edit"
                form={editAsset}
                setForm={setEditAsset}
                personnel={personnel}
                photoFiles={photoFiles}
                setPhotoFiles={setPhotoFiles}
                snError={editSnError}
                snDuplicate={editSnDuplicate}
                onCategoryChange={(v) => {
                  const def = getCategoryDef(v);
                  setEditAsset((p: any) => ({ ...p, category: v, useful_life_years: def?.usefulLife ?? p.useful_life_years, depreciation_rate: def?.depreciationRate ?? p.depreciation_rate }));
                }}
                removeExistingPhoto={(i) => removeExistingPhoto(i, "edit")}
                onScan={() => setScannerTarget("edit")}
              />
              <Button onClick={handleEdit} className="w-full" disabled={uploading}>
                {uploading ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerTarget !== null}
        onClose={() => setScannerTarget(null)}
        onScan={(code) => {
          const trimmed = code.trim();
          const fmtErr = validateSN(trimmed);
          if (fmtErr) { toast.error(`สแกนได้ "${trimmed}" — ${fmtErr}`, { duration: 5000 }); return; }
          const excludeId = scannerTarget === "edit" ? editAsset?.id : undefined;
          const dup = findDuplicateSN(trimmed, excludeId);
          if (dup) { toast.error(`S/N "${trimmed}" ถูกใช้แล้วกับ "${dup.asset_name}" (${dup.asset_code})`, { duration: 6000 }); return; }
          if (scannerTarget === "add") setForm(p => ({ ...p, serial_number: trimmed, barcode: trimmed }));
          else if (scannerTarget === "edit") setEditAsset((p: any) => ({ ...p, serial_number: trimmed, barcode: trimmed }));
          toast.success(`สแกนสำเร็จ: ${trimmed}`);
        }}
        title="สแกนบาร์โค้ด S/N"
      />

      {/* Single QR */}
      <AssetQRCode open={!!qrAsset} onClose={() => setQrAsset(null)} asset={qrAsset} />

      {/* Bulk QR Sheet */}
      <AssetBulkQRSheet
        open={bulkPrintOpen}
        onClose={() => setBulkPrintOpen(false)}
        assets={selectedAssets}
        onRemove={(id) => toggleSelect(id)}
      />

      {/* Lookup by QR scan */}
      <BarcodeScanner
        open={lookupScanOpen}
        onClose={() => setLookupScanOpen(false)}
        title="สแกน QR ทรัพย์สิน/ครุภัณฑ์"
        onScan={(code) => {
          const trimmed = code.trim();
          // Try parse URL like /asset/:id
          const m = trimmed.match(/\/asset\/([0-9a-fA-F-]{8,})/);
          if (m) {
            const id = m[1];
            const found = records.find((r: any) => r.id === id);
            setLookupScanOpen(false);
            if (found) setDetailAsset(found);
            else navigate(`/asset/${id}`);
            return;
          }
          // Fallback: lookup by asset_code or serial_number
          const found = records.find(
            (r: any) => r.asset_code === trimmed || r.serial_number === trimmed
          );
          setLookupScanOpen(false);
          if (found) setDetailAsset(found);
          else toast.error(`ไม่พบทรัพย์สิน: ${trimmed}`);
        }}
      />
    </div>
  );
};

// ============================================
// Sub-components
// ============================================

interface AssetFormProps {
  mode: "add" | "edit";
  form: any;
  setForm: any;
  personnel: any[];
  photoFiles: File[];
  setPhotoFiles: (f: File[]) => void;
  snError: string | null;
  snDuplicate: any | null;
  onCategoryChange: (v: string) => void;
  removeExistingPhoto: (i: number) => void;
  onScan: () => void;
}

const AssetForm = ({ mode, form, setForm, personnel, photoFiles, setPhotoFiles, snError, snDuplicate, onCategoryChange, removeExistingPhoto, onScan }: AssetFormProps) => {
  const upd = (patch: any) => {
    if (mode === "add") setForm((p: any) => ({ ...p, ...patch }));
    else setForm((p: any) => ({ ...p, ...patch }));
  };
  const existingPhotos: string[] = Array.isArray(form.photos) ? form.photos : [];

  return (
    <div className="space-y-4 pr-2">
      {/* Section 1: ข้อมูลพื้นฐาน */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>รหัสสินทรัพย์ *</Label>
          <Input value={form.asset_code} onChange={e => upd({ asset_code: e.target.value })} placeholder="เช่น 7440-001-0001" />
        </div>
        <div>
          <Label>หมวดหมู่ (เกณฑ์ สพฐ.)</Label>
          <Select value={form.category} onValueChange={onCategoryChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["ครุภัณฑ์", "วัสดุ", "สิ่งก่อสร้าง"] as const).map(group => (
                <div key={group}>
                  <div className="text-[10px] font-semibold text-muted-foreground px-2 pt-2">{group}</div>
                  {ASSET_CATEGORIES_FULL.filter(c => c.group === group).map(c => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          {getCategoryDef(form.category) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              อายุใช้งานมาตรฐาน: {getCategoryDef(form.category)!.usefulLife} ปี
            </p>
          )}
        </div>
      </div>

      <div><Label>ชื่อสินทรัพย์ *</Label><Input value={form.asset_name} onChange={e => upd({ asset_name: e.target.value })} /></div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <Label className="flex items-center gap-1"><ScanLine className="w-3 h-3" /> หมายเลขซีเรียล (S/N)</Label>
          <Input
            value={form.serial_number || ""}
            onChange={e => upd({ serial_number: e.target.value })}
            placeholder="3-50 ตัวอักษร"
            maxLength={50}
            className={snError || snDuplicate ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onScan} title="สแกนบาร์โค้ด">
          <ScanLine className="w-4 h-4" />
        </Button>
      </div>
      {snError && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{snError}</span>
        </div>
      )}
      {snDuplicate && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-warning-soft border border-warning/30 text-warning text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">S/N นี้มีอยู่แล้วในระบบ!</p>
            <p>ตรงกับ <span className="font-mono">{snDuplicate.asset_code}</span> — {snDuplicate.asset_name}</p>
          </div>
        </div>
      )}

      {/* Section 2: ราคา & อายุ */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">ราคาและอายุการใช้งาน</p>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>ราคาที่ได้มา (บาท) *</Label><Input type="number" value={form.acquisition_cost} onChange={e => upd({ acquisition_cost: e.target.value })} /></div>
          <div><Label>อัตราเสื่อมราคา (%)</Label><Input type="number" value={form.depreciation_rate} onChange={e => upd({ depreciation_rate: e.target.value })} /></div>
          <div><Label>จำนวน (ชิ้น)</Label><Input type="number" min={1} value={form.quantity ?? 1} onChange={e => upd({ quantity: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div><Label>วันที่ได้มา</Label><BEDatePicker value={form.acquisition_date || ""} onChange={(v) => upd({ acquisition_date: v })} /></div>
          <div><Label>อายุการใช้งาน (ปี)</Label><Input type="number" value={form.useful_life_years} onChange={e => upd({ useful_life_years: e.target.value })} /></div>
          <div><Label>สิ้นสุดการรับประกัน</Label><BEDatePicker value={form.warranty_until || ""} onChange={(v) => upd({ warranty_until: v })} /></div>
        </div>
      </div>

      {/* Section 3: งบประมาณ */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">งบประมาณ & แหล่งที่มา</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>แหล่งงบประมาณ</Label>
            <Select value={form.budget_source || ""} onValueChange={(v) => upd({ budget_source: v })}>
              <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
              <SelectContent>
                {BUDGET_SOURCES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>รหัส GFMIS</Label><Input value={form.gfmis_code || ""} onChange={e => upd({ gfmis_code: e.target.value })} placeholder="เลขรหัส GFMIS (ถ้ามี)" /></div>
        </div>
        <div className="mt-3"><Label>ผู้ขาย/ผู้จำหน่าย</Label><Input value={form.supplier || ""} onChange={e => upd({ supplier: e.target.value })} /></div>
      </div>

      {/* Section 4: ตำแหน่งและผู้รับผิดชอบ */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5" /> ตำแหน่งที่ใช้งาน
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>อาคาร</Label><Input value={form.building || ""} onChange={e => upd({ building: e.target.value })} placeholder="เช่น อาคาร 1" /></div>
          <div><Label>ชั้น</Label><Input value={form.floor || ""} onChange={e => upd({ floor: e.target.value })} placeholder="เช่น 2" /></div>
          <div><Label>ห้อง</Label><Input value={form.room || ""} onChange={e => upd({ room: e.target.value })} placeholder="เช่น คอม 1" /></div>
        </div>
        <div className="mt-3"><Label>คำอธิบายตำแหน่งเพิ่มเติม</Label><Input value={form.location || ""} onChange={e => upd({ location: e.target.value })} placeholder="(ถ้าต้องการ)" /></div>

        <div className="mt-3">
          <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> ปักหมุดบนแผนที่</Label>
          <MapPicker
            lat={form.latitude ? parseFloat(form.latitude) : null}
            lng={form.longitude ? parseFloat(form.longitude) : null}
            radius={50}
            height={280}
            onChange={(lat, lng) => upd({ latitude: String(lat), longitude: String(lng) })}
          />
        </div>
      </div>

      {/* Section 5: ผู้รับผิดชอบ */}
      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2">ผู้รับผิดชอบ</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>เลือกจากบุคลากร</Label>
            <Select
              value={form.responsible_user_id || "__none__"}
              onValueChange={(v) => upd({ responsible_user_id: v === "__none__" ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="เลือกบุคลากร" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                {personnel.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {(p.first_name || "") + " " + (p.last_name || "")} {p.position ? `(${p.position})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>หรือกรอกชื่อโดยตรง</Label>
            <Input value={form.responsible_person || ""} onChange={e => upd({ responsible_person: e.target.value })} placeholder="ชื่อ-นามสกุล" />
          </div>
        </div>
      </div>

      {/* Section 6: รูปภาพหลายรูป */}
      <div className="border-t pt-3">
        <Label className="flex items-center gap-1"><Camera className="w-3 h-3" /> รูปภาพ (อัปโหลดได้หลายรูป)</Label>
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={e => setPhotoFiles(Array.from(e.target.files || []))}
        />
        {(existingPhotos.length > 0 || photoFiles.length > 0) && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {existingPhotos.map((url, i) => (
              <div key={`ex-${i}`} className="relative group">
                <img src={url} alt="" className="w-full h-20 object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(i)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {photoFiles.map((f, i) => (
              <div key={`new-${i}`} className="relative">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-20 object-cover rounded border-2 border-primary" />
                <span className="absolute bottom-0 left-0 right-0 text-[9px] bg-primary/80 text-white text-center">ใหม่</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>สภาพ</Label>
            <Select value={form.condition} onValueChange={v => upd({ condition: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3"><Label>หมายเหตุ</Label><Textarea value={form.notes || ""} onChange={e => upd({ notes: e.target.value })} rows={2} /></div>
      </div>
    </div>
  );
};

const AssetDetailView = ({ asset, personnel, formatMoney, getAssetAge, getUsagePercent, responsibleDisplay }: any) => {
  const photos: string[] = Array.isArray(asset.photos) && asset.photos.length > 0
    ? asset.photos
    : (asset.photo_url ? [asset.photo_url] : []);
  const [activePhoto, setActivePhoto] = useState(0);
  useEffect(() => { setActivePhoto(0); }, [asset?.id]);
  const responsiblePerson = asset.responsible_user_id
    ? personnel.find((x: any) => x.id === asset.responsible_user_id)
    : null;
  const def = getCategoryDef(asset.category);

  return (
    <div className="space-y-4">
      {/* Photos gallery */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <img src={photos[activePhoto]} alt={asset.asset_name} className="w-full h-64 object-cover rounded-lg border" />
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`shrink-0 ${i === activePhoto ? "ring-2 ring-primary" : ""}`}
                >
                  <img src={p} alt="" className="w-16 h-16 object-cover rounded border" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">รหัส:</span> <span className="font-mono font-medium">{asset.asset_code}</span></div>
        <div><span className="text-muted-foreground">หมวด:</span> {asset.category} {def && <Badge variant="outline" className="ml-1 text-[9px]">{def.group}</Badge>}</div>
        <div className="col-span-2"><span className="text-muted-foreground">ชื่อ:</span> <span className="font-medium">{asset.asset_name}</span></div>
        {asset.serial_number && (
          <div className="col-span-2"><span className="text-muted-foreground">S/N:</span> <span className="font-mono">{asset.serial_number}</span></div>
        )}
        <div><span className="text-muted-foreground">จำนวน:</span> {asset.quantity || 1} ชิ้น</div>
        <div><span className="text-muted-foreground">ราคา:</span> <span className="font-mono">฿{formatMoney(Number(asset.acquisition_cost))}</span></div>
        <div><span className="text-muted-foreground">มูลค่าปัจจุบัน:</span> <span className="font-mono text-success">฿{formatMoney(Number(asset.current_value || 0))}</span></div>
        <div><span className="text-muted-foreground">วันที่ได้มา:</span> {asset.acquisition_date || "-"}</div>
        <div><span className="text-muted-foreground">อายุ:</span> {getAssetAge(asset.acquisition_date)}</div>
        <div><span className="text-muted-foreground">อายุกำหนด:</span> {asset.useful_life_years || "-"} ปี</div>
        <div><span className="text-muted-foreground">สภาพ:</span> <Badge className={CONDITIONS.find(c => c.value === asset.condition)?.color}>{asset.condition}</Badge></div>
        {asset.budget_source && <div><span className="text-muted-foreground">งบประมาณ:</span> {asset.budget_source}</div>}
        {asset.gfmis_code && <div><span className="text-muted-foreground">GFMIS:</span> <span className="font-mono">{asset.gfmis_code}</span></div>}
        {asset.supplier && <div className="col-span-2"><span className="text-muted-foreground">ผู้ขาย:</span> {asset.supplier}</div>}
        {asset.warranty_until && <div><span className="text-muted-foreground">รับประกันถึง:</span> {asset.warranty_until}</div>}
      </div>

      {/* Location */}
      {(asset.building || asset.room || asset.location) && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> ตำแหน่งที่ใช้งาน</p>
          <p className="text-sm">
            {asset.building && <span className="font-medium">{asset.building}</span>}
            {asset.floor && <span className="text-muted-foreground"> • ชั้น {asset.floor}</span>}
            {asset.room && <span className="text-muted-foreground"> • ห้อง {asset.room}</span>}
          </p>
          {asset.location && <p className="text-xs text-muted-foreground mt-0.5">{asset.location}</p>}
        </div>
      )}

      {/* Responsible person */}
      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
        <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><User className="w-3 h-3" /> ผู้รับผิดชอบ</p>
        <p className="text-sm font-medium">{responsibleDisplay(asset)}</p>
        {responsiblePerson && (
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            {responsiblePerson.position && <div>ตำแหน่ง: {responsiblePerson.position}</div>}
            {responsiblePerson.phone && <div>📞 {responsiblePerson.phone}</div>}
          </div>
        )}
      </div>

      {/* Map */}
      {asset.latitude && asset.longitude && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> ตำแหน่งบนแผนที่</p>
          <MapPicker
            lat={Number(asset.latitude)}
            lng={Number(asset.longitude)}
            radius={30}
            height={220}
            onChange={() => { /* read-only */ }}
          />
        </div>
      )}

      {asset.notes && (
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <span className="text-muted-foreground">หมายเหตุ:</span> {asset.notes}
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-1">การใช้งาน ({getUsagePercent(asset.acquisition_date, asset.useful_life_years)}%)</p>
        <Progress value={getUsagePercent(asset.acquisition_date, asset.useful_life_years)} className="h-2" />
      </div>
    </div>
  );
};

function isExpired(acquisitionDate: string | null, usefulLife: number | null) {
  if (!acquisitionDate || !usefulLife) return false;
  const ageYears = (Date.now() - new Date(acquisitionDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return ageYears >= usefulLife;
}

export default AssetManagementPage;
