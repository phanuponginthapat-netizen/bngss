import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCmsSettingsBulk } from "@/hooks/useCmsSettings";
import { X } from "lucide-react";

/**
 * ป็อปอัพแจ้งเหตุการณ์สำคัญบนหน้าแรก
 * ตั้งค่าผ่าน CMS keys:
 *  - popup_enabled ("true"/"false")
 *  - popup_id           (เปลี่ยนค่าเพื่อ "reset" ให้แสดงใหม่ทุกคน)
 *  - popup_title
 *  - popup_image        (URL)
 *  - popup_content      (HTML)
 *  - popup_button_text
 *  - popup_button_url
 *  - popup_expires_at   (ISO date; ถ้าเกินจะไม่แสดง)
 *  - popup_frequency    ("once" = ครั้งเดียวตลอด, "session" = ครั้งเดียวต่อ session, "always" = ทุกครั้ง)
 */
export default function HomepagePopup() {
  const { data: settings = {} } = useCmsSettingsBulk();
  const [open, setOpen] = useState(false);

  const get = (k: string, d = "") => settings[k] || d;

  const enabled = get("popup_enabled", "false") === "true";
  const popupId = get("popup_id", "default");
  const expiresAt = get("popup_expires_at");
  const frequency = get("popup_frequency", "session");

  useEffect(() => {
    if (!enabled) return;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return;

    const storageKey = `cms_popup_seen_${popupId}`;
    if (frequency === "once" && localStorage.getItem(storageKey)) return;
    if (frequency === "session" && sessionStorage.getItem(storageKey)) return;

    // เปิดหลังโหลดหน้า 800ms ให้เนื้อหาหลักเรนเดอร์ก่อน
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [enabled, popupId, expiresAt, frequency]);

  const handleClose = () => {
    setOpen(false);
    const storageKey = `cms_popup_seen_${popupId}`;
    if (frequency === "once") localStorage.setItem(storageKey, "1");
    else if (frequency === "session") sessionStorage.setItem(storageKey, "1");
  };

  if (!enabled) return null;

  const title = get("popup_title", "ประกาศสำคัญ");
  const image = get("popup_image");
  const content = get("popup_content");
  const btnText = get("popup_button_text");
  const btnUrl = get("popup_button_url");
  const isExternal = btnUrl && /^https?:\/\//i.test(btnUrl);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border-[#fecaca]/40 shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center transition-all"
          aria-label="ปิด"
        >
          <X className="w-4 h-4" />
        </button>
        {image && (
          <div className="w-full max-h-64 overflow-hidden bg-muted">
            <img src={image} alt={title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 space-y-4">
          <DialogTitle className="text-2xl font-bold text-foreground">{title}</DialogTitle>
          {content && (
            <DialogDescription asChild>
              <div
                className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none [&_a]:text-primary [&_img]:rounded-lg [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(content, {
                    ADD_TAGS: ["iframe"],
                    ADD_ATTR: ["target", "allow", "allowfullscreen"],
                  }),
                }}
              />
            </DialogDescription>
          )}
          {btnText && btnUrl && (
            <div className="flex justify-end pt-2">
              {isExternal ? (
                <a href={btnUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="rounded-full px-6 shadow-lg">{btnText}</Button>
                </a>
              ) : (
                <Link to={btnUrl} onClick={handleClose}>
                  <Button className="rounded-full px-6 shadow-lg">{btnText}</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
