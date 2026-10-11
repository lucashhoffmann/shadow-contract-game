type Point = { x: number; y: number };

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleTo(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

// menor diferenca entre dois angulos, em -PI..PI
export function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
