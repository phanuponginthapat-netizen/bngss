import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, FileCode } from "lucide-react";

interface EmbedCodeDialogProps {
  onInsert: (html: string) => void;
  triggerClassName?: string;
}

const EmbedCodeDialog = ({ onInsert, triggerClassName }: EmbedCodeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [tab, setTab] = useState("html");

  const handleInsert = () => {
    if (!code.trim()) return;

    // Wrap code in a special div with data attribute for identification
    const wrapped = `<div data-embed="true" class="my-4 rounded-lg overflow-hidden border border-border">${code}</div>`;
    onInsert(wrapped);
    setCode("");
    setOpen(false);
  };

  const presets = [
    {
      label: "Google Maps",
      code: `<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3875.5!2d100.5!3d13.75!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTPCsDQ1JzAwLjAiTiAxMDDCsDMwJzAwLjAiRQ!5e0!3m2!1sth!2sth!4v1234567890" width="100%" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`
    },
    {
      label: "YouTube Video",
      code: `<iframe width="100%" height="400" src="https://www.youtube.com/embed/VIDEO_ID" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    },
    {
      label: "Google Forms",
      code: `<iframe src="https://docs.google.com/forms/d/e/FORM_ID/viewform?embedded=true" width="100%" height="600" frameborder="0" marginheight="0" marginwidth="0">กำลังโหลด…</iframe>`
    },
    {
      label: "Google Calendar",
      code: `<iframe src="https://calendar.google.com/calendar/embed?src=YOUR_CALENDAR_ID" style="border: 0" width="100%" height="600" frameborder="0" scrolling="no"></iframe>`
    },
    {
      label: "Facebook Page Plugin",
      code: `<div class="fb-page" data-href="https://www.facebook.com/YOUR_PAGE" data-tabs="timeline" data-width="" data-height="" data-small-header="false" data-adapt-container-width="true" data-hide-cover="false" data-show-facepile="true"><blockquote cite="https://www.facebook.com/YOUR_PAGE" class="fb-xfbml-parse-ignore"></blockquote></div>\n<script async defer crossorigin="anonymous" src="https://connect.facebook.net/th_TH/sdk.js#xfbml=1&version=v18.0"></script>`
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={triggerClassName || "p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"}
          title="ฝังโค้ด HTML/JS"
        >
          <Code2 className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            ฝังโค้ด HTML / JavaScript / Plugin
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList>
            <TabsTrigger value="html">เขียนโค้ดเอง</TabsTrigger>
            <TabsTrigger value="presets">เทมเพลตสำเร็จรูป</TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label>วางโค้ด HTML, JavaScript, iframe หรือ embed code ที่นี่</Label>
              <Textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={`<iframe src="https://..." width="100%" height="400"></iframe>\n\nหรือ\n\n<script src="https://..."></script>\n<div id="widget"></div>`}
                className="font-mono text-xs min-h-[200px] bg-muted/30"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              รองรับ: iframe, embed, script, style, div และ HTML ทุกชนิด — คล้ายกับ Google Sites
            </p>
            <Button onClick={handleInsert} className="w-full">
              <Code2 className="w-4 h-4 mr-1" /> แทรกโค้ด
            </Button>
          </TabsContent>

          <TabsContent value="presets" className="space-y-3 mt-3">
            <p className="text-sm text-muted-foreground">เลือกเทมเพลต แล้วแก้ไข URL ตามต้องการ</p>
            <div className="grid gap-2">
              {presets.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className="text-left p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  onClick={() => { setCode(p.code); setTab("html"); }}
                >
                  <span className="font-medium text-sm">{p.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{p.code.substring(0, 80)}...</p>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default EmbedCodeDialog;
