import type { Editor } from "@tiptap/react";

type TableTarget = {
  pos: number;
  node: any;
  tableEl: HTMLTableElement | null;
  wrapperEl: HTMLElement | null;
};

export const mergeInlineStyle = (style: string | null | undefined, patch: Record<string, string | null>) => {
  const entries = new Map<string, string>();
  (style || "").split(";").forEach((part) => {
    const [rawKey, ...rawValue] = part.split(":");
    const key = rawKey?.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (key && value) entries.set(key, value);
  });
  Object.entries(patch).forEach(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey) return;
    if (value === null) entries.delete(normalizedKey);
    else entries.set(normalizedKey, value);
  });
  return Array.from(entries.entries()).map(([key, value]) => `${key}: ${value}`).join("; ");
};

const getDomForTable = (editor: Editor, pos: number) => {
  const nodeDom = editor.view.nodeDOM(pos) as HTMLElement | null;
  const tableEl = nodeDom?.tagName === "TABLE"
    ? (nodeDom as HTMLTableElement)
    : (nodeDom?.querySelector?.("table") as HTMLTableElement | null) || null;
  const wrapperEl = (nodeDom?.classList?.contains("tableWrapper")
    ? nodeDom
    : tableEl?.closest?.(".tableWrapper")) as HTMLElement | null;
  return { tableEl, wrapperEl };
};

export const findActiveTable = (editor: Editor): TableTarget | null => {
  const { state } = editor;
  const { $from, from, to } = state.selection;

  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      const pos = $from.before(depth);
      return { pos, node, ...getDomForTable(editor, pos) };
    }
  }

  let found: { pos: number; node: any } | null = null;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === "table") {
      found = { pos, node };
      return false;
    }
    return true;
  });
  const table = found as { pos: number; node: any } | null;
  if (!table) return null;
  return { ...table, ...getDomForTable(editor, table.pos) };
};

export const findTableByDOM = (editor: Editor, target: HTMLElement): TableTarget | null => {
  let found: { pos: number; node: any } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found || node.type.name !== "table") return !found;
    const nodeDom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (nodeDom && (nodeDom === target || nodeDom.contains(target) || target.contains(nodeDom))) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  const table = found as { pos: number; node: any } | null;
  if (!table) return null;
  return { ...table, ...getDomForTable(editor, table.pos) };
};

const measuredColumnWidths = (tableEl: HTMLTableElement | null) => {
  const widths: number[] = [];
  const row = Array.from(tableEl?.rows || []).find((r) => r.cells.length > 0);
  if (!row) return widths;
  Array.from(row.cells).forEach((cell) => {
    const span = Math.max(1, cell.colSpan || 1);
    const perColumn = Math.max(30, cell.getBoundingClientRect().width / span);
    for (let i = 0; i < span; i++) widths.push(Math.round(perColumn));
  });
  return widths;
};

const collectBaseColumnWidths = (tableNode: any, tableEl: HTMLTableElement | null) => {
  const measured = measuredColumnWidths(tableEl);
  const widths: number[] = [];
  let inFirstRow = false;
  let finishedFirstRow = false;
  let colCursor = 0;

  tableNode.descendants((node: any) => {
    if (finishedFirstRow) return false;
    if (node.type.name === "tableRow") {
      if (!inFirstRow) {
        inFirstRow = true;
        colCursor = 0;
        return true;
      }
      finishedFirstRow = true;
      return false;
    }
    if (!inFirstRow || (node.type.name !== "tableCell" && node.type.name !== "tableHeader")) return true;

    const span = Math.max(1, node.attrs.colspan || 1);
    const existing = Array.isArray(node.attrs.colwidth) ? node.attrs.colwidth : [];
    for (let i = 0; i < span; i++) {
      const fromAttr = Number(existing[i]);
      widths[colCursor + i] = Number.isFinite(fromAttr) && fromAttr > 0
        ? fromAttr
        : measured[colCursor + i] || 100;
    }
    colCursor += span;
    return false;
  });

  return (widths.length ? widths : measured).map((width) => Math.max(30, Math.round(width || 100)));
};

export const setTableColumnWidths = (
  editor: Editor,
  target: TableTarget,
  nextWidths: number[],
  nextHeight?: number,
) => {
  if (!target.node || target.pos < 0 || !nextWidths.length) return false;

  let tr = editor.state.tr;
  const totalWidth = Math.max(60, Math.round(nextWidths.reduce((sum, width) => sum + width, 0)));
  const tableStyle = mergeInlineStyle(target.node.attrs.style || target.tableEl?.getAttribute("style"), {
    "border-collapse": "collapse",
    "table-layout": "fixed",
    width: `${totalWidth}px`,
    ...(nextHeight ? { height: `${Math.max(40, Math.round(nextHeight))}px` } : {}),
  });

  tr = tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, style: tableStyle || null });

  let colCursor = 0;
  target.node.descendants((node: any, offset: number) => {
    if (node.type.name === "tableRow") {
      colCursor = 0;
      return true;
    }
    if (node.type.name !== "tableCell" && node.type.name !== "tableHeader") return true;

    const span = Math.max(1, node.attrs.colspan || 1);
    const colwidth = Array.from({ length: span }, (_, index) => Math.max(30, Math.round(nextWidths[colCursor + index] || 100)));
    tr = tr.setNodeMarkup(target.pos + 1 + offset, undefined, { ...node.attrs, colwidth });
    colCursor += span;
    return false;
  });

  editor.view.dispatch(tr);

  if (target.tableEl) {
    target.tableEl.style.width = `${totalWidth}px`;
    target.tableEl.style.tableLayout = "fixed";
    if (nextHeight) target.tableEl.style.height = `${Math.max(40, Math.round(nextHeight))}px`;
  }
  if (target.wrapperEl) {
    target.wrapperEl.style.width = `${totalWidth}px`;
    if (nextHeight) target.wrapperEl.style.height = `${Math.max(40, Math.round(nextHeight))}px`;
  }
  return true;
};

export const scaleActiveTable = (editor: Editor, factor: number) => {
  const target = findActiveTable(editor);
  if (!target) return false;
  const baseWidths = collectBaseColumnWidths(target.node, target.tableEl);
  const nextWidths = baseWidths.map((width) => Math.max(30, Math.round(width * factor)));
  const changed = setTableColumnWidths(editor, target, nextWidths);
  editor.view.focus();
  return changed;
};

export const resizeTableToWidth = (editor: Editor, tableEl: HTMLTableElement, width: number, height?: number) => {
  const target = findTableByDOM(editor, tableEl);
  if (!target) return false;
  const baseWidths = collectBaseColumnWidths(target.node, target.tableEl || tableEl);
  const currentTotal = Math.max(1, baseWidths.reduce((sum, columnWidth) => sum + columnWidth, 0));
  const factor = Math.max(0.05, width / currentTotal);
  const nextWidths = baseWidths.map((columnWidth) => Math.max(30, Math.round(columnWidth * factor)));
  return setTableColumnWidths(editor, target, nextWidths, height);
};