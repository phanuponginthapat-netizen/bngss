import Image from "@tiptap/extension-image";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";

const toCssSize = (value: unknown) => {
  if (value == null || value === "") return null;
  if (typeof value === "number") return `${value}px`;
  const s = String(value).trim();
  if (!s) return null;
  return /^\d+(?:\.\d+)?$/.test(s) ? `${s}px` : s;
};

/**
 * ResizableImage
 * - Inline mode (default): image sits in text flow, with optional float left/right.
 * - Free mode ("อยู่หน้าข้อความ"): image becomes position:absolute and can be
 *   dragged anywhere on the page without affecting text layout — like
 *   Word's "In Front of Text" wrap.
 */
export const ResizableImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      width:  { default: null,
        parseHTML: (el) => (el as HTMLElement).style.width || el.getAttribute("width") || null,
        renderHTML: (attrs) => {
          const width = toCssSize(attrs.width);
          return width ? { style: `width: ${width}` } : {};
        } },
      height: { default: null,
        parseHTML: (el) => (el as HTMLElement).style.height || el.getAttribute("height") || null,
        renderHTML: (attrs) => {
          const height = toCssSize(attrs.height);
          return height ? { style: `height: ${height}` } : {};
        } },
      float:  { default: "none",
        parseHTML: (el) => (el as HTMLElement).style.float || "none",
        renderHTML: () => ({}) },
      align:  { default: "left",
        parseHTML: (el) => el.getAttribute("data-align") || "left",
        renderHTML: (attrs) => ({ "data-align": attrs.align }) },
      floatMode: { default: "inline",
        parseHTML: (el) => el.getAttribute("data-float-mode") || "inline",
        renderHTML: (attrs) => ({ "data-float-mode": attrs.floatMode || "inline" }) },
      x: { default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-x")) || 0,
        renderHTML: (attrs) => ({ "data-x": String(attrs.x ?? 0) }) },
      y: { default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-y")) || 0,
        renderHTML: (attrs) => ({ "data-y": String(attrs.y ?? 0) }) },
      rotation: { default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-rotation")) || 0,
        renderHTML: (attrs) => {
          const r = Number(attrs.rotation) || 0;
          return r ? { "data-rotation": String(r), style: `transform: rotate(${r}deg);` } : {};
        } },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrapper = document.createElement("span");
      wrapper.className = "eform-img-wrap";
      wrapper.style.lineHeight = "0";
      wrapper.style.maxWidth = "100%";

      const img = document.createElement("img");
      img.src = node.attrs.src;
      if (node.attrs.alt) img.alt = node.attrs.alt;
      img.draggable = false;
      img.style.display = "block";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.userSelect = "none";
      // Prevent the page from scrolling/pinch-zooming while the user drags
      // the resize handle or moves a free-mode image on touch devices.
      img.style.touchAction = "none";
      (wrapper.style as any).touchAction = "none";

      const applyAttrs = () => {
        const cssWidth = toCssSize(node.attrs.width);
        const cssHeight = toCssSize(node.attrs.height);
        img.style.width = cssWidth || "";
        img.style.height = cssHeight || "auto";
        // Cap explicit pixel widths at 100% of the paper so a wide image
        // never forces the page to scroll horizontally.
        img.style.maxWidth = "100%";
        const rot = Number(node.attrs.rotation) || 0;
        img.style.transform = rot ? `rotate(${rot}deg)` : "";
        img.style.transformOrigin = "center center";

        const free = node.attrs.floatMode === "free";
        if (free) {
          // Floating "in front of text" — absolute, doesn't push content
          wrapper.style.position = "absolute";
          wrapper.style.left = `${node.attrs.x || 0}px`;
          wrapper.style.top = `${node.attrs.y || 0}px`;
          wrapper.style.float = "";
          wrapper.style.margin = "0";
          wrapper.style.display = "inline-block";
          wrapper.style.zIndex = "10";
          wrapper.style.cursor = "move";
          wrapper.style.maxWidth = "none";
        } else {
          wrapper.style.position = "relative";
          wrapper.style.left = "";
          wrapper.style.top = "";
          wrapper.style.zIndex = "";
          wrapper.style.cursor = "";
          wrapper.style.float = "";
          wrapper.style.maxWidth = "100%";
          // Use block + auto margins for alignment so text never wraps around
          const align = node.attrs.align || "left";
          wrapper.style.display = "block";
          wrapper.style.width = "fit-content";
          if (align === "center") wrapper.style.margin = "8px auto";
          else if (align === "right") wrapper.style.margin = "8px 0 8px auto";
          else wrapper.style.margin = "8px auto 8px 0";
        }

      };
      applyAttrs();

      // Tap-to-select on mobile — ProseMirror sometimes ignores a plain touch
      // on an atom node, so drive the selection explicitly.
      const selectSelf = () => {
        if (typeof getPos !== "function") return;
        try {
          const pos = getPos();
          const view = (editor as any).view;
          view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
          view.focus();
        } catch {
          try { editor.chain().focus().setNodeSelection(getPos()).run(); } catch { /* noop */ }
        }
      };
      img.addEventListener("click", (e) => { e.stopPropagation(); selectSelf(); });
      img.addEventListener("touchend", (e) => {
        if ((e as TouchEvent).changedTouches.length === 1) {
          e.stopPropagation();
          selectSelf();
        }
      });


      // Resize handle (larger on touch for finger use)
      const handle = document.createElement("span");
      Object.assign(handle.style, {
        position: "absolute", right: "-14px", bottom: "-14px",
        width: "30px", height: "30px", background: "#2563eb",
        border: "3px solid #fff", borderRadius: "50%",
        boxShadow: "0 2px 6px rgba(0,0,0,.35)",
        cursor: "nwse-resize", display: "none", zIndex: "20",
        touchAction: "none",
      } as Partial<CSSStyleDeclaration>);


      // Toolbar
      const toolbar = document.createElement("span");
      Object.assign(toolbar.style, {
        position: "absolute", top: "-32px", left: "0", display: "none",
        gap: "2px", background: "#0f172a", color: "#fff",
        padding: "3px 4px", borderRadius: "6px", fontSize: "11px",
        zIndex: "30", whiteSpace: "nowrap",
      } as Partial<CSSStyleDeclaration>);

      const mkBtn = (label: string, onClick: () => void) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = label;
        Object.assign(b.style, {
          background: "transparent", color: "#fff", border: "0",
          padding: "2px 6px", cursor: "pointer", fontSize: "11px",
        } as Partial<CSSStyleDeclaration>);
        b.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
        return b;
      };

      const updateAttrs = (patch: Record<string, unknown>) => {
        if (typeof getPos !== "function") return;
        editor.chain().focus().command(({ tr }) => {
          tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, ...patch });
          return true;
        }).run();
      };

      // Size inputs (width × height) with unit selector (px / cm / %)
      const CM_TO_PX = 96 / 2.54;
      const parseSize = (v: unknown): { num: number; unit: string } | null => {
        if (v == null) return null;
        const s = String(v).trim();
        const m = s.match(/^([\d.]+)\s*(px|cm|%)?$/i);
        if (!m) return null;
        return { num: parseFloat(m[1]), unit: (m[2] || "px").toLowerCase() };
      };
      const toUnit = (px: number, unit: string) =>
        unit === "cm" ? +(px / CM_TO_PX).toFixed(2) : Math.round(px);
      const fromUnit = (val: number, unit: string) =>
        unit === "cm" ? `${val}cm` : unit === "%" ? `${val}%` : `${val}px`;

      const unitSel = document.createElement("select");
      ["px", "cm", "%"].forEach((u) => {
        const o = document.createElement("option");
        o.value = u; o.textContent = u; unitSel.appendChild(o);
      });
      Object.assign(unitSel.style, {
        background: "#1e293b", color: "#fff", border: "1px solid #334155",
        borderRadius: "4px", fontSize: "11px", padding: "1px 2px", cursor: "pointer",
      } as Partial<CSSStyleDeclaration>);

      const mkInput = (title: string) => {
        const i = document.createElement("input");
        i.type = "number"; i.step = "0.1"; i.min = "1"; i.title = title;
        Object.assign(i.style, {
          width: "52px", background: "#1e293b", color: "#fff",
          border: "1px solid #334155", borderRadius: "4px",
          fontSize: "11px", padding: "1px 4px",
        } as Partial<CSSStyleDeclaration>);
        i.onmousedown = (e) => e.stopPropagation();
        return i;
      };
      const wIn = mkInput("กว้าง");
      const hIn = mkInput("สูง");
      const lockBtn = document.createElement("button");
      lockBtn.type = "button"; lockBtn.textContent = "🔗";
      lockBtn.title = "ล็อกสัดส่วน";
      Object.assign(lockBtn.style, {
        background: "transparent", color: "#fff", border: "0",
        padding: "2px 4px", cursor: "pointer", fontSize: "11px",
      } as Partial<CSSStyleDeclaration>);
      let locked = true;
      lockBtn.onmousedown = (e) => {
        e.preventDefault(); e.stopPropagation();
        locked = !locked;
        lockBtn.textContent = locked ? "🔗" : "⛓️‍💥";
      };

      const syncInputs = () => {
        const unit = unitSel.value;
        const wPx = img.clientWidth || parseInt(String(node.attrs.width), 10) || 0;
        const hPx = img.clientHeight || parseInt(String(node.attrs.height), 10) || 0;
        const cur = parseSize(node.attrs.width);
        if (cur && cur.unit !== unit && (cur.unit === "cm" || unit === "cm" || cur.unit === "px" || unit === "px")) {
          // keep selector aligned with stored unit on first read
        }
        if (unit === "%") {
          const cur = parseSize(node.attrs.width);
          wIn.value = cur && cur.unit === "%" ? String(cur.num) : "";
          hIn.value = "";
        } else {
          wIn.value = String(toUnit(wPx, unit));
          hIn.value = String(toUnit(hPx, unit));
        }
      };

      // Initialize unit from stored value
      const initial = parseSize(node.attrs.width);
      if (initial) unitSel.value = initial.unit;

      const commitSize = (src: "w" | "h") => {
        const unit = unitSel.value;
        const ratio = (img.naturalWidth && img.naturalHeight)
          ? img.naturalHeight / img.naturalWidth
          : (img.clientHeight && img.clientWidth ? img.clientHeight / img.clientWidth : 1);
        let wv = parseFloat(wIn.value);
        let hv = parseFloat(hIn.value);
        if (unit === "%") {
          if (!wv || wv <= 0) return;
          updateAttrs({ width: `${wv}%`, height: null });
          return;
        }
        if (src === "w") {
          if (!wv || wv <= 0) return;
          if (locked) {
            const wPx = unit === "cm" ? wv * CM_TO_PX : wv;
            const hPx = wPx * ratio;
            hv = toUnit(hPx, unit);
            hIn.value = String(hv);
          }
        } else {
          if (!hv || hv <= 0) return;
          if (locked) {
            const hPx = unit === "cm" ? hv * CM_TO_PX : hv;
            const wPx = hPx / ratio;
            wv = toUnit(wPx, unit);
            wIn.value = String(wv);
          }
        }
        updateAttrs({ width: fromUnit(wv, unit), height: fromUnit(hv, unit) });
      };

      wIn.addEventListener("change", () => commitSize("w"));
      hIn.addEventListener("change", () => commitSize("h"));
      unitSel.addEventListener("change", () => syncInputs());
      unitSel.onmousedown = (e) => e.stopPropagation();

      const sep = () => {
        const s = document.createElement("span");
        s.textContent = "│";
        s.style.opacity = "0.4"; s.style.padding = "0 2px";
        return s;
      };

      const wrap1 = document.createElement("span");
      wrap1.style.display = "inline-flex";
      wrap1.style.alignItems = "center";
      wrap1.style.gap = "2px";
      const lbl = (t: string) => {
        const s = document.createElement("span");
        s.textContent = t; s.style.fontSize = "10px"; s.style.opacity = "0.8";
        return s;
      };
      wrap1.append(lbl("ก"), wIn, lbl("×"), hIn, unitSel, lockBtn);

      toolbar.append(
        mkBtn("⟸ ซ้าย", () => updateAttrs({ float: "left",  align: "left",   floatMode: "inline" })),
        mkBtn("กลาง",  () => updateAttrs({ float: "none",  align: "center", floatMode: "inline" })),
        mkBtn("ขวา ⟹", () => updateAttrs({ float: "right", align: "right",  floatMode: "inline" })),
        mkBtn("🅵 ลอยอิสระ", () => updateAttrs({ floatMode: "free", float: "none" })),
        mkBtn("ติดข้อความ", () => updateAttrs({ floatMode: "inline" })),
        sep(),
        wrap1,
        sep(),
        mkBtn("↺ 90°", () => {
          const cur = Number(node.attrs.rotation) || 0;
          updateAttrs({ rotation: ((cur - 90) % 360 + 360) % 360 });
        }),
        mkBtn("↻ 90°", () => {
          const cur = Number(node.attrs.rotation) || 0;
          updateAttrs({ rotation: (cur + 90) % 360 });
        }),
        sep(),
        mkBtn("✕", () => {
          if (typeof getPos !== "function") return;
          const pos = getPos();
          editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
        }),
      );

      // Refresh inputs once image loads (for natural ratio)
      img.addEventListener("load", () => syncInputs());
      syncInputs();

      // Resize (mouse + touch)
      let sX = 0, sY = 0, sW = 0, sH = 0;
      const pointerXY = (e: MouseEvent | TouchEvent) => {
        if ("touches" in e) {
          const t = e.touches[0] || e.changedTouches[0];
          return { x: t?.clientX ?? 0, y: t?.clientY ?? 0 };
        }
        return { x: e.clientX, y: e.clientY };
      };
      const onResize = (e: MouseEvent | TouchEvent) => {
        if ("touches" in e) e.preventDefault();
        const { x, y } = pointerXY(e);
        const dx = x - sX, dy = y - sY;
        const ratio = sH / sW;
        let w = Math.max(40, sW + dx);
        let h = Math.max(30, sH + dy);
        if ("shiftKey" in e && (e as MouseEvent).shiftKey) h = Math.round(w * ratio);
        img.style.width = `${w}px`; img.style.height = `${h}px`;
      };
      const endResize = () => {
        document.removeEventListener("mousemove", onResize as any);
        document.removeEventListener("mouseup", endResize);
        document.removeEventListener("touchmove", onResize as any);
        document.removeEventListener("touchend", endResize);
        document.removeEventListener("touchcancel", endResize);
        const unit = unitSel.value === "%" ? "px" : unitSel.value;
        if (unitSel.value === "%") unitSel.value = "px";
        const wPx = parseInt(img.style.width, 10);
        const hPx = parseInt(img.style.height, 10);
        updateAttrs({
          width: fromUnit(toUnit(wPx, unit), unit),
          height: fromUnit(toUnit(hPx, unit), unit),
        });
        syncInputs();
      };
      const startResize = (e: MouseEvent | TouchEvent) => {
        e.preventDefault(); e.stopPropagation();
        const { x, y } = pointerXY(e);
        sX = x; sY = y; sW = img.clientWidth; sH = img.clientHeight;
        if ("touches" in e) {
          document.addEventListener("touchmove", onResize as any, { passive: false });
          document.addEventListener("touchend", endResize);
          document.addEventListener("touchcancel", endResize);
        } else {
          document.addEventListener("mousemove", onResize as any);
          document.addEventListener("mouseup", endResize);
        }
      };
      handle.addEventListener("mousedown", startResize);
      handle.addEventListener("touchstart", startResize, { passive: false });

      // Free-mode drag (mouse + touch)
      let dX = 0, dY = 0, oX = 0, oY = 0;
      const onDrag = (e: MouseEvent | TouchEvent) => {
        if ("touches" in e) e.preventDefault();
        const { x, y } = pointerXY(e);
        const nx = oX + (x - dX);
        const ny = oY + (y - dY);
        wrapper.style.left = `${nx}px`;
        wrapper.style.top  = `${ny}px`;
      };
      const endDrag = () => {
        document.removeEventListener("mousemove", onDrag as any);
        document.removeEventListener("mouseup", endDrag);
        document.removeEventListener("touchmove", onDrag as any);
        document.removeEventListener("touchend", endDrag);
        document.removeEventListener("touchcancel", endDrag);
        updateAttrs({
          x: parseInt(wrapper.style.left, 10) || 0,
          y: parseInt(wrapper.style.top, 10)  || 0,
        });
      };
      const startDrag = (e: MouseEvent | TouchEvent) => {
        if (node.attrs.floatMode !== "free") return;
        const target = e.target as HTMLElement;
        if (target === handle || target.closest("button")) return;
        e.preventDefault();
        const { x, y } = pointerXY(e);
        dX = x; dY = y;
        oX = parseInt(wrapper.style.left, 10) || 0;
        oY = parseInt(wrapper.style.top, 10)  || 0;
        if ("touches" in e) {
          document.addEventListener("touchmove", onDrag as any, { passive: false });
          document.addEventListener("touchend", endDrag);
          document.addEventListener("touchcancel", endDrag);
        } else {
          document.addEventListener("mousemove", onDrag as any);
          document.addEventListener("mouseup", endDrag);
        }
      };
      wrapper.addEventListener("mousedown", startDrag);
      wrapper.addEventListener("touchstart", startDrag, { passive: false });

      const setSelected = (sel: boolean) => {
        handle.style.display = sel ? "block" : "none";
        toolbar.style.display = sel ? "inline-flex" : "none";
        wrapper.style.outline = sel ? "2px dashed #2563eb" : "";
      };

      wrapper.append(img, handle, toolbar);

      return {
        dom: wrapper,
        update: (updated) => {
          if (updated.type.name !== "image") return false;
          if (updated.attrs.src !== img.src) img.src = updated.attrs.src;
          Object.assign(node.attrs, updated.attrs);
          applyAttrs();
          return true;
        },
        selectNode: () => setSelected(true),
        deselectNode: () => setSelected(false),
        stopEvent: (event) => {
          const t = event.target as HTMLElement;
          if (t === handle || toolbar.contains(t)) return true;
          // While dragging in free mode, prevent PM from handling pointer input
          if (node.attrs.floatMode === "free" && (event.type === "mousedown" || event.type === "touchstart")) return true;
          return false;
        },
        ignoreMutation: () => true,
        destroy: () => {
          document.removeEventListener("mousemove", onResize as any);
          document.removeEventListener("mouseup", endResize);
          document.removeEventListener("touchmove", onResize as any);
          document.removeEventListener("touchend", endResize);
          document.removeEventListener("touchcancel", endResize);
          document.removeEventListener("mousemove", onDrag as any);
          document.removeEventListener("mouseup", endDrag);
          document.removeEventListener("touchmove", onDrag as any);
          document.removeEventListener("touchend", endDrag);
          document.removeEventListener("touchcancel", endDrag);
        },
      };
    };
  },

  addProseMirrorPlugins() {
    return [new Plugin({ key: new PluginKey("resizable-image-noop") })];
  },
});

export default ResizableImage;
