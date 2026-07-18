import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sliders, RotateCcw, GripVertical } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import {
  COLOR_THEMES,
  SIZE_LABELS,
  type WidgetColor,
  type WidgetSize,
} from "@/lib/dashboardWidgets";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface RowProps {
  w: ReturnType<typeof useDashboardWidgets>["widgets"][number];
  onChange: (patch: { widget_key: string; enabled?: boolean; size?: WidgetSize; color_theme?: WidgetColor }) => void;
  lang: "th" | "en" | "mm";
}

function SortableRow({ w, onChange, lang }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.key });
  const def = w.def;
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const themeKeys = Object.keys(COLOR_THEMES) as WidgetColor[];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border p-3 transition-shadow",
        w.enabled ? "bg-card" : "bg-muted/40 opacity-70",
        isDragging && "shadow-lg"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground"
          aria-label={L("ลากเพื่อจัดลำดับ", "Drag to reorder")}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className={cn("w-7 h-7 rounded-lg shrink-0 flex items-center justify-center", COLOR_THEMES[w.color].gradient)}>
          <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{L(def.titleTh, def.titleEn)}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{def.group}</p>
        </div>
        <Switch
          checked={w.enabled}
          disabled={def.required}
          onCheckedChange={(v) => onChange({ widget_key: w.key, enabled: v })}
        />
      </div>

      {w.enabled && (
        <div className="mt-3 grid gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-12">{L("ขนาด", "Size")}</span>
            <div className="flex gap-1 flex-wrap">
              {def.allowedSizes.map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ widget_key: w.key, size: s })}
                  className={cn(
                    "px-2.5 py-1 text-[11px] rounded-md border transition-colors",
                    w.size === s ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  )}
                >
                  {SIZE_LABELS[s as WidgetSize].en}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-12">{L("สี", "Color")}</span>
            <div className="flex gap-1.5 flex-wrap">
              {themeKeys.map((c) => (
                <button
                  key={c}
                  onClick={() => onChange({ widget_key: w.key, color_theme: c })}
                  className={cn(
                    "w-6 h-6 shrink-0 aspect-square rounded-full transition-all ring-offset-1 ring-offset-background",
                    COLOR_THEMES[c].gradient,
                    w.color === c ? "ring-2 ring-foreground scale-110" : "hover:scale-105"
                  )}
                  title={lang === "th" ? COLOR_THEMES[c].label : COLOR_THEMES[c].labelEn}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WidgetCustomizer() {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const [open, setOpen] = useState(false);
  const { widgets, upsert, resetAll, reorder } = useDashboardWidgets();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex((w) => w.key === active.id);
    const newIdx = widgets.findIndex((w) => w.key === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const newOrder = arrayMove(widgets, oldIdx, newIdx).map((w) => w.key);
    reorder.mutate(newOrder);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full shadow-sm">
          <Sliders className="w-3.5 h-3.5" />
          {L("ปรับวิดเจ็ต", "Customize")}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{L("ปรับแต่งวิดเจ็ตแดชบอร์ด", "Customize Dashboard Widgets")}</SheetTitle>
          <SheetDescription>
            {L("ลากเพื่อจัดลำดับ • เปิด/ปิด • เลือกขนาด • เลือกสี", "Drag to reorder • Toggle • Resize • Recolor")}
          </SheetDescription>
        </SheetHeader>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={widgets.map((w) => w.key)} strategy={verticalListSortingStrategy}>
            <div className="mt-4 space-y-3">
              {widgets.map((w) => (
                <SortableRow key={w.key} w={w} lang={lang} onChange={(p) => upsert.mutate(p)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => resetAll.mutate()}>
            <RotateCcw className="w-3.5 h-3.5" />
            {L("รีเซ็ตเป็นค่าเริ่มต้น", "Reset to defaults")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
