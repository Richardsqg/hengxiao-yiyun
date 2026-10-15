export type Point = { x: number; y: number };
export type Transform = Point & { scale: number };
export type Bounds = { width: number; height: number; imageWidth: number; imageHeight: number };
export const identity: Transform = { x: 0, y: 0, scale: 1 };
const limit = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export function constrain(value: Transform, bounds: Bounds): Transform {
  const scale = limit(value.scale, 1, 6);
  if (scale === 1) return { ...identity };
  const x = Math.max(0, (bounds.imageWidth * scale - bounds.width) / 2);
  const y = Math.max(0, (bounds.imageHeight * scale - bounds.height) / 2);
  return { scale, x: limit(value.x, -x, x), y: limit(value.y, -y, y) };
}
export function zoomAt(start: Transform, scale: number, anchor: Point, bounds: Bounds): Transform {
  const next = limit(scale, 1, 6), ratio = next / start.scale;
  return constrain({ scale: next, x: anchor.x - (anchor.x - start.x) * ratio, y: anchor.y - (anchor.y - start.y) * ratio }, bounds);
}
export function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
export function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function pinchAt(start: Transform, a: Point, b: Point, nextA: Point, nextB: Point, bounds: Bounds): Transform {
  const initialDistance = distance(a, b);
  if (initialDistance < 1) return start;
  const anchor = midpoint(a, b), nextAnchor = midpoint(nextA, nextB);
  const scale = limit(start.scale * distance(nextA, nextB) / initialDistance, 1, 6), ratio = scale / start.scale;
  return constrain({ scale, x: nextAnchor.x - (anchor.x - start.x) * ratio, y: nextAnchor.y - (anchor.y - start.y) * ratio }, bounds);
}
