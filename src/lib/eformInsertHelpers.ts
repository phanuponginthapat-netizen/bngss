// ตัวช่วยสำหรับ toolbar tools ของ TipTap
// จัดการเคอร์เซอร์อัตโนมัติก่อนแทรก block ใหม่ (ตาราง/รูป/กล่องข้อความ/ตัวแบ่งหน้า)
// เป้าหมาย: ป้องกันการ "แทรกซ้อน" ที่ทำให้ layout หน้ากระดาษเพี้ยน/หายไป
//
// เคสที่คุ้มครอง:
//   1) selection คร่อมหลายเซลล์ในตาราง (CellSelection) → collapse ไปที่ท้ายเซลล์สุดท้าย
//   2) selection คร่อมหลาย block (หลายย่อหน้า/หลาย node) → collapse ไปที่ท้าย block สุดท้าย
//   3) หลัง collapse แล้วยังอยู่ในเซลล์ตาราง → ย้ายเคอร์เซอร์ไปหลังตาราง (top-level)
//
// ใช้ helper เดียวก่อนคำสั่ง insert ทุกครั้ง เพื่อให้พฤติกรรมสม่ำเสมอทั่วทั้งระบบ

const collapseMultiSelection = (editor: any) => {
  const { state } = editor;
  const sel: any = state.selection;

  // CellSelection ของ prosemirror-tables — มี property `$anchorCell` / `$headCell`
  if (sel && sel.$headCell) {
    const endOfCell = sel.$headCell.pos + sel.$headCell.nodeAfter.nodeSize - 2;
    editor.chain().focus().setTextSelection(endOfCell).run();
    return true;
  }

  // TextSelection / NodeSelection ที่ไม่ empty
  if (sel && !sel.empty) {
    editor.chain().focus().setTextSelection(sel.to).run();
    return true;
  }

  return false;
};

const escapeTableIfInside = (editor: any) => {
  if (!editor.isActive("table")) return false;
  const { state } = editor;
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "table") {
      const after = $from.after(d);
      const posAfterNode = editor.state.doc.nodeAt(after);
      if (!posAfterNode) {
        editor.chain().insertContentAt(after, { type: "paragraph" }).run();
      }
      editor.chain().focus().setTextSelection(after + 1).run();
      return true;
    }
  }
  return false;
};

/**
 * เตรียมเคอร์เซอร์ก่อนแทรก block ใหม่:
 * - ยุบ selection ที่คร่อมหลายเซลล์หรือหลาย block ให้เหลือจุดเดียว
 * - ย้ายออกจากตาราง (ถ้าอยู่ใน table cell)
 */
export const prepareBlockInsertion = (editor: any) => {
  if (!editor) return;
  try {
    collapseMultiSelection(editor);
    escapeTableIfInside(editor);
  } catch {
    // safe no-op — เดิมพฤติกรรมเก่า
  }
};

// backward-compat: alias เดิมที่ใช้อยู่หลายไฟล์
export const escapeCurrentTable = prepareBlockInsertion;
