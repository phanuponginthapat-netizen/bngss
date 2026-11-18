export type PaintColor = [number, number, number, number];

// Iterative four-connected fill: never crosses a differently coloured boundary.
export function fillPaintRegion(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: PaintColor) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height || data.length !== width * height * 4) return false;
  const start = (y * width + x) * 4;
  const target = Array.from(data.slice(start, start + 4));
  const matches = (offset: number) => target.every((v, i) => Math.abs(data[offset + i] - v) <= 12);
  if (target.every((v, i) => v === color[i])) return false;
  const seen = new Uint8Array(width * height);
  const stack = [y * width + x];
  while (stack.length) {
    const pixel = stack.pop();
    if (pixel === undefined || seen[pixel]) continue;
    seen[pixel] = 1;
    const offset = pixel * 4;
    if (!matches(offset)) continue;
    data.set(color, offset);
    const px = pixel % width;
    if (px > 0) stack.push(pixel - 1);
    if (px < width - 1) stack.push(pixel + 1);
    if (pixel >= width) stack.push(pixel - width);
    if (pixel < width * (height - 1)) stack.push(pixel + width);
  }
  return true;
}

export function paintHexColor(hex: string, opacity = 100): PaintColor {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), Math.round(opacity * 2.55)];
}