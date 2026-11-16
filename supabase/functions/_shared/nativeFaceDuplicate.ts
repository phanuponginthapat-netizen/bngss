/** ArcFace uses 512 dimensions; legacy 128-dimensional duplicate RPC is insufficient. */
export function arcFaceDuplicate(probes: number[][], rows: { student_id: string; descriptor: number[] }[], studentId: string) {
  for (const row of rows) {
    if (row.student_id === studentId || !Array.isArray(row.descriptor) || row.descriptor.length !== 512) continue;
    for (const probe of probes) {
      const normA = Math.sqrt(probe.reduce((sum, x) => sum + x*x, 0));
      const normB = Math.sqrt(row.descriptor.reduce((sum, x) => sum + x*x, 0));
      if (!normA || !normB) continue;
      const cosine = probe.reduce((sum, x, i) => sum + x * row.descriptor[i], 0) / (normA * normB);
      if (cosine >= 0.65) return true;
    }
  }
  return false;
}