import { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import JoditEditor from "jodit-react";

/**
 * MS-Word-like editor built on Jodit.
 *  - A4 page inside an iframe (real page size, margins, ruler-like)
 *  - Full Ribbon-style toolbar (Home / Insert / Layout / Review / View)
 *  - Thai fonts default (Sarabun/TH Sarabun New/IBM Plex Sans Thai)
 *  - Word-count / char-count in status bar
 *  - Zoom via toolbar (Jodit built-in)
 */

export interface JoditDocEditorHandle {
  getHtml: () => string;
  setHtml: (html: string) => void;
  focus: () => void;
}

interface Props {
  value?: string;
  onChange?: (html: string) => void;
  pageSize?: "A4" | "Letter";
  minHeight?: number;
  placeholder?: string;
  /** Extra buttons or custom Ribbon items appended after built-in set. */
  extraButtons?: any[];
}

const A4 = { w: "21cm", h: "29.7cm", pad: "2.54cm" };
const LT = { w: "21.59cm", h: "27.94cm", pad: "2.54cm" };

/** Word-like Ribbon layout condensed into Jodit's flat toolbar. Ordered for familiarity. */
const RIBBON_BUTTONS = [
  // Home
  "undo", "redo", "|",
  "paste", "copyformat", "|",
  "font", "fontsize", "paragraph", "|",
  "bold", "italic", "underline", "strikethrough", "|",
  "superscript", "subscript", "|",
  "brush", "|",
  "ul", "ol", "outdent", "indent", "|",
  "left", "center", "right", "justify", "|",
  "\n",
  // Insert
  "table", "image", "video", "file", "link", "hr", "symbols", "|",
  // Layout / Review / View
  "align", "lineHeight", "|",
  "spellcheck", "find", "|",
  "print", "preview", "fullsize", "|",
  "source",
];

export const JoditDocEditor = forwardRef<JoditDocEditorHandle, Props>(function JoditDocEditor(
  { value = "", onChange, pageSize = "A4", minHeight = 800, placeholder, extraButtons = [] },
  ref,
) {
  const editorRef = useRef<any>(null);
  const page = pageSize === "A4" ? A4 : LT;

  const config = useMemo(
    () => ({
      readonly: false,
      placeholder: placeholder ?? "เริ่มพิมพ์เอกสารของคุณที่นี่…",
      language: "en", // Jodit ships English UI; Thai locale not bundled — keep neutral labels
      theme: "default",
      toolbarButtonSize: "middle" as const,
      toolbarSticky: true,
      toolbarAdaptive: false,
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      defaultActionOnPaste: "insert_only_text" as any,
      processPasteFromWord: true,
      enter: "P" as const,
      minHeight,
      iframe: true,
      iframeStyle: `
        html, body { background:#f3f4f6; margin:0; padding:0; }
        body {
          font-family: 'Sarabun', 'TH Sarabun New', 'IBM Plex Sans Thai', Arial, sans-serif;
          font-size: 16px; color:#111827; line-height:1.6;
        }
        .page {
          background:#fff; width:${page.w}; min-height:${page.h};
          padding:${page.pad}; margin:16px auto;
          box-shadow: 0 4px 16px rgba(0,0,0,.12);
          box-sizing:border-box;
        }
        table { border-collapse:collapse; }
        table td, table th { border:1px solid #94a3b8; padding:6px 10px; }
        img { max-width:100%; }
        h1{font-size:24pt} h2{font-size:20pt} h3{font-size:16pt}
        @media print { .page{box-shadow:none;margin:0;} html,body{background:#fff;} }
      `,
      iframeCSSLinks: [],
      controls: {
        font: {
          list: {
            "'Sarabun', sans-serif": "Sarabun",
            "'TH Sarabun New', serif": "TH Sarabun New",
            "'IBM Plex Sans Thai', sans-serif": "IBM Plex Sans Thai",
            "'Kanit', sans-serif": "Kanit",
            "'Prompt', sans-serif": "Prompt",
            "'Noto Sans Thai', sans-serif": "Noto Sans Thai",
            "Arial, sans-serif": "Arial",
            "'Times New Roman', serif": "Times New Roman",
            "Georgia, serif": "Georgia",
            "'Courier New', monospace": "Courier New",
          },
        },
        fontsize: {
          list: ["10", "11", "12", "14", "16", "18", "20", "22", "24", "28", "32", "36", "48", "60", "72"],
        },
      },
      buttons: [...RIBBON_BUTTONS, ...extraButtons],
      buttonsMD: [...RIBBON_BUTTONS, ...extraButtons],
      buttonsSM: [...RIBBON_BUTTONS, ...extraButtons],
      buttonsXS: RIBBON_BUTTONS,
      statusbar: true,
      showCharsCounter: true,
      showWordsCounter: true,
      showXPathInStatusbar: false,
      spellcheck: true,
      uploader: { insertImageAsBase64URI: true },
      table: { selectionCellStyle: "border: 1px double #1d4ed8 !important;" },
    }),
    [page.h, page.w, page.pad, minHeight, placeholder, extraButtons],
  );

  // Wrap content in a `.page` so it looks like MS Word page inside the iframe.
  const wrapped = useMemo(() => {
    const html = value ?? "";
    if (html.includes('class="page"')) return html;
    return `<div class="page">${html || "<p><br/></p>"}</div>`;
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => {
        const j = editorRef.current;
        const raw = j?.value ?? "";
        // Strip the outer .page wrapper so callers get clean body HTML
        const m = raw.match(/<div class="page">([\s\S]*)<\/div>\s*$/);
        return m ? m[1] : raw;
      },
      setHtml: (html: string) => {
        if (editorRef.current) editorRef.current.value = `<div class="page">${html}</div>`;
      },
      focus: () => editorRef.current?.focus?.(),
    }),
    [],
  );

  // Inject wrapper on external value change
  useEffect(() => {
    if (editorRef.current && editorRef.current.value !== wrapped) {
      editorRef.current.value = wrapped;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapped]);

  return (
    <div className="jodit-word-shell">
      <JoditEditor
        ref={editorRef}
        value={wrapped}
        config={config as any}
        onBlur={(newContent) => onChange?.(newContent)}
        onChange={() => {
          /* keep uncontrolled between renders; onBlur flushes */
        }}
      />
      <style>{`
        .jodit-word-shell .jodit-container { border-radius: 8px; overflow: hidden; }
        .jodit-word-shell .jodit-toolbar__box { background: hsl(var(--card)); }
        .jodit-word-shell .jodit-workplace { background: #f3f4f6; }
      `}</style>
    </div>
  );
});
