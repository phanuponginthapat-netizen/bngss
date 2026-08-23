import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle as TextStyleBase, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Paragraph as ParagraphBase } from "@tiptap/extension-paragraph";
import { Heading as HeadingBase } from "@tiptap/extension-heading";
import ResizableImage from "./ResizableImage";
import { Table as TableBase } from "@tiptap/extension-table";
import { TableRow as TableRowBase } from "@tiptap/extension-table-row";
import { TableCell as TableCellBase } from "@tiptap/extension-table-cell";
import { TableHeader as TableHeaderBase } from "@tiptap/extension-table-header";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EFORM_PAGE_STYLE } from "@/lib/eformLayout";
import EFormWordToolbar from "./EFormWordToolbar";
import EFormPageCanvas from "./EFormPageCanvas";
import DOMPurify from "dompurify";
import { findTableByDOM, mergeInlineStyle, resizeTableToWidth, setTableColumnWidths } from "@/lib/eformTableSizing";
import { handleEFormTableDelete } from "@/lib/eformTableSelection";
import { useSchoolReport } from "@/hooks/useSchoolReport";
import { buildSchoolAssetOverlayCSS } from "@/lib/eformSchoolAssets";
import { escapeCurrentTable } from "@/lib/eformInsertHelpers";
import { fitImageAttrs, paperContentMaxPx } from "@/lib/fitImageAttrs";

// แปลงหน่วยฟอนต์เก่า pt → px (1pt = 1.333px) เพื่อให้ 16pt ราชการ = 21px บนจอตรงกับพิมพ์
export const normalizeFontSizes = (html: string) =>
  (html || "").replace(/font-size\s*:\s*(\d+(?:\.\d+)?)pt/gi, (_m, n) => `font-size:${Math.round(Number(n)*4/3)}px`);

const unwrapEFormDocumentShell = (html: string) => {
  const raw = DOMPurify.sanitize(html || "", { ADD_TAGS: ["style"], ADD_ATTR: ["style", "class"] });
  if (!raw.trim() || typeof document === "undefined") return raw;

  const container = document.createElement("div");
  container.innerHTML = raw;
  const meaningfulNodes = Array.from(container.childNodes).filter((node) => {
    if (node.nodeType === 3) return !!node.textContent?.trim();
    return node.nodeType === 1;
  });

  if (meaningfulNodes.length !== 1) return raw;
  const shell = meaningfulNodes[0];
  if (!(shell instanceof HTMLElement) || shell.tagName.toLowerCase() !== "div") return raw;

  const className = shell.getAttribute("class") || "";
  const style = shell.getAttribute("style") || "";
  const styleProps = style
    .split(";")
    .map((part) => part.split(":")[0]?.trim().toLowerCase())
    .filter(Boolean);
  const isPrintShell = className.split(/\s+/).includes("eform-print-page");
  const isFontOnlyShell = styleProps.length > 0 && styleProps.every((prop) =>
    ["font-family", "font-size", "line-height", "color", "background", "background-color"].includes(prop),
  );

  return isPrintShell || isFontOnlyShell ? shell.innerHTML : raw;
};

const normalizeEditorHtml = (html: string) => normalizeFontSizes(unwrapEFormDocumentShell(html));

// ใช้ TextStyle + FontSize ของ TipTap โดยตรง เพื่อให้การปรับขนาดฟอนต์เป็น mark เฉพาะช่วงที่เลือก
// ไม่ใช่การเปลี่ยน font-size ของ root editor ซึ่งจะกระทบทั้งหน้าเอกสาร
export const EFormTextStyle = TextStyleBase;
export const EFormFontSize = FontSize.configure({ types: ["textStyle"] });

const getActiveTextStyleAttrs = (editor: any) => {
  const stored = editor?.state?.storedMarks?.find((mark: any) => mark.type.name === "textStyle")?.attrs;
  if (stored && Object.values(stored).some(Boolean)) return stored;
  return editor?.getAttributes?.("textStyle") || {};
};

const styleAttribute = () => ({
  style: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute("style") || null,
    renderHTML: (attrs: any) => attrs.style ? { style: attrs.style } : {},
  },
});

// เก็บ inline style ของ table/row/cell ไว้ใน document state เพื่อให้ resize แล้วบันทึกได้จริง
export const EFormTable = TableBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...styleAttribute(),
    };
  },
  addKeyboardShortcuts() {
    // เมื่อคลุมดำหลายเซลล์แล้วกด Delete/Backspace ให้ลบ "ทั้งแถว/ทั้งคอลัมน์" แบบ Word
    const deleteSelectedRange = () => handleEFormTableDelete(this.editor as Editor, true);
    return {
      Delete: deleteSelectedRange,
      Backspace: deleteSelectedRange,
      "Mod-Backspace": deleteSelectedRange,
    };
  },
});

export const EFormTableRow = TableRowBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...styleAttribute(),
    };
  },
});

export const EFormTableCell = TableCellBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...styleAttribute(),
    };
  },
});

export const EFormTableHeader = TableHeaderBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...styleAttribute(),
    };
  },
});

export const EFormParagraph = ParagraphBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...styleAttribute(),
    };
  },
});

export const EFormHeading = HeadingBase.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...styleAttribute(),
    };
  },
});
// Block wrapper ที่เก็บ <div style="..."> ไว้ครบ — ใช้สำหรับ wrapper จัดกลางตราครุฑ
// และกล่องลายเซ็น ที่ TipTap ปกติจะ unwrap div ทิ้งทั้ง alignment/width/margin
export const EFormDiv = Node.create({
  name: "eformDiv",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("style") || null,
        renderHTML: (attrs: any) => attrs.style ? { style: attrs.style } : {},
      },
      class: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("class") || null,
        renderHTML: (attrs: any) => attrs.class ? { class: attrs.class } : {},
      },
    };
  },
  parseHTML() {
    // จับเฉพาะ div ที่มี style/class — ปล่อย div ของ TipTap (เช่น tableWrapper) ผ่าน
    return [
      { tag: "div[style]", priority: 60 },
      { tag: "div[class]:not(.tableWrapper):not([class*='resize'])", priority: 55 },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes, 0];
  },
});


// Atomic inline node ที่เก็บ <span data-eform-field="..."> แบบครบทุก attribute/style
// เพื่อให้ตำแหน่ง/ขนาดของ placeholder (เช่น ตราครุฑ, ตราโรงเรียน) ไม่เพี้ยนเมื่อโหลดเข้า TipTap
export const EFormFieldToken = Node.create({
  name: "eformFieldToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      fieldKey: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-eform-field") || "",
        renderHTML: (attrs: any) => attrs.fieldKey ? { "data-eform-field": attrs.fieldKey } : {},
      },
      fieldType: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-eform-field-type"),
        renderHTML: (attrs: any) => attrs.fieldType ? { "data-eform-field-type": attrs.fieldType } : {},
      },
      label: {
        default: "",
        parseHTML: (el: HTMLElement) => (el.textContent || "").trim(),
        renderHTML: () => ({}),
      },
      style: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("style") || null,
        renderHTML: (attrs: any) => attrs.style ? { style: attrs.style } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-eform-field]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["span", HTMLAttributes, node.attrs.label || `[${node.attrs.fieldKey}]`];
  },
});



export const useEFormTableResize = (editor: any, onHtmlChange: (html: string) => void) => {
  // ปรับขนาดตาราง + ความสูงแถวด้วยการลากเส้น/มุม แบบ Word และบันทึกลง document state จริง
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const ROW_EDGE = 8;
    const COL_EDGE = 8;
    const TABLE_CORNER = 16;
    type DragState =
      | { kind: "row"; row: HTMLTableRowElement; cells: HTMLElement[]; startY: number; startH: number; scale: number }
      | { kind: "column"; wrapper: HTMLElement | null; table: HTMLTableElement; colIndex: number; startX: number; scale: number; startWidths: number[]; currentWidths: number[] }
      | { kind: "table"; wrapper: HTMLElement; table: HTMLTableElement; startX: number; startY: number; startW: number; startH: number; scale: number; startWidths: number[] };
    let drag: DragState | null = null;

    const getScale = () => {
      const rect = dom.getBoundingClientRect();
      return rect.width && dom.offsetWidth ? rect.width / dom.offsetWidth : 1;
    };

    const findNodePosByDOM = (target: HTMLElement, typeNames: string[]) => {
      let found: number | null = null;
      editor.state.doc.descendants((node: any, pos: number) => {
        if (found !== null) return false;
        if (!typeNames.includes(node.type.name)) return true;
        const nodeDOM = editor.view.nodeDOM(pos);
        if (nodeDOM instanceof HTMLElement && (nodeDOM === target || nodeDOM.contains(target) || target.contains(nodeDOM))) {
          found = pos;
          return false;
        }
        return true;
      });
      return found;
    };

    const setNodeStyle = (target: HTMLElement, typeNames: string[], patch: Record<string, string | null>) => {
      const pos = findNodePosByDOM(target, typeNames);
      if (pos === null) return null;
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return null;
      const style = mergeInlineStyle((node.attrs.style as string | null) || target.getAttribute("style"), patch);
      return { pos, attrs: { ...node.attrs, style: style || null } };
    };

    const commitRowHeight = (row: HTMLTableRowElement, cells: HTMLElement[], height: number) => {
      let tr = editor.state.tr;
      const pad = height < 28 ? "2px 4px" : height < 40 ? "4px 6px" : "8px";
      const lh = height < 28 ? "1" : "1.2";
      const rowUpdate = setNodeStyle(row, ["tableRow"], { height: `${height}px` });
      if (rowUpdate) {
        const node = tr.doc.nodeAt(rowUpdate.pos);
        if (node) tr = tr.setNodeMarkup(rowUpdate.pos, undefined, rowUpdate.attrs);
      }
      cells.forEach((cell) => {
        const update = setNodeStyle(cell, ["tableCell", "tableHeader"], {
          height: `${height}px`,
          padding: pad,
          "line-height": lh,
          "vertical-align": "middle",
        });
        if (!update) return;
        const node = tr.doc.nodeAt(update.pos);
        if (node) tr = tr.setNodeMarkup(update.pos, undefined, update.attrs);
      });
      if (tr.docChanged) editor.view.dispatch(tr);
    };

    const commitTableSize = (wrapper: HTMLElement, table: HTMLTableElement, width: number, height: number) => {
      resizeTableToWidth(editor, table, width, height);
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      table.style.width = `${width}px`;
      table.style.height = `${height}px`;
    };

    const getColumnWidthsFromDOM = (table: HTMLTableElement) => {
      const colWidths = Array.from(table.querySelectorAll("col"))
        .map((col) => parseFloat((col as HTMLTableColElement).style.width || col.getAttribute("width") || "0"))
        .filter((width) => Number.isFinite(width) && width > 0);
      if (colWidths.length) return colWidths;

      const row = Array.from(table.rows).find((r) => r.cells.length > 0);
      if (!row) return [Math.max(80, table.getBoundingClientRect().width)];
      const widths: number[] = [];
      Array.from(row.cells).forEach((cell) => {
        const span = Math.max(1, cell.colSpan || 1);
        const width = Math.max(30, cell.getBoundingClientRect().width / span);
        for (let i = 0; i < span; i++) widths.push(width);
      });
      return widths;
    };

    const getLogicalColumnIndex = (cell: HTMLTableCellElement) => {
      const row = cell.parentElement as HTMLTableRowElement | null;
      if (!row) return 0;
      let index = 0;
      for (const c of Array.from(row.cells)) {
        const span = Math.max(1, c.colSpan || 1);
        if (c === cell) return index + span - 1;
        index += span;
      }
      return Math.max(0, cell.cellIndex);
    };

    const applyLiveColumnWidths = (table: HTMLTableElement, widths: number[]) => {
      const cols = Array.from(table.querySelectorAll("col")) as HTMLTableColElement[];
      cols.forEach((col, index) => {
        const width = Math.max(30, Math.round(widths[index] || widths[widths.length - 1] || 80));
        col.style.width = `${width}px`;
        col.setAttribute("width", `${width}`);
      });

      Array.from(table.rows).forEach((row) => {
        let cursor = 0;
        Array.from(row.cells).forEach((cell) => {
          const span = Math.max(1, cell.colSpan || 1);
          const width = widths.slice(cursor, cursor + span).reduce((sum, w) => sum + Math.max(30, w || 0), 0);
          (cell as HTMLElement).style.width = `${Math.max(30, Math.round(width || 80))}px`;
          cursor += span;
        });
      });
    };

    const getPoint = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e) {
        const t = e.touches[0] || e.changedTouches[0];
        return { clientX: t?.clientX ?? 0, clientY: t?.clientY ?? 0, target: t?.target as HTMLElement | null };
      }
      return { clientX: e.clientX, clientY: e.clientY, target: e.target as HTMLElement | null };
    };

    const onMove = (evt: MouseEvent | TouchEvent) => {
      const e = { ...getPoint(evt), preventDefault: () => evt.preventDefault() };
      if (drag) {
        e.preventDefault();
        if (drag.kind === "row") {
          const h = Math.max(8, drag.startH + (e.clientY - drag.startY) / drag.scale);
          const pad = h < 28 ? "2px 4px" : h < 40 ? "4px 6px" : "";
          const lh = h < 28 ? "1" : "1.2";
          drag.row.style.height = `${h}px`;
          drag.cells.forEach((c) => {
            c.style.height = `${h}px`;
            if (pad) c.style.padding = pad; else c.style.padding = "";
            c.style.lineHeight = lh;
            c.style.verticalAlign = "middle";
          });
          return;
        }
        if (drag.kind === "column") {
          const delta = (e.clientX - drag.startX) / drag.scale;
          const widths = [...drag.startWidths];
          const min = 25;
          const current = drag.startWidths[drag.colIndex] || min;
          const next = drag.startWidths[drag.colIndex + 1] || 0;
          if (drag.colIndex < widths.length - 1) {
            const constrained = Math.max(min - current, Math.min(next - min, delta));
            widths[drag.colIndex] = Math.max(min, current + constrained);
            widths[drag.colIndex + 1] = Math.max(min, next - constrained);
          } else {
            widths[drag.colIndex] = Math.max(min, current + delta);
          }
          drag.currentWidths = widths;
          const total = widths.reduce((sum, width) => sum + Math.max(min, width), 0);
          drag.table.style.width = `${Math.round(total)}px`;
          drag.table.style.tableLayout = "fixed";
          if (drag.wrapper) drag.wrapper.style.width = `${Math.round(total)}px`;
          applyLiveColumnWidths(drag.table, widths);
          return;
        }
        const w = Math.max(80, drag.startW + (e.clientX - drag.startX) / drag.scale);
        const h = Math.max(40, drag.startH + (e.clientY - drag.startY) / drag.scale);
        const factor = w / Math.max(1, drag.startWidths.reduce((sum, width) => sum + width, 0));
        const liveWidths = drag.startWidths.map((width) => Math.max(30, width * factor));
        drag.wrapper.style.width = `${w}px`;
        drag.wrapper.style.height = `${h}px`;
        drag.table.style.width = `${w}px`;
        drag.table.style.height = `${h}px`;
        drag.table.style.tableLayout = "fixed";
        applyLiveColumnWidths(drag.table, liveWidths);
        return;
      }
      const t = e.target as HTMLElement;
      const wrapper = t?.closest?.(".tableWrapper") as HTMLElement | null;
      if (wrapper) {
        const wr = wrapper.getBoundingClientRect();
        if (e.clientX >= wr.right - TABLE_CORNER && e.clientY >= wr.bottom - TABLE_CORNER) {
          dom.style.cursor = "nwse-resize";
          return;
        }
      }
      const cell = t?.closest?.("td,th") as HTMLElement | null;
      if (!cell) { dom.style.cursor = ""; return; }
      const r = cell.getBoundingClientRect();
      if (e.clientX >= r.right - COL_EDGE) dom.style.cursor = "col-resize";
      else if (e.clientY >= r.bottom - ROW_EDGE) dom.style.cursor = "row-resize";
      else dom.style.cursor = "";
    };

    const onDown = (evt: MouseEvent | TouchEvent) => {
      const e = { ...getPoint(evt), preventDefault: () => evt.preventDefault(), stopPropagation: () => evt.stopPropagation() };
      const t = e.target as HTMLElement;
      const wrapper = t?.closest?.(".tableWrapper") as HTMLElement | null;
      if (wrapper) {
        const wr = wrapper.getBoundingClientRect();
        if (e.clientX >= wr.right - TABLE_CORNER && e.clientY >= wr.bottom - TABLE_CORNER) {
          const table = wrapper.querySelector("table") as HTMLTableElement | null;
          if (!table) return;
          const scale = getScale();
          e.preventDefault();
          e.stopPropagation();
          drag = {
            kind: "table",
            wrapper,
            table,
            startX: e.clientX,
            startY: e.clientY,
            startW: wr.width / scale,
            startH: wr.height / scale,
            scale,
            startWidths: getColumnWidthsFromDOM(table),
          };
          document.body.style.cursor = "nwse-resize";
          document.body.style.userSelect = "none";
          return;
        }
      }
      const cell = t?.closest?.("td,th") as HTMLElement | null;
      if (!cell) return;
      const r = cell.getBoundingClientRect();
      if (e.clientX >= r.right - COL_EDGE) {
        const table = cell.closest("table") as HTMLTableElement | null;
        if (!table) return;
        const scale = getScale();
        const widths = getColumnWidthsFromDOM(table);
        const colIndex = Math.min(Math.max(0, getLogicalColumnIndex(cell as HTMLTableCellElement)), Math.max(0, widths.length - 1));
        e.preventDefault();
        e.stopPropagation();
        drag = {
          kind: "column",
          wrapper: table.closest(".tableWrapper") as HTMLElement | null,
          table,
          colIndex,
          startX: e.clientX,
          scale,
          startWidths: widths,
          currentWidths: [...widths],
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        return;
      }
      if (e.clientY < r.bottom - ROW_EDGE) return;
      const row = cell.parentElement as HTMLTableRowElement | null;
      if (!row) return;
      const scale = getScale();
      e.preventDefault();
      e.stopPropagation();
      drag = { kind: "row", row, cells: Array.from(row.cells) as HTMLElement[], startY: e.clientY, startH: row.getBoundingClientRect().height / scale, scale };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    };

    const onUp = () => {
      if (drag) {
        if (drag.kind === "row") {
          const h = parseFloat(drag.cells[0]?.style.height || `${drag.row.getBoundingClientRect().height / drag.scale}`);
          commitRowHeight(drag.row, drag.cells, h);
        } else if (drag.kind === "column") {
          const widths = drag.currentWidths?.length ? drag.currentWidths : getColumnWidthsFromDOM(drag.table);
          const target = findTableByDOM(editor, drag.table);
          if (target) setTableColumnWidths(editor, target, widths);
          const total = widths.reduce((sum, width) => sum + Math.max(25, width), 0);
          drag.table.style.width = `${Math.round(total)}px`;
          if (drag.wrapper) drag.wrapper.style.width = `${Math.round(total)}px`;
        } else {
          const w = parseFloat(drag.table.style.width || `${drag.wrapper.getBoundingClientRect().width / drag.scale}`);
          const h = parseFloat(drag.table.style.height || `${drag.wrapper.getBoundingClientRect().height / drag.scale}`);
          commitTableSize(drag.wrapper, drag.table, w, h);
        }
        onHtmlChange(editor.getHTML());
        drag = null;
        dom.style.cursor = "";
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    dom.addEventListener("mousedown", onDown, true);
    dom.addEventListener("touchstart", onDown as EventListener, { capture: true, passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove as EventListener, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      dom.removeEventListener("mousedown", onDown, true);
      dom.removeEventListener("touchstart", onDown as EventListener, true as unknown as EventListenerOptions);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [editor, onHtmlChange]);
};



interface Props {
  html: string;
  onChange: (html: string) => void;
  fontFamily?: string;
  fontSizePt?: number;
  onEditorReady?: (editor: any) => void;
  readOnly?: boolean;
}

const MenuBtn = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) => (
  <button type="button" title={title} onClick={onClick}
    className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${active ? "bg-slate-200 text-slate-900" : "text-slate-700 hover:bg-slate-100"}`}>
    {children}
  </button>
);

const PX_PER_MM = 3.7795275591;

export type EFormPaperSize = "A4" | "A5" | "Letter" | "Legal";
export type EFormOrientation = "portrait" | "landscape";
export type EFormMargins = { top: number; right: number; bottom: number; left: number };

const PAPER_MM: Record<EFormPaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 216, h: 279 },
  Legal: { w: 216, h: 356 },
};

export const getEFormPaperMm = (paperSize: EFormPaperSize, orientation: EFormOrientation) => {
  const sz = PAPER_MM[paperSize];
  return orientation === "portrait" ? { width: sz.w, height: sz.h } : { width: sz.h, height: sz.w };
};

const getEFormPageMetrics = (paperSize: EFormPaperSize, orientation: EFormOrientation, margins: EFormMargins) => {
  const paper = getEFormPaperMm(paperSize, orientation);
  const pageHpx = paper.height * PX_PER_MM;
  const contentHpx = Math.max(40, (paper.height - margins.top - margins.bottom) * PX_PER_MM);
  return { pageHpx, contentHpx };
};

/**
 * Visual pagination for the TipTap editor.
 *
 * Browser contenteditable does not understand real paper header/footer zones,
 * so a long document normally flows straight through the bottom margin into the
 * next page header. This hook measures top-level editor blocks and injects a
 * CSS-only margin before blocks that would cross the printable area. The saved
 * HTML is not modified; it only fixes the Word-like editing/preview canvas.
 */
export const useEFormVisualPagination = (
  editor: any,
  paperSize: EFormPaperSize,
  orientation: EFormOrientation,
  margins: EFormMargins,
  setPages: (pages: number) => void,
) => {
  const styleRef = useRef<HTMLStyleElement>(null);
  const scopeClassRef = useRef(`eform-paged-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const scopeClass = scopeClassRef.current;
    dom.classList.add(scopeClass);
    return () => {
      dom.classList.remove(scopeClass);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const styleEl = styleRef.current;
    if (!styleEl) return;

    const metrics = getEFormPageMetrics(paperSize, orientation, margins);
    dom.style.minHeight = `${metrics.contentHpx}px`;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { pageHpx, contentHpx } = getEFormPageMetrics(paperSize, orientation, margins);
        const scopeClass = scopeClassRef.current;
        const rules: string[] = [];
        const clone = dom.cloneNode(true) as HTMLElement;
        clone.classList.remove(scopeClass);
        clone.removeAttribute("contenteditable");
        clone.style.cssText = dom.style.cssText;
        clone.style.position = "fixed";
        clone.style.left = "-10000px";
        clone.style.top = "0";
        clone.style.width = `${dom.offsetWidth}px`;
        clone.style.height = "auto";
        clone.style.visibility = "hidden";
        clone.style.pointerEvents = "none";
        clone.style.transform = "none";
        clone.style.zIndex = "-1";
        document.body.appendChild(clone);

        const children = Array.from(clone.children) as HTMLElement[];
        let accumulatedGap = 0;
        let measuredBottom = Math.max(0, clone.scrollHeight);
        const EPS = 2;

        children.forEach((child, index) => {
          const height = child.offsetHeight;
          if (!height) return;

          let top = child.offsetTop + accumulatedGap;
          const pageIndex = Math.max(0, Math.floor((top + EPS) / pageHpx));
          const pageTop = pageIndex * pageHpx;
          const printableBottom = pageTop + contentHpx;
          const nextPrintableTop = (pageIndex + 1) * pageHpx;
          const startsAtPrintableTop = Math.abs(top - pageTop) <= EPS;

          let gap = 0;
          // Block already landed in footer/top-margin dead zone → push to next page.
          if (top >= printableBottom - EPS && top < nextPrintableTop - EPS) {
            gap = nextPrintableTop - top;
          // Block would cross the printable bottom → move it as a whole, like Word keeps a line/table row off the footer.
          } else if (top + height > printableBottom + EPS && !startsAtPrintableTop) {
            gap = nextPrintableTop - top;
          }

          if (gap > EPS) {
            const roundedGap = Math.ceil(gap);
            rules.push(`.${scopeClass} > :nth-child(${index + 1}) { margin-top: ${roundedGap}px !important; }`);
            accumulatedGap += roundedGap;
            top += roundedGap;
          }

          measuredBottom = Math.max(measuredBottom, top + height, clone.scrollHeight + accumulatedGap);
        });

        clone.remove();

        const nextPages = Math.max(1, Math.floor(Math.max(0, measuredBottom - EPS) / pageHpx) + 1);
        setPages(nextPages);
        const nextCss = rules.join("\n");
        if (styleEl.textContent !== nextCss) styleEl.textContent = nextCss;
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(dom);
    editor.on("update", measure);
    editor.on("transaction", measure);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      editor.off("update", measure);
      editor.off("transaction", measure);
      window.removeEventListener("resize", measure);
      styleEl.textContent = "";
    };
  }, [editor, paperSize, orientation, margins.top, margins.right, margins.bottom, margins.left, setPages]);

  return styleRef;
};

const EFormRichEditor = ({ html, onChange, fontFamily = 'Sarabun', fontSizePt: initialSize = 16, onEditorReady, readOnly = false }: Props) => {
  const [fontSizePt, setFontSizePt] = useState<number>(initialSize);
  const [pages, setPages] = useState<number>(1);
  const [margins, setMargins] = useState<EFormMargins>({ top: 25, right: 20, bottom: 20, left: 30 });
  const [paperSize, setPaperSize] = useState<EFormPaperSize>("A4");
  const [orientation, setOrientation] = useState<EFormOrientation>("portrait");
  const [zoom, setZoom] = useState<number>(0);
  const readOnlyRef = useRef(readOnly);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const lastSelectionRef = useRef<any>(null);
  const { info: schoolInfo } = useSchoolReport();
  const schoolAssetCSS = buildSchoolAssetOverlayCSS(schoolInfo);

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ paragraph: false, heading: false }),
      EFormParagraph,
      EFormHeading,
      Underline,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-blue-600 underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      EFormTextStyle,
      EFormFontSize,
      FontFamily,
      Color,
      ResizableImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { style: "max-width:100%;height:auto;" } }),
      EFormTable.configure({ resizable: true, renderWrapper: true, handleWidth: 6, cellMinWidth: 25, HTMLAttributes: { class: "eform-table", style: "border-collapse:collapse;" } }),
      EFormTableRow,
      EFormTableHeader,
      EFormTableCell.configure({ HTMLAttributes: { style: "border:1px solid #333;padding:6px;min-width:40px;vertical-align:top;" } }),
      EFormFieldToken,
      EFormDiv,
    ],
    content: normalizeEditorHtml(html),
    editorProps: {
      attributes: {
        class: "eform-editor eform-preview-page max-w-none focus:outline-none bg-white text-black",
        style: `position:relative;font-family:'${fontFamily}','Sarabun',sans-serif;font-size:${Math.round((initialSize || 16) * 4 / 3)}px;line-height:1.5;min-height:252mm;overflow-wrap:break-word;`,
      },
      handleKeyDown: (_view, event) => {
        if (readOnlyRef.current) return false;
        if ((event.key === "Delete" || event.key === "Backspace") && handleEFormTableDelete(editorRef.current, true)) {
          event.preventDefault();
          return true;
        }
        if (event.key !== "Tab") return false;
        const ed = editorRef.current;
        if (!ed) return false;
        if (ed.isActive("table")) return false;
        if (ed.isActive("listItem") || ed.isActive("taskItem")) {
          event.preventDefault();
          if (event.shiftKey) ed.chain().focus().liftListItem("listItem").run();
          else ed.chain().focus().sinkListItem("listItem").run();
          return true;
        }
        event.preventDefault();
        if (event.shiftKey) return true;
        ed.chain().focus().insertContent("\u00a0\u00a0\u00a0\u00a0").run();
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      if (!readOnlyRef.current) onChange(editor.getHTML());
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    readOnlyRef.current = readOnly;
    editor?.setEditable(!readOnly);
    const dom = editor?.view.dom as HTMLElement | undefined;
    dom?.classList.toggle("eform-editor-readonly", readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
    return () => { if (onEditorReady) onEditorReady(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // sync เนื้อหาเข้า editor เมื่อเปิด eform ใหม่/เปลี่ยน template (ไม่งั้นจะค้างของเก่า หรือว่างตอนเปิดครั้งแรก)
  useEffect(() => {
    if (!editor) return;
    const incoming = normalizeEditorHtml(html || "");
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming || "<p></p>", { emitUpdate: false });
    }
     
  }, [html, editor]);



  // ตั้งฟอนต์ default ของหน้าเอกสารเพียงครั้งเดียวจากค่าเริ่มต้นของ template
  // อย่า sync จาก fontSizePt (ของ toolbar) เพราะจะทำให้ "เปลี่ยนทั้งเอกสาร" ตอนผู้ใช้แค่อยากเปลี่ยนเฉพาะที่คลุมดำ
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    dom.style.fontSize = `${Math.round((initialSize || 16) * 4 / 3)}px`;
    dom.style.lineHeight = "1.5";
  }, [editor, initialSize]);

  // จำ selection ล่าสุดไว้ เพื่อให้การพิมพ์เลขขนาดฟอนต์ใน toolbar ยังปรับเฉพาะข้อความที่คลุมดำเหมือน Word/Docs
  useEffect(() => {
    if (!editor) return;
    const remember = () => { lastSelectionRef.current = editor.state.selection; };
    remember();
    editor.on("selectionUpdate", remember);
    editor.on("focus", remember);
    return () => {
      editor.off("selectionUpdate", remember);
      editor.off("focus", remember);
    };
  }, [editor]);

  // ตั้งขนาดให้เฉพาะข้อความที่คลุมดำ (หรือ caret สำหรับการพิมพ์ครั้งต่อไป) ผ่าน TextStyle mark
  const applyFontSize = (size: number) => {
    setFontSizePt(size);
    if (!editor) return;
    const remembered = lastSelectionRef.current;
    if (!editor.isFocused && remembered) {
      try {
        if (remembered.from >= 0 && remembered.to <= editor.state.doc.content.size) {
          editor.view.dispatch(editor.state.tr.setSelection(remembered));
        }
      } catch {
        // ถ้า selection เก่าถูกเปลี่ยนระหว่างแก้เอกสาร ให้ใช้ selection ปัจจุบันแทน
      }
    }
    (editor.chain().focus() as any).setFontSize(`${Math.round(size * 4 / 3)}px`).run();
  };

  const applyFontFamily = (nextFontFamily: string) => {
    if (!editor) return;
    const remembered = lastSelectionRef.current;
    if (!editor.isFocused && remembered) {
      try {
        if (remembered.from >= 0 && remembered.to <= editor.state.doc.content.size) {
          editor.view.dispatch(editor.state.tr.setSelection(remembered));
        }
      } catch {
        // ถ้า selection เก่าถูกเปลี่ยนระหว่างแก้เอกสาร ให้ใช้ selection ปัจจุบันแทน
      }
    }
    editor.chain().focus().setFontFamily(nextFontFamily).run();
  };

  // sync ตัวเลขใน toolbar ให้ตรงกับขนาดจริงที่ตำแหน่ง cursor
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const attrs = getActiveTextStyleAttrs(editor);
      const raw: string | undefined = attrs?.fontSize;
      if (raw) {
        const px = parseFloat(raw);
        if (!Number.isNaN(px) && Math.round(px * 3 / 4) !== fontSizePt) setFontSizePt(Math.round(px * 3 / 4));
        return;
      }
      // ไม่มี mark → อ่านขนาดจริงจาก DOM ที่ caret
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const el = (node?.nodeType === 1 ? node : node?.parentElement) as HTMLElement | null;
      if (el && editor.view.dom.contains(el)) {
        const px = parseFloat(window.getComputedStyle(el).fontSize);
        if (!Number.isNaN(px) && Math.round(px * 3 / 4) !== fontSizePt) setFontSizePt(Math.round(px * 3 / 4));
      }
    };
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    return () => { editor.off("selectionUpdate", sync); editor.off("transaction", sync); };
  }, [editor, fontSizePt]);

  const paginationStyleRef = useEFormVisualPagination(editor, paperSize, orientation, margins, setPages);

  useEFormTableResize(readOnly ? null : editor, onChange);


  const insertImageFromFile = (file: File) => {
    if (!editor) return;
    if (!file.type.startsWith("image/")) { toast.error("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("รูปต้องไม่เกิน 5MB"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result || "");
      if (!src) return;
      const { width: pwMm } = getEFormPaperMm(paperSize, orientation);
      const maxPx = paperContentMaxPx(pwMm, margins.left, margins.right);
      const attrs = await fitImageAttrs(src, maxPx);
      escapeCurrentTable(editor);
      editor.chain().focus().setImage(attrs as any).run();
    };
    reader.readAsDataURL(file);
  };
  const insertImageFromUrl = async () => {
    if (!editor) return;
    const url = prompt("วาง URL รูปภาพ");
    if (!url) return;
    const { width: pwMm } = getEFormPaperMm(paperSize, orientation);
    const maxPx = paperContentMaxPx(pwMm, margins.left, margins.right);
    const attrs = await fitImageAttrs(url, maxPx);
    escapeCurrentTable(editor);
    editor.chain().focus().setImage(attrs as any).run();
  };
  const insertTextBox = () => {
    if (!editor) return;
    escapeCurrentTable(editor);
    editor.chain().focus().insertContent(`<table style="border-collapse:collapse;width:60%;margin:11px 0;"><tbody><tr><td style="border:1.5px solid #333;padding:10px;min-height:40px;vertical-align:top;">กล่องข้อความ — พิมพ์ที่นี่</td></tr></tbody></table><p></p>`).run();
  };
  const insertTable = () => {
    if (!editor) return;
    escapeCurrentTable(editor);
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run();
  };

  if (!editor) return null;

  return (
    <div className={`flex flex-col h-full ${readOnly ? "bg-slate-100" : "bg-card border rounded-md overflow-hidden"}`}>
      {!readOnly && (
        <EFormWordToolbar
          editor={editor}
          fontSizePt={fontSizePt}
          onFontSizeChange={applyFontSize}
          onFontFamilyChange={applyFontFamily}
          onInsertImage={insertImageFromFile}
          onInsertImageUrl={insertImageFromUrl}
          onInsertTextBox={insertTextBox}
          onInsertTable={insertTable}
          margins={margins}
          onMarginsChange={setMargins}
          paperSize={paperSize}
          onPaperSizeChange={setPaperSize}
          orientation={orientation}
          onOrientationChange={setOrientation}
          zoom={zoom}
          onZoomChange={setZoom}
        />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImageFromFile(f); e.target.value = ""; }} />

      {(() => {
        const { width: pw, height: ph } = getEFormPaperMm(paperSize, orientation);
        return (
          <EFormPageCanvas
            pages={pages}
            margins={margins}
            paperWidthMm={pw}
            paperHeightMm={ph}
            zoom={zoom > 0 ? zoom : undefined}
            pageStyle={{ ...(EFORM_PAGE_STYLE as any), padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm` }}
          >
            {schoolAssetCSS && <style>{schoolAssetCSS}</style>}
            <style ref={paginationStyleRef} />
            <EditorContent editor={editor} />
          </EFormPageCanvas>
        );
      })()}
      {/* Word-like status bar */}
      {!readOnly && (
        <div className="border-t bg-slate-50 px-3 py-1 flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-3">
            <span>หน้า: <b>{pages}</b></span>
            <span>คำ: <b>{(editor.getText().trim().match(/\S+/g) || []).length}</b></span>
            <span>ตัวอักษร: <b>{editor.getText().length}</b></span>
          </div>
          <div>ซูม: <b>{zoom > 0 ? `${Math.round(zoom * 100)}%` : "พอดี"}</b></div>
        </div>
      )}
    </div>
  );
};

export default EFormRichEditor;
