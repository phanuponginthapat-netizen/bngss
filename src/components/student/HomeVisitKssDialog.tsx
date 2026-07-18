import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: any | null;              // existing home_visits row to edit (null = new — for extending existing record)
  onSaved: () => void;
}

type Member = { prefix?: string; first_name?: string; last_name?: string; relation?: string; age?: string; occupation?: string; income?: string };

const toggle = (arr: string[] = [], v: string) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

export default function HomeVisitKssDialog({ open, onOpenChange, record, onSaved }: Props) {
  // Section 1 — student & guardian
  const [maritalStatus, setMaritalStatus] = useState("");
  const [livingWith, setLivingWith] = useState("");
  const [gPrefix, setGPrefix] = useState("");
  const [gFirst, setGFirst] = useState("");
  const [gLast, setGLast] = useState("");
  const [gRelation, setGRelation] = useState("");
  const [gEducation, setGEducation] = useState("");
  const [gOccupation, setGOccupation] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gIdCard, setGIdCard] = useState("");
  const [gNoIdCard, setGNoIdCard] = useState(false);
  const [hasWelfare, setHasWelfare] = useState(false);
  const [numMembers, setNumMembers] = useState("");
  const [income, setIncome] = useState("");
  const [poverty, setPoverty] = useState("ไม่ยากจน");

  // Section 2 — household members
  const [members, setMembers] = useState<Member[]>([]);

  // Section 3 — household status (jsonb)
  const [dependency, setDependency] = useState<string[]>([]);
  const [living, setLiving] = useState("");
  const [floorMat, setFloorMat] = useState<string[]>([]);
  const [wallMat, setWallMat] = useState<string[]>([]);
  const [roofMat, setRoofMat] = useState<string[]>([]);
  const [hasToilet, setHasToilet] = useState<boolean | null>(null);
  const [farmLand, setFarmLand] = useState("");
  const [waterSrc, setWaterSrc] = useState<string[]>([]);
  const [electricSrc, setElectricSrc] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);

  // Section 5 — travel extras
  const [travelTime, setTravelTime] = useState("");
  const [travelCost, setTravelCost] = useState("");
  const [studentMoney, setStudentMoney] = useState("");

  // Section 10 — officer
  const [officerName, setOfficerName] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [officerPos, setOfficerPos] = useState("");
  const [officerCertified, setOfficerCertified] = useState<boolean | null>(null);
  const [officerReject, setOfficerReject] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !record) return;
    setMaritalStatus(record.family_marital_status || "");
    setLivingWith(record.living_with || "");
    setGPrefix(record.guardian_prefix || "");
    setGFirst(record.guardian_first_name || "");
    setGLast(record.guardian_last_name || "");
    setGRelation(record.guardian_relation || "");
    setGEducation(record.guardian_education || "");
    setGOccupation(record.guardian_occupation || "");
    setGPhone(record.guardian_phone || "");
    setGIdCard(record.guardian_id_card || "");
    setGNoIdCard(!!record.guardian_no_id_card);
    setHasWelfare(!!record.has_state_welfare);
    setNumMembers(record.num_family_members?.toString() || "");
    setIncome(record.income_per_month?.toString() || "");
    setPoverty(record.poverty_status || "ไม่ยากจน");
    setMembers(Array.isArray(record.household_members) ? record.household_members : []);
    const s = record.household_status || {};
    setDependency(s.dependency || []);
    setLiving(s.living || "");
    setFloorMat(s.floor_material || []);
    setWallMat(s.wall_material || []);
    setRoofMat(s.roof_material || []);
    setHasToilet(typeof s.has_toilet === "boolean" ? s.has_toilet : null);
    setFarmLand(s.farm_land || "");
    setWaterSrc(s.water_source || []);
    setElectricSrc(s.electricity_source || []);
    setVehicles(s.vehicles || []);
    setItems(s.household_items || []);
    setTravelTime(record.travel_time_minutes?.toString() || "");
    setTravelCost(record.travel_cost_per_month?.toString() || "");
    setStudentMoney(record.student_money_per_day?.toString() || "");
    setOfficerName(record.officer_name || "");
    setOfficerId(record.officer_id_card || "");
    setOfficerPos(record.officer_position || "");
    setOfficerCertified(typeof record.officer_certified === "boolean" ? record.officer_certified : null);
    setOfficerReject(record.officer_reject_reason || "");
  }, [open, record]);

  const save = async () => {
    if (!record?.id) return;
    setSaving(true);
    try {
      const payload = {
        family_marital_status: maritalStatus || null,
        living_with: livingWith || null,
        guardian_prefix: gPrefix || null,
        guardian_first_name: gFirst || null,
        guardian_last_name: gLast || null,
        guardian_relation: gRelation || null,
        guardian_education: gEducation || null,
        guardian_occupation: gOccupation || null,
        guardian_phone: gPhone || null,
        guardian_id_card: gIdCard || null,
        guardian_no_id_card: gNoIdCard,
        has_state_welfare: hasWelfare,
        num_family_members: numMembers ? parseInt(numMembers) : null,
        income_per_month: income ? parseFloat(income) : null,
        poverty_status: poverty,
        household_members: members,
        household_status: {
          dependency, living, floor_material: floorMat, wall_material: wallMat, roof_material: roofMat,
          has_toilet: hasToilet, farm_land: farmLand, water_source: waterSrc,
          electricity_source: electricSrc, vehicles, household_items: items,
        },
        travel_time_minutes: travelTime ? parseInt(travelTime) : null,
        travel_cost_per_month: travelCost ? parseFloat(travelCost) : null,
        student_money_per_day: studentMoney ? parseFloat(studentMoney) : null,
        officer_name: officerName || null,
        officer_id_card: officerId || null,
        officer_position: officerPos || null,
        officer_certified: officerCertified,
        officer_reject_reason: officerReject || null,
      };
      const { error } = await supabase.from("home_visits").update(payload as any).eq("id", record.id);
      if (error) throw error;
      toast.success("บันทึกข้อมูล กสศ.01 สำเร็จ");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const CBs = ({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) => (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <Checkbox checked={value.includes(opt)} onCheckedChange={() => onChange(toggle(value, opt))} />
          {opt}
        </label>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh]">
        <DialogHeader><DialogTitle>แบบบันทึกการเยี่ยมบ้าน (แบบ นร./กสศ.01)</DialogTitle></DialogHeader>
        <ScrollArea className="max-h-[75vh] pr-3">
          <Tabs defaultValue="s1">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="s1">1. นักเรียน/ผู้ปกครอง</TabsTrigger>
              <TabsTrigger value="s2">2. สมาชิก</TabsTrigger>
              <TabsTrigger value="s3">3. สถานะครัวเรือน</TabsTrigger>
              <TabsTrigger value="s5">5. เดินทาง</TabsTrigger>
              <TabsTrigger value="s10">10. รับรอง</TabsTrigger>
              <TabsTrigger value="save">บันทึก</TabsTrigger>
            </TabsList>

            <TabsContent value="s1" className="space-y-3 pt-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">สถานภาพครอบครัว</CardTitle></CardHeader>
                <CardContent>
                  <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                    <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="together">พ่อแม่อยู่ด้วยกัน</SelectItem>
                      <SelectItem value="separated">พ่อแม่แยกกันอยู่</SelectItem>
                      <SelectItem value="divorced">พ่อแม่หย่าร้าง</SelectItem>
                      <SelectItem value="father_deceased">พ่อเสียชีวิต/สาบสูญ</SelectItem>
                      <SelectItem value="mother_deceased">แม่เสียชีวิต/สาบสูญ</SelectItem>
                      <SelectItem value="both_deceased">เสียชีวิตทั้งคู่/สาบสูญ</SelectItem>
                      <SelectItem value="abandoned">พ่อ/แม่ทอดทิ้ง</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">ข้อมูลผู้ปกครอง</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-3 gap-3">
                  <div><Label>คำนำหน้า</Label><Input value={gPrefix} onChange={e => setGPrefix(e.target.value)} /></div>
                  <div><Label>ชื่อ</Label><Input value={gFirst} onChange={e => setGFirst(e.target.value)} /></div>
                  <div><Label>นามสกุล</Label><Input value={gLast} onChange={e => setGLast(e.target.value)} /></div>
                  <div><Label>ความสัมพันธ์</Label><Input value={gRelation} onChange={e => setGRelation(e.target.value)} placeholder="บิดา/มารดา/ญาติ" /></div>
                  <div><Label>การศึกษาสูงสุด</Label><Input value={gEducation} onChange={e => setGEducation(e.target.value)} /></div>
                  <div><Label>อาชีพ</Label><Input value={gOccupation} onChange={e => setGOccupation(e.target.value)} /></div>
                  <div><Label>เบอร์โทร</Label><Input value={gPhone} onChange={e => setGPhone(e.target.value)} /></div>
                  <div className="col-span-2"><Label>เลขประจำตัวประชาชน</Label><Input value={gIdCard} onChange={e => setGIdCard(e.target.value)} disabled={gNoIdCard} /></div>
                  <div className="flex items-center gap-2 mt-6"><Switch checked={gNoIdCard} onCheckedChange={setGNoIdCard} /><Label>ไม่มีเลข ปชช.</Label></div>
                  <div className="flex items-center gap-2 mt-6"><Switch checked={hasWelfare} onCheckedChange={setHasWelfare} /><Label>บัตรสวัสดิการแห่งรัฐ</Label></div>
                </CardContent>
              </Card>

              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">รายได้ครัวเรือน</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-3 gap-3">
                  <div><Label>จำนวนสมาชิก (คน)</Label><Input type="number" value={numMembers} onChange={e => setNumMembers(e.target.value)} /></div>
                  <div><Label>รายได้/เดือน (บาท)</Label><Input type="number" value={income} onChange={e => setIncome(e.target.value)} /></div>
                  <div><Label>สถานะยากจน</Label>
                    <Select value={poverty} onValueChange={setPoverty}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ไม่ยากจน">ไม่ยากจน</SelectItem>
                        <SelectItem value="ยากจน">ยากจน</SelectItem>
                        <SelectItem value="ยากจนพิเศษ">ยากจนพิเศษ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="s2" className="space-y-3 pt-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">สมาชิกในครัวเรือน (รวมนักเรียน)</Label>
                <Button size="sm" onClick={() => setMembers([...members, {}])}><Plus className="w-4 h-4 mr-1" />เพิ่ม</Button>
              </div>
              {members.map((m, i) => (
                <Card key={i}><CardContent className="grid grid-cols-7 gap-2 pt-4 items-end">
                  <Input placeholder="คำนำ" value={m.prefix || ""} onChange={e => setMembers(members.map((x, j) => j === i ? { ...x, prefix: e.target.value } : x))} />
                  <Input placeholder="ชื่อ" value={m.first_name || ""} onChange={e => setMembers(members.map((x, j) => j === i ? { ...x, first_name: e.target.value } : x))} />
                  <Input placeholder="นามสกุล" value={m.last_name || ""} onChange={e => setMembers(members.map((x, j) => j === i ? { ...x, last_name: e.target.value } : x))} />
                  <Input placeholder="ความสัมพันธ์" value={m.relation || ""} onChange={e => setMembers(members.map((x, j) => j === i ? { ...x, relation: e.target.value } : x))} />
                  <Input placeholder="อายุ" type="number" value={m.age || ""} onChange={e => setMembers(members.map((x, j) => j === i ? { ...x, age: e.target.value } : x))} />
                  <Input placeholder="อาชีพ/รายได้" value={m.occupation || ""} onChange={e => setMembers(members.map((x, j) => j === i ? { ...x, occupation: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => setMembers(members.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </CardContent></Card>
              ))}
              {members.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">— ยังไม่มีสมาชิก —</p>}
            </TabsContent>

            <TabsContent value="s3" className="space-y-4 pt-3">
              <div><Label>3.1 ภาระพึ่งพิง (เลือกได้มากกว่า 1)</Label>
                <CBs options={["disability","chronic","elderly","single_parent","unemployed"]} value={dependency} onChange={setDependency} />
                <p className="text-xs text-muted-foreground mt-1">พิการ / โรคเรื้อรัง / สูงอายุ60+ / เลี้ยงเดี่ยว / ว่างงาน15-65</p>
              </div>
              <div><Label>3.2 การอยู่อาศัย</Label>
                <Select value={living} onValueChange={setLiving}>
                  <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">บ้านตนเอง/เจ้าของ</SelectItem>
                    <SelectItem value="rent">บ้านเช่า</SelectItem>
                    <SelectItem value="free">อยู่กับผู้อื่น/อยู่ฟรี</SelectItem>
                    <SelectItem value="dorm">หอพัก</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>3.3 วัสดุพื้นบ้าน</Label>
                <CBs options={["กระเบื้อง/เซรามิค","ปาเก้/ไม้ขัดเงา","ซีเมนต์เปลือย","ไม้กระดาน","ไวนิล/กระเบื้องยาง/เสื่อน้ำมัน","ไม้ไผ่","ดิน/ทราย","อื่นๆ"]} value={floorMat} onChange={setFloorMat} />
              </div>
              <div><Label>วัสดุฝาบ้าน</Label>
                <CBs options={["ฉาบซีเมนต์","อิฐ/ก้อนปูน/อิฐบล็อก","สังกะสี","ไม้กระดาน","ไม้อัด","สมาร์ทบอร์ด/ไฟเบอร์","ไม้ไผ่/เศษไม้","ดิน/ไวนิล/อื่นๆ"]} value={wallMat} onChange={setWallMat} />
              </div>
              <div><Label>วัสดุหลังคา</Label>
                <CBs options={["โลหะ (สังกะสี/เหล็ก)","กระเบื้อง/เซรามิค","ไม้กระดาน","ใบไม้/วัสดุธรรมชาติ","ไวนิล/พลาสติก","อื่นๆ"]} value={roofMat} onChange={setRoofMat} />
              </div>
              <div className="flex items-center gap-4"><Label>ห้องส้วมในที่อยู่อาศัย</Label>
                <label className="flex items-center gap-1 text-sm"><Checkbox checked={hasToilet === true} onCheckedChange={v => setHasToilet(v ? true : null)} />มี</label>
                <label className="flex items-center gap-1 text-sm"><Checkbox checked={hasToilet === false} onCheckedChange={v => setHasToilet(v ? false : null)} />ไม่มี</label>
              </div>
              <div><Label>3.4 ที่ดินทำการเกษตร</Label>
                <Select value={farmLand} onValueChange={setFarmLand}>
                  <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่ทำเกษตร</SelectItem>
                    <SelectItem value="lt1">น้อยกว่า 1 ไร่</SelectItem>
                    <SelectItem value="1to5">1 ถึง 5 ไร่</SelectItem>
                    <SelectItem value="gt5">มากกว่า 5 ไร่</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>3.5 แหล่งน้ำดื่ม</Label>
                <CBs options={["น้ำดื่มบรรจุขวด/ตู้หยอด","น้ำประปา","น้ำบ่อ/บาดาล","น้ำฝน/ลำธาร"]} value={waterSrc} onChange={setWaterSrc} />
              </div>
              <div><Label>3.6 แหล่งไฟฟ้า</Label>
                <CBs options={["none","เครื่องปั่นไฟ/โซลาเซลล์","ไฟต่อพ่วง/แบตเตอรี่","ไฟบ้าน/มิเตอร์"]} value={electricSrc} onChange={setElectricSrc} />
              </div>
              <div><Label>3.7 ยานพาหนะ</Label>
                <CBs options={["none","รถยนต์ (เกิน15ปี)","รถยนต์ (ไม่เกิน15ปี)","ปิกอัพ (เกิน15ปี)","ปิกอัพ (ไม่เกิน15ปี)","รถไถ (เกิน15ปี)","รถไถ (ไม่เกิน15ปี)","มอเตอร์ไซค์/เรือเล็ก"]} value={vehicles} onChange={setVehicles} />
              </div>
              <div><Label>3.8 ของใช้ในครัวเรือน</Label>
                <CBs options={["none","คอมพิวเตอร์","แอร์","ทีวีจอแบน","เครื่องซักผ้า","ตู้เย็น"]} value={items} onChange={setItems} />
              </div>
            </TabsContent>

            <TabsContent value="s5" className="space-y-3 pt-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>เวลาเดินทาง (นาที/ไป-กลับ)</Label><Input type="number" value={travelTime} onChange={e => setTravelTime(e.target.value)} /></div>
                <div><Label>ค่าใช้จ่ายเดินทาง (บาท/เดือน)</Label><Input type="number" value={travelCost} onChange={e => setTravelCost(e.target.value)} /></div>
                <div><Label>เงินมาโรงเรียน (บาท/วัน)</Label><Input type="number" value={studentMoney} onChange={e => setStudentMoney(e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">วิธีเดินทาง / ระยะทาง / GPS / รูปที่พัก แก้ไขในหน้าบันทึกหลัก</p>
            </TabsContent>

            <TabsContent value="s10" className="space-y-3 pt-3">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">การรับรองโดยเจ้าหน้าที่ของรัฐ</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div><Label>ชื่อ-สกุล</Label><Input value={officerName} onChange={e => setOfficerName(e.target.value)} /></div>
                  <div><Label>เลข ปชช.</Label><Input value={officerId} onChange={e => setOfficerId(e.target.value)} /></div>
                  <div className="col-span-2"><Label>ตำแหน่ง</Label><Input value={officerPos} onChange={e => setOfficerPos(e.target.value)} /></div>
                  <div className="col-span-2 flex flex-col gap-2">
                    <label className="flex items-center gap-2"><Checkbox checked={officerCertified === true} onCheckedChange={v => setOfficerCertified(v ? true : null)} /> ขอรับรองข้อมูลถูกต้อง เห็นควรพิจารณาเงินอุดหนุน</label>
                    <label className="flex items-center gap-2"><Checkbox checked={officerCertified === false} onCheckedChange={v => setOfficerCertified(v ? false : null)} /> ไม่ขอรับรอง</label>
                    <Textarea placeholder="เหตุผลที่ไม่รับรอง (ถ้ามี)" value={officerReject} onChange={e => setOfficerReject(e.target.value)} disabled={officerCertified !== false} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="save" className="pt-3">
              <Card><CardContent className="pt-6 space-y-4 text-center">
                <p className="text-sm text-muted-foreground">กดปุ่มเพื่อบันทึกทุกส่วนของแบบ กสศ.01</p>
                <Button onClick={save} disabled={saving} className="w-full" size="lg">
                  <Save className="w-4 h-4 mr-2" />{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล กสศ.01"}
                </Button>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
