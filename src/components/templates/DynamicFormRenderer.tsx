import { TemplateField } from "./PdfFieldOverlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMemo } from "react";

interface Props {
  fields: TemplateField[];
  values: Record<string, any>;
  onChange: (key: string, v: any) => void;
  highlightedId?: string | null;
  setHighlightedId?: (id: string | null) => void;
}

export function DynamicFormRenderer({ fields, values, onChange, highlightedId, setHighlightedId }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, TemplateField[]>();
    for (const f of fields) {
      const g = f.group || "ทั่วไป";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return Array.from(map.entries());
  }, [fields]);

  return (
    <div className="space-y-5">
      {grouped.map(([group, items]) => (
        <div key={group} className="space-y-3">
          <h4 className="text-sm font-semibold text-primary border-b pb-1">{group}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((f) => (
              <div
                key={f.id}
                id={`field-${f.id}`}
                onFocus={() => setHighlightedId?.(f.id)}
                onMouseEnter={() => setHighlightedId?.(f.id)}
                className={`space-y-1 ${highlightedId === f.id ? "ring-2 ring-orange-400 rounded p-2 -m-2" : ""} ${f.type === "longtext" ? "md:col-span-2" : ""}`}
              >
                {renderField(f, values[f.key], (v) => onChange(f.key, v))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderField(f: TemplateField, value: any, onChange: (v: any) => void) {
  if (f.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
        <span className="text-sm">{f.label}</span>
      </label>
    );
  }
  if (f.type === "radio") {
    return (
      <div>
        <Label className="text-sm">{f.label}</Label>
        <RadioGroup value={value || ""} onValueChange={onChange} className="mt-1">
          {(f.options || []).map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <RadioGroupItem value={o} id={`${f.id}-${i}`} />
              <Label htmlFor={`${f.id}-${i}`} className="text-sm font-normal">{o}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }
  if (f.type === "longtext") {
    return (
      <div>
        <Label className="text-sm">{f.label}</Label>
        <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} />
      </div>
    );
  }
  if (f.type === "date") {
    return (
      <div>
        <Label className="text-sm">{f.label}</Label>
        <Input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (f.type === "number") {
    return (
      <div>
        <Label className="text-sm">{f.label}</Label>
        <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (f.type === "image") {
    return (
      <div>
        <Label className="text-sm">{f.label} (รูปภาพ)</Label>
        <Input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange(reader.result as string);
            reader.readAsDataURL(file);
          }}
        />
        {typeof value === "string" && value.startsWith("data:image") && (
          <img src={value} alt="" className="mt-2 max-h-24 border rounded" />
        )}
      </div>
    );
  }
  if (f.type === "autofill") {
    return (
      <div>
        <Label className="text-sm">{f.label} <span className="text-[10px] text-amber-600">⚡ เติมอัตโนมัติ</span></Label>
        <Input value={value || ""} readOnly className="bg-muted/50 text-muted-foreground" placeholder={f.data_source || "จะเติมเมื่อเลือกนักเรียน"} />
      </div>
    );
  }
  if (f.type === "signature") {
    return (
      <div>
        <Label className="text-sm">{f.label}</Label>
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="(ชื่อผู้ลงนาม — ใช้เป็นข้อความ)" />
      </div>
    );
  }
  return (
    <div>
      <Label className="text-sm">{f.label}</Label>
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

