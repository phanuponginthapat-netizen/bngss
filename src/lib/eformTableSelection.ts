import type { Editor } from "@tiptap/react";
import { CellSelection, cellAround } from "@tiptap/pm/tables";

const getCellSelectionFromCurrentSelection = (editor: Editor) => {
  const { state } = editor;
  const sel: any = state.selection;
  if (sel?.$anchorCell && sel?.$headCell) return sel as CellSelection;

  if (state.selection.empty) return null;
  const $anchorCell = cellAround(state.selection.$from);
  const $headCell = cellAround(state.selection.$to);
  if (!$anchorCell || !$headCell) return null;
  // ถ้าคลุมดำเฉพาะข้อความในเซลล์เดียว ให้ปล่อยให้ editor ลบข้อความตามปกติ ไม่ล้างทั้งเซลล์
  if ($anchorCell.pos === $headCell.pos) return null;

  try {
    return new CellSelection($anchorCell, $headCell);
  } catch {
    return null;
  }
};

// ลบแถว/คอลัมน์จากการคลุมดำแบบ Word: รองรับทั้ง CellSelection และ TextSelection ที่ลากคร่อมหลายเซลล์
export const handleEFormTableDelete = (editor: Editor | null, allowPartialCellClear = false) => {
  if (!editor) return false;
  const cellSelection = getCellSelectionFromCurrentSelection(editor);
  if (!cellSelection) return false;

  const isRow = typeof (cellSelection as any).isRowSelection === "function" && (cellSelection as any).isRowSelection();
  const isCol = typeof (cellSelection as any).isColSelection === "function" && (cellSelection as any).isColSelection();
  if (!isRow && !isCol) {
    if (!allowPartialCellClear) return false;
    editor.view.dispatch(editor.state.tr.setSelection(cellSelection as any));
    return editor.chain().focus().deleteSelection().run();
  }

  editor.view.dispatch(editor.state.tr.setSelection(cellSelection as any));
  if (isRow && isCol) return editor.chain().focus().deleteTable().run();
  if (isRow) return editor.chain().focus().deleteRow().run();
  return editor.chain().focus().deleteColumn().run();
};