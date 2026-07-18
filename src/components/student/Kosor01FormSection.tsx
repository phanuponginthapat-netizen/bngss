// ส่วนกรอกแบบฟอร์ม นร./กสศ. 01 ใช้ใน HomeVisitPage
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2 } from "lucide-react";
import {
  KOSOR01_SECTIONS,
  MEMBER_COLUMNS,
  type HouseholdMember,
  type Kosor01Field,
} from "@/lib/kosor01";

interface Props {
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}

export function Kosor01FormSection({ value, onChange }: Props) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  const toggleInArray = (k: string, opt: string) => {
    const arr: string[] = Array.isArray(value[k]) ? value[k] : [];
    set(k, arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]);
  };

  const updateMember = (idx: number, key: keyof HouseholdMember, v: any) => {
    const list: HouseholdMember[] = Array.isArray(value.members) ? [...value.members] : [];
    list[idx] = { ...list[idx], [key]: v };
    set("members", list);
  };
  const addMember = () => {
    const list: HouseholdMember[] = Array.isArray(value.members) ? [...value.members] : [];
    list.push({});
    set("members", list);
  };
  const removeMember = (idx: number) => {
    const list: HouseholdMember[] = Array.isArray(value.members) ? [...value.members] : [];
    list.splice(idx, 1);
    set("members", list);
  };

  const renderMembers = () => {
    const list: HouseholdMember[] = Array.isArray(value.members) ? value.members : [];
    return (
      <div className="col-span-2 space-y-2">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted">
                <th className="border p-1 w-8">#</th>
                {MEMBER_COLUMNS.map((c) => (
                  <th key={String(c.key)} className="border p-1 whitespace-nowrap">{c.label}</th>
                ))}
                <th className="border p-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((m, i) => (
                <tr key={i}>
                  <td className="border p-1 text-center">{i + 1}</td>
                  {MEMBER_COLUMNS.map((c) => (
                    <td key={String(c.key)} className="border p-0.5">
                      {c.type === "check" ? (
                        <div className="flex justify-center">
                          <Checkbox
                            checked={!!(m as any)[c.key]}
                            onCheckedChange={(v) => updateMember(i, c.key, !!v)}
                          />
                        </div>
                      ) : (
                        <Input
                          type={c.type === "num" ? "number" : "text"}
                          value={((m as any)[c.key] as string) ?? ""}
                          onChange={(e) => updateMember(i, c.key, e.target.value)}
                          className="h-7 text-xs px-1"
                        />
                      )}
                    </td>
                  ))}
                  <td className="border p-1 text-center">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeMember(i)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={MEMBER_COLUMNS.length + 2} className="border p-2 text-center text-muted-foreground">ยังไม่มีรายการสมาชิก</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addMember}>
          <Plus className="w-3 h-3 mr-1" />เพิ่มสมาชิก
        </Button>
      </div>
    );
  };

  const renderField = (f: Kosor01Field) => {
    const v = value[f.key];
    if (f.type === "members") {
      return (
        <div key={f.key} className="col-span-2 space-y-1">
          <Label className="text-xs">{f.label}</Label>
          {renderMembers()}
        </div>
      );
    }
    if (f.type === "radio") {
      return (
        <div key={f.key} className="col-span-2 space-y-1">
          <Label className="text-xs">{f.label}</Label>
          <RadioGroup value={v || ""} onValueChange={(nv) => set(f.key, nv)} className="flex flex-wrap gap-x-4 gap-y-1">
            {(f.options || []).map((o) => (
              <label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <RadioGroupItem value={o} id={`${f.key}-${o}`} />
                <span>{o}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      );
    }
    if (f.type === "checkboxGroup") {
      const arr: string[] = Array.isArray(v) ? v : [];
      return (
        <div key={f.key} className="col-span-2 space-y-1">
          <Label className="text-xs">{f.label}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(f.options || []).map((o) => (
              <label key={o} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox checked={arr.includes(o)} onCheckedChange={() => toggleInArray(f.key, o)} />
                <span>{o}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }
    if (f.type === "textarea") {
      return (
        <div key={f.key} className={f.half ? "" : "col-span-2"}>
          <Label className="text-xs">{f.label}</Label>
          <Textarea value={v || ""} onChange={(e) => set(f.key, e.target.value)} rows={2} />
        </div>
      );
    }
    return (
      <div key={f.key} className={f.half ? "" : "col-span-2"}>
        <Label className="text-xs">{f.label}{f.suffix ? ` (${f.suffix})` : ""}</Label>
        <Input
          type={f.type === "number" ? "number" : "text"}
          value={v ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
          placeholder={f.placeholder}
        />
      </div>
    );
  };

  return (
    <>
      {KOSOR01_SECTIONS.map((s) => (
        <Card key={s.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{s.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">{s.fields.map(renderField)}</div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
