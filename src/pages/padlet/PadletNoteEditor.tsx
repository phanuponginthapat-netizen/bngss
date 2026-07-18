import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useEffect } from "react";
import {
  Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Highlighter, Heading2, Quote
} from "lucide-react";

const btn = "p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors";
const btnActive = "bg-primary/15 text-primary";

function ToolBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} className={`${btn} ${active ? btnActive : ""}`}>
      {children}
    </button>
  );
}

const COLORS = ["#111827", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function PadletNoteEditor({
  content, onChange, placeholder = "พิมพ์ข้อความ...",
}: { content: string; onChange: (html: string) => void; placeholder?: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: "text-blue-700 underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content: content || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[110px] p-3 focus:outline-none",
        "data-placeholder": placeholder,
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) editor.commands.setContent(content || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("URL");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  };

  return (
    <div className="border rounded-md bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-slate-50 px-2 py-1">
        <ToolBtn title="ตัวหนา" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="ตัวเอียง" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="ขีดเส้นใต้" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="ขีดฆ่า" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-3.5 h-3.5" /></ToolBtn>
        <span className="w-px h-4 bg-slate-300 mx-0.5" />
        <ToolBtn title="หัวข้อ" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="อ้างอิง" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="รายการ" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="รายการเลข" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></ToolBtn>
        <span className="w-px h-4 bg-slate-300 mx-0.5" />
        <ToolBtn title="ชิดซ้าย" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="กึ่งกลาง" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="ชิดขวา" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="w-3.5 h-3.5" /></ToolBtn>
        <span className="w-px h-4 bg-slate-300 mx-0.5" />
        <ToolBtn title="ไฮไลต์" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}><Highlighter className="w-3.5 h-3.5" /></ToolBtn>
        <ToolBtn title="ลิงก์" active={editor.isActive("link")} onClick={addLink}><LinkIcon className="w-3.5 h-3.5" /></ToolBtn>
        <span className="w-px h-4 bg-slate-300 mx-0.5" />
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            title={`สี ${c}`}
            onClick={() => editor.chain().focus().setColor(c).run()}
            className="w-4 h-4 rounded-full border border-slate-300 mx-0.5"
            style={{ background: c }}
          />
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export function padletNoteEditorEmpty(html: string) {
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped.length === 0;
}
