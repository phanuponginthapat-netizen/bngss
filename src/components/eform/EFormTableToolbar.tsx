import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import {
  Rows3, Columns3, Trash2, Merge, Split, ArrowUpToLine, ArrowDownToLine,
  ArrowLeftToLine, ArrowRightToLine, RectangleHorizontal, Minus, Plus,
  MousePointer,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { scaleActiveTable } from "@/lib/eformTableSizing";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { findParentNode } from "@tiptap/core";
import { handleEFormTableDelete } from "@/lib/eformTableSelection";

const Btn = ({ onClick, title, children, danger }: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors hover:bg-slate-100 ${danger ? "text-red-600" : "text-slate-700"}`}
  >
    {children}
  </button>
);

const EFormTableToolbar = ({ editor }: { editor: Editor | null }) => {
  const [, force] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const update = () => force((n) => n + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!editor || !editor.isActive("table")) return null;
  const c = editor.chain().focus();

  // คลุมดำทั้งแถว / ทั้งคอลัมน์ที่เคอร์เซอร์อยู่ (เลียน Word: คลิกริมแถว/หัวคอลัมน์)
  const selectRowOrCol = (mode: "row" | "col") => {
    const { state, view } = editor;
    const cell = findParentNode((n) => n.type.name === "tableCell" || n.type.name === "tableHeader")(state.selection);
    const table = findParentNode((n) => n.type.name === "table")(state.selection);
    if (!cell || !table) return;
    const map = TableMap.get(table.node);
    const cellPosInTable = cell.pos - table.start;
    const rect = map.findCell(cellPosInTable);
    const tableStart = table.start;
    let anchor: number, head: number;
    if (mode === "row") {
      anchor = tableStart + map.map[rect.top * map.width];
      head = tableStart + map.map[rect.top * map.width + (map.width - 1)];
    } else {
      anchor = tableStart + map.map[rect.left];
      head = tableStart + map.map[(map.height - 1) * map.width + rect.left];
    }
    const $anchor = state.doc.resolve(anchor);
    const $head = state.doc.resolve(head);
    const sel = mode === "row" ? CellSelection.rowSelection($anchor, $head) : CellSelection.colSelection($anchor, $head);
    view.dispatch(state.tr.setSelection(sel as any));
    view.focus();
  };

  const deleteSelectedRowOrCol = (fallback: "row" | "col") => {
    if (handleEFormTableDelete(editor, false)) return;
    if (fallback === "row") editor.chain().focus().deleteRow().run();
    else editor.chain().focus().deleteColumn().run();
  };

  return (
    <div className="basis-full w-full flex flex-wrap items-center gap-0.5 mt-1 pt-1 border-t border-amber-200 bg-amber-50/40 -mx-3 px-3">
      <span className="text-[11px] font-semibold text-amber-700 px-1">เครื่องมือตาราง</span>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title="คลุมดำทั้งแถว (กด Delete เพื่อลบ)" onClick={() => selectRowOrCol("row")}><MousePointer className="w-4 h-4 rotate-90" /></Btn>
      <Btn title="คลุมดำทั้งคอลัมน์ (กด Delete เพื่อลบ)" onClick={() => selectRowOrCol("col")}><MousePointer className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title="แทรกแถวด้านบน" onClick={() => c.addRowBefore().run()}><ArrowUpToLine className="w-4 h-4" /></Btn>
      <Btn title="แทรกแถวด้านล่าง" onClick={() => c.addRowAfter().run()}><ArrowDownToLine className="w-4 h-4" /></Btn>
      <Btn title="ลบแถวที่เลือก" danger onClick={() => deleteSelectedRowOrCol("row")}><Rows3 className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title="แทรกคอลัมน์ซ้าย" onClick={() => c.addColumnBefore().run()}><ArrowLeftToLine className="w-4 h-4" /></Btn>
      <Btn title="แทรกคอลัมน์ขวา" onClick={() => c.addColumnAfter().run()}><ArrowRightToLine className="w-4 h-4" /></Btn>
      <Btn title="ลบคอลัมน์ที่เลือก" danger onClick={() => deleteSelectedRowOrCol("col")}><Columns3 className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title="ผสานเซลล์" onClick={() => c.mergeCells().run()}><Merge className="w-4 h-4" /></Btn>
      <Btn title="แยกเซลล์" onClick={() => c.splitCell().run()}><Split className="w-4 h-4" /></Btn>
      <Btn title="สลับเซลล์หัวตาราง" onClick={() => c.toggleHeaderCell().run()}><RectangleHorizontal className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title="ย่อขนาดตารางจริง 10%" onClick={() => scaleActiveTable(editor, 0.9)}><Minus className="w-4 h-4" /></Btn>
      <Btn title="ขยายขนาดตารางจริง 10%" onClick={() => scaleActiveTable(editor, 1.1)}><Plus className="w-4 h-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title="ลบทั้งตาราง" danger onClick={() => c.deleteTable().run()}><Trash2 className="w-4 h-4" /></Btn>
    </div>
  );
};

export default EFormTableToolbar;
