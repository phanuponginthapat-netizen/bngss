import { useEffect, useLayoutEffect, useRef, useState, CSSProperties, ReactNode } from "react";

interface AutoFitTextProps {
  children: ReactNode;
  /** Maximum (preferred) font size in px */
  maxFontSize: number;
  /** Minimum font size in px we are allowed to shrink to */
  minFontSize?: number;
  /** Max number of lines allowed before shrinking. Default 2 */
  maxLines?: number;
  className?: string;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
  /** Line-height multiplier */
  lineHeight?: number;
}

/**
 * Auto-fit text: shrinks font-size until content fits inside the parent width
 * within the allowed number of lines. Re-measures on resize and content change.
 */
const AutoFitText = ({
  children,
  maxFontSize,
  minFontSize = 7,
  maxLines = 2,
  className = "",
  style,
  as: Tag = "span",
  lineHeight = 1.15,
}: AutoFitTextProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let size = maxFontSize;
    el.style.fontSize = `${size}px`;
    // Allow time to layout
    const maxHeight = maxFontSize * lineHeight * maxLines + 0.5;

    // Shrink until both width and line-count constraints fit
    let guard = 40;
    while (guard-- > 0 && size > minFontSize) {
      const overflowsW = el.scrollWidth - 1 > el.clientWidth;
      const allowedHeightAtSize = size * lineHeight * maxLines + 0.5;
      const overflowsH = el.scrollHeight > allowedHeightAtSize;
      if (!overflowsW && !overflowsH) break;
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
    setFontSize(size);

    const ro = new ResizeObserver(() => {
      // Trigger re-fit on container width changes
      let s = maxFontSize;
      el.style.fontSize = `${s}px`;
      let g = 40;
      while (g-- > 0 && s > minFontSize) {
        const oW = el.scrollWidth - 1 > el.clientWidth;
        const oH = el.scrollHeight > s * lineHeight * maxLines + 0.5;
        if (!oW && !oH) break;
        s -= 0.5;
        el.style.fontSize = `${s}px`;
      }
      setFontSize(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
     
  }, [children, maxFontSize, minFontSize, maxLines, lineHeight]);

  const TagName = Tag as any;
  return (
    <TagName
      ref={ref}
      className={className}
      style={{
        ...style,
        fontSize: `${fontSize}px`,
        lineHeight,
        display: "block",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </TagName>
  );
};

export default AutoFitText;
