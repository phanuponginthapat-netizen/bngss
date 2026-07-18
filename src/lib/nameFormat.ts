/**
 * Convert literal "\n" sequences stored in DB to real line-breaks for display.
 * Use together with `whiteSpace: pre-wrap` (or `whitespace-pre-wrap` class)
 * on the rendering element.
 */
export const nl = (s?: string | null): string =>
  (s ?? "").replace(/\\n/g, "\n");

/**
 * Same as `nl` but emits HTML <br/> tags. Use for raw-HTML print templates.
 * Caller must ensure other parts of the string are HTML-safe.
 */
export const nlHtml = (s?: string | null): string =>
  (s ?? "").replace(/\\n/g, "<br/>");

/**
 * Build a full Thai name from prefix + first_name + last_name with newline
 * support (real \n). Use with whitespace-pre-wrap.
 */
export const formatFullName = (
  prefix?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): string => {
  const p = nl(prefix);
  const f = nl(firstName);
  const l = nl(lastName);
  return `${p}${f}${f && l ? " " : ""}${l}`;
};

/**
 * HTML version of `formatFullName` — emits <br/> for embedded newlines.
 */
export const formatFullNameHtml = (
  prefix?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): string => {
  const p = nlHtml(prefix);
  const f = nlHtml(firstName);
  const l = nlHtml(lastName);
  return `${p}${f}${f && l ? " " : ""}${l}`;
};

/**
 * Plain-text version: collapses any \n (literal or real) to a single space.
 * Use for filenames, window titles, toasts and log lines.
 */
export const formatFullNamePlain = (
  prefix?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): string => {
  const clean = (s?: string | null) =>
    (s ?? "").replace(/\\n/g, " ").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const p = clean(prefix);
  const f = clean(firstName);
  const l = clean(lastName);
  return `${p}${p && (f || l) ? "" : ""}${f}${f && l ? " " : ""}${l}`.trim();
};
