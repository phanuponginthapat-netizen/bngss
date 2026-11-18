import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function ScaledSlide({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="obec-scale-container"><div className="obec-scaled" style={{ transform: `scale(${scale})` }}>{children}</div></div>;
}