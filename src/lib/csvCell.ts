/** Quote one CSV cell and neutralise spreadsheet formulas (=, +, -, @, tab, CR) so exports never execute in Excel/Sheets. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
