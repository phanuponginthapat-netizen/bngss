import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Code2 } from "lucide-react";

interface FullHtmlEditorProps {
  content: string;
  onChange: (html: string) => void;
}

const FullHtmlEditor = ({ content, onChange }: FullHtmlEditorProps) => {
  const [localContent, setLocalContent] = useState(content);
  const [tab, setTab] = useState<string>("code");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = (val: string) => {
    setLocalContent(val);
    onChange(val);
  };

  useEffect(() => {
    if (tab === "preview" && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(localContent);
        doc.close();
      }
    }
  }, [tab, localContent]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="border-b border-border bg-muted/30 px-3 py-1.5 flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="code" className="text-xs h-7 gap-1">
              <Code2 className="w-3.5 h-3.5" /> โค้ด HTML
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs h-7 gap-1">
              <Eye className="w-3.5 h-3.5" /> ตัวอย่าง
            </TabsTrigger>
          </TabsList>
          <span className="text-xs text-muted-foreground">โหมดเต็มหน้า — ใส่ HTML/CSS/JS ได้ทั้งหมด</span>
        </div>

        <TabsContent value="code" className="m-0">
          <textarea
            value={localContent}
            onChange={e => handleChange(e.target.value)}
            className="w-full min-h-[500px] p-4 font-mono text-xs bg-[hsl(var(--muted)/0.2)] text-foreground resize-y border-0 outline-none"
            placeholder={`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; padding: 20px; }
  </style>
</head>
<body>
  <h1>หน้าเว็บของฉัน</h1>
  <p>ใส่โค้ด HTML, CSS, JavaScript ได้ทั้งหมด</p>
  <script>
    console.log('Hello!');
  </script>
</body>
</html>`}
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="preview" className="m-0">
          <iframe
            ref={iframeRef}
            className="w-full min-h-[500px] border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Preview"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FullHtmlEditor;
