import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { uploadPublicFileWithFallback } from '@/lib/uploadFallback';
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon, Video, Highlighter, Undo, Redo, Upload
} from 'lucide-react';
import EmbedCodeDialog from './EmbedCodeDialog';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const MenuButton = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded hover:bg-muted transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
  >
    {children}
  </button>
);

const RichTextEditor = ({ content, onChange }: RichTextEditorProps) => {
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false } as any),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg max-w-full mx-auto shadow-md' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { compressImage } = await import("@/lib/imageCompress");
    const compressed = await compressImage(file, { maxWidth: 1600, maxSizeKB: 200 });
    const fileName = `${Date.now()}_${compressed.name}`;
    const result = await uploadPublicFileWithFallback('cms-images', fileName, compressed);
    editor?.chain().focus().setImage({ src: result.publicUrl }).run();
    setImageDialogOpen(false);
    setUploading(false);
    toast.success(result.usedFallback ? 'เพิ่มรูปสำเร็จ (โหมดสำรอง)' : 'อัปโหลดรูปสำเร็จ');
  };

  const insertImageUrl = () => {
    if (imageUrl) {
      editor?.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setImageDialogOpen(false);
    }
  };

  const insertVideo = () => {
    if (videoUrl) {
      let embedUrl = videoUrl;
      const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
      const html = `<div class="my-4"><iframe src="${embedUrl}" width="100%" height="400" frameborder="0" allowfullscreen class="rounded-lg"></iframe></div>`;
      editor?.chain().focus().insertContent(html).run();
      setVideoUrl('');
      setVideoDialogOpen(false);
    }
  };

  const setLink = () => {
    if (linkUrl) {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkUrl('');
    setLinkDialogOpen(false);
  };

  if (!editor) return null;

  const starterKitChain = () => editor.chain().focus() as any;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="border-b border-border bg-muted/30 p-1.5 flex flex-wrap gap-0.5">
        <MenuButton onClick={() => editor.chain().focus().undo().run()} title="ย้อนกลับ"><Undo className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} title="ทำซ้ำ"><Redo className="w-4 h-4" /></MenuButton>
        <div className="w-px bg-border mx-1" />
        <MenuButton onClick={() => starterKitChain().toggleBold().run()} active={editor.isActive('bold')} title="ตัวหนา"><Bold className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => starterKitChain().toggleItalic().run()} active={editor.isActive('italic')} title="ตัวเอียง"><Italic className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="ขีดเส้นใต้"><UnderlineIcon className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => starterKitChain().toggleStrike().run()} active={editor.isActive('strike')} title="ขีดทับ"><Strikethrough className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="ไฮไลท์"><Highlighter className="w-4 h-4" /></MenuButton>
        <div className="w-px bg-border mx-1" />
        <MenuButton onClick={() => starterKitChain().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="หัวข้อ 1"><Heading1 className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => starterKitChain().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="หัวข้อ 2"><Heading2 className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => starterKitChain().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="หัวข้อ 3"><Heading3 className="w-4 h-4" /></MenuButton>
        <div className="w-px bg-border mx-1" />
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="ชิดซ้าย"><AlignLeft className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="กึ่งกลาง"><AlignCenter className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="ชิดขวา"><AlignRight className="w-4 h-4" /></MenuButton>
        <div className="w-px bg-border mx-1" />
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="รายการ"><List className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="ลำดับ"><ListOrdered className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => starterKitChain().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="อ้างอิง"><Quote className="w-4 h-4" /></MenuButton>
        <MenuButton onClick={() => starterKitChain().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="โค้ด"><Code className="w-4 h-4" /></MenuButton>
        <div className="w-px bg-border mx-1" />

        {/* Link Dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogTrigger asChild>
            <button type="button" className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('link') ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} title="ลิงก์">
              <LinkIcon className="w-4 h-4" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>เพิ่มลิงก์</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkDialogOpen(false); }}>ลบลิงก์</Button>
                <Button size="sm" onClick={setLink}>ตั้งค่า</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Image Dialog */}
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground" title="รูปภาพ">
              <ImageIcon className="w-4 h-4" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>เพิ่มรูปภาพ</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">อัปโหลดรูป</label>
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">{uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
              <div className="text-center text-xs text-muted-foreground">หรือ</div>
              <div>
                <label className="block text-sm font-medium mb-1">ใส่ URL รูปภาพ</label>
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
              </div>
              <Button size="sm" onClick={insertImageUrl} className="w-full">แทรกรูปภาพ</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Video Dialog */}
        <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
          <DialogTrigger asChild>
            <button type="button" className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground" title="วิดีโอ">
              <Video className="w-4 h-4" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>เพิ่มวิดีโอ</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="YouTube URL หรือ embed URL" />
              <Button size="sm" onClick={insertVideo} className="w-full">แทรกวิดีโอ</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Embed Code Dialog */}
        <EmbedCodeDialog
          onInsert={(html) => editor?.chain().focus().insertContent(html).run()}
          triggerClassName="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
        />
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[300px] focus-within:outline-none
          [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[280px]
          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-foreground
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground
          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground
          [&_p]:text-foreground [&_p]:leading-relaxed
          [&_img]:rounded-lg [&_img]:max-w-full [&_img]:mx-auto [&_img]:shadow-md [&_img]:cursor-pointer
          [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic
          [&_ul]:list-disc [&_ol]:list-decimal
          [&_a]:text-primary [&_a]:underline
          [&_mark]:bg-warning-soft [&_mark]:px-0.5 [&_mark]:rounded"
      />
    </div>
  );
};

export default RichTextEditor;
