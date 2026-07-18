import { useRef, useEffect, useState } from "react";

interface EmbedRendererProps {
  html: string;
  className?: string;
}

const isFullHtml = (content: string) => {
  const trimmed = content.trim();
  return trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML");
};

const EmbedRenderer = ({ html, className }: EmbedRendererProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    // Auto-resize iframe to content height
    const resize = () => {
      if (doc.body) {
        const newHeight = Math.max(doc.body.scrollHeight, 200);
        setHeight(newHeight);
      }
    };

    // Wait for content to load then resize
    const timer = setTimeout(resize, 500);
    const observer = new MutationObserver(resize);
    if (doc.body) observer.observe(doc.body, { childList: true, subtree: true, attributes: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className={className || "w-full border-0"}
      style={{ height: `${height}px`, minHeight: "200px" }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      title="Embedded content"
    />
  );
};

export { isFullHtml };
export default EmbedRenderer;
