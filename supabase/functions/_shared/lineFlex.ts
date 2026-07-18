// Shared LINE Flex Message builders — one visual language across all LINE edge functions.
// Modern bubbles: gradient header, hairline separators, subtle chip footer.

export const BRAND = {
  ink: "#0F172A",       // slate-900 — primary text
  muted: "#64748B",     // slate-500 — secondary text
  hair: "#E2E8F0",      // slate-200 — separators
  surface: "#FFFFFF",
  soft: "#F8FAFC",
  accent: "#6366F1",    // indigo-500 — default brand
};

/** Darken/lighten a hex color by pct (-100..100). */
export function shade(hex: string, pct: number): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i); if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (x: number) => {
    const v = Math.round(x + ((pct < 0 ? 0 : 255) - x) * Math.abs(pct) / 100);
    return Math.min(255, Math.max(0, v));
  };
  const r = f((n >> 16) & 0xff), g = f((n >> 8) & 0xff), b = f(n & 0xff);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Colored gradient header used across all cards. Falls back to solid on old LINE clients. */
export function headerBox(title: string, color: string, subtitle?: string): any {
  return {
    type: "box", layout: "vertical", paddingAll: "20px", spacing: "xs",
    backgroundColor: color,
    background: {
      type: "linearGradient", angle: "135deg",
      startColor: color, endColor: shade(color, -18),
    },
    contents: [
      { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg", wrap: true },
      ...(subtitle ? [{ type: "text", text: subtitle, color: "#FFFFFFCC", size: "xs", wrap: true }] : []),
    ],
  };
}

export function buildInfoCard(title: string, items: { label: string; value: string }[], color = BRAND.accent, footerAction?: any, subtitle?: string): any {
  const bodyContents: any[] = items.length > 0
    ? items.flatMap((it, i) => {
        const row = {
          type: "box", layout: "horizontal", spacing: "md", paddingAll: "none",
          contents: [
            { type: "text", text: it.label, size: "sm", color: BRAND.muted, flex: 4, wrap: true },
            { type: "text", text: it.value || "-", size: "sm", color: BRAND.ink, flex: 6, align: "end", weight: "bold", wrap: true },
          ],
        };
        return i === 0 ? [row] : [{ type: "separator", color: BRAND.hair }, row];
      })
    : [{ type: "text", text: "— ไม่มีข้อมูล —", size: "sm", color: BRAND.muted, align: "center" }];

  const bubble: any = {
    type: "bubble", size: "kilo",
    styles: { footer: { separator: false } },
    header: headerBox(title, color, subtitle),
    body: {
      type: "box", layout: "vertical", spacing: "md", paddingAll: "20px", backgroundColor: BRAND.surface,
      contents: bodyContents,
    },
  };
  if (footerAction) {
    bubble.footer = {
      type: "box", layout: "vertical", paddingAll: "12px", spacing: "sm", backgroundColor: BRAND.soft,
      contents: [{ ...footerAction, style: footerAction.style || "primary", color: footerAction.color || color, height: "sm" }],
    };
  }
  return bubble;
}

export function buildListCard(title: string, items: string[], color = BRAND.accent, subtitle?: string): any {
  const rows: any[] = items.length > 0
    ? items.slice(0, 12).flatMap((t, i) => {
        const row = {
          type: "box", layout: "horizontal", spacing: "sm",
          contents: [
            { type: "text", text: String(i + 1).padStart(2, "0"), size: "xs", color: color, weight: "bold", flex: 0 },
            { type: "text", text: t, size: "sm", color: BRAND.ink, wrap: true, flex: 1 },
          ],
        };
        return i === 0 ? [row] : [{ type: "separator", color: BRAND.hair }, row];
      })
    : [{ type: "text", text: "— ไม่มีข้อมูล —", size: "sm", color: BRAND.muted, align: "center" }];

  return {
    type: "bubble", size: "kilo",
    header: headerBox(title, color, subtitle),
    body: {
      type: "box", layout: "vertical", spacing: "md", paddingAll: "20px", backgroundColor: BRAND.surface,
      contents: rows,
    },
  };
}

/** Profile / status card with avatar chip and role badge. */
export function buildProfileCard(opts: { name: string; roleLabel: string; roleColor: string; avatarEmoji: string; rows: { label: string; value: string }[]; footerAction?: any }): any {
  const bubble: any = {
    type: "bubble", size: "kilo",
    styles: { footer: { separator: false } },
    hero: {
      type: "box", layout: "vertical", paddingAll: "24px", spacing: "md", backgroundColor: opts.roleColor,
      background: { type: "linearGradient", angle: "135deg", startColor: opts.roleColor, endColor: shade(opts.roleColor, -22) },
      contents: [
        { type: "box", layout: "horizontal", spacing: "md", contents: [
          { type: "box", layout: "vertical", width: "56px", height: "56px", cornerRadius: "28px", backgroundColor: "#FFFFFF33", justifyContent: "center",
            contents: [{ type: "text", text: opts.avatarEmoji, size: "xxl", align: "center" }] },
          { type: "box", layout: "vertical", flex: 1, contents: [
            { type: "text", text: opts.name, color: "#FFFFFF", weight: "bold", size: "lg", wrap: true },
            { type: "text", text: opts.roleLabel, color: "#FFFFFFCC", size: "xs" },
          ]},
        ]},
      ],
    },
    body: {
      type: "box", layout: "vertical", spacing: "md", paddingAll: "20px", backgroundColor: BRAND.surface,
      contents: opts.rows.flatMap((r, i) => {
        const row = { type: "box", layout: "horizontal", spacing: "md", contents: [
          { type: "text", text: r.label, size: "sm", color: BRAND.muted, flex: 4 },
          { type: "text", text: r.value || "-", size: "sm", color: BRAND.ink, flex: 6, align: "end", weight: "bold", wrap: true },
        ]};
        return i === 0 ? [row] : [{ type: "separator", color: BRAND.hair }, row];
      }),
    },
  };
  if (opts.footerAction) {
    bubble.footer = {
      type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: BRAND.soft,
      contents: [{ ...opts.footerAction, style: "primary", color: opts.roleColor, height: "sm" }],
    };
  }
  return bubble;
}

/** Section bubble used inside menu carousel — icon + heading + short line list + CTA row. */
export function buildSectionCard(opts: { icon: string; title: string; color: string; lines: string[]; ctas: { label: string; text: string }[] }): any {
  return {
    type: "bubble", size: "kilo",
    body: {
      type: "box", layout: "vertical", spacing: "md", paddingAll: "20px",
      contents: [
        { type: "box", layout: "horizontal", spacing: "md", alignItems: "center", contents: [
          { type: "box", layout: "vertical", width: "44px", height: "44px", cornerRadius: "22px", backgroundColor: opts.color,
            justifyContent: "center", contents: [{ type: "text", text: opts.icon, align: "center", size: "xl", color: "#FFFFFF" }] },
          { type: "text", text: opts.title, weight: "bold", size: "md", color: BRAND.ink, flex: 1 },
        ]},
        { type: "separator", color: BRAND.hair },
        ...opts.lines.map((l) => ({ type: "text", text: `• ${l}`, size: "xs", color: BRAND.muted, wrap: true })),
      ],
    },
    footer: {
      type: "box", layout: "vertical", spacing: "xs", paddingAll: "12px", backgroundColor: BRAND.soft,
      contents: opts.ctas.slice(0, 3).map((c) => ({
        type: "button", height: "sm", style: "secondary",
        action: { type: "message", label: c.label, text: c.text },
      })),
    },
  };
}

export function buildCarousel(bubbles: any[]) {
  return { type: "carousel", contents: bubbles.slice(0, 10) };
}
