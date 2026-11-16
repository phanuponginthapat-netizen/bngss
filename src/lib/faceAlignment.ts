export type AlignmentPoint = [number, number];

/** Least-squares similarity transform, constrained to rotation/scale (no reflection). */
export function faceSimilarityTransform(src: AlignmentPoint[], dst: AlignmentPoint[]): [number, number, number, number, number, number] {
  if (src.length !== dst.length || src.length < 2 || [...src, ...dst].some(p => !p.every(Number.isFinite))) throw new Error('จุดใบหน้าไม่สมบูรณ์');
  const mean = (points: AlignmentPoint[]) => points.reduce((sum, p) => [sum[0] + p[0] / points.length, sum[1] + p[1] / points.length] as AlignmentPoint, [0, 0] as AlignmentPoint);
  const [sx, sy] = mean(src), [dx, dy] = mean(dst);
  let denominator = 0, dot = 0, cross = 0;
  for (let i = 0; i < src.length; i++) {
    const x = src[i][0] - sx, y = src[i][1] - sy;
    const u = dst[i][0] - dx, v = dst[i][1] - dy;
    denominator += x * x + y * y;
    dot += x * u + y * v;
    cross += x * v - y * u;
  }
  if (denominator < 1e-8) throw new Error('จุดใบหน้าซ้อนกัน กรุณาใช้รูปหน้าชัดเจน');
  const a = dot / denominator, b = cross / denominator;
  if (a * a + b * b < 1e-12) throw new Error('จัดตำแหน่งใบหน้าไม่สำเร็จ');
  return [a, b, -b, a, dx - a * sx + b * sy, dy - b * sx - a * sy];
}