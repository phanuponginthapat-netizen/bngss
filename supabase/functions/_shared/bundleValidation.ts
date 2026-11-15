export function allowedTables(input: unknown, spec: Record<string, string>): string[] {
  const tables = input === undefined ? Object.keys(spec) : input;
  if (!Array.isArray(tables) || tables.some(t => typeof t !== 'string' || !Object.hasOwn(spec, t))) throw new Error('table outside allowed scope');
  return [...new Set(tables)];
}

export function validateBundleRows(table: string, rows: unknown, columns: Record<string, string[]>): Record<string, unknown>[] {
  const allowed = columns[table];
  if (!allowed || !Array.isArray(rows)) throw new Error('invalid bundle table');
  return rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(k => !allowed.includes(k))) throw new Error('field outside allowed configuration');
    return row as Record<string, unknown>;
  });
}