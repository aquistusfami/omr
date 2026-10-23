import type { Pt } from "./types";

/** Row-major 3x3. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Solve A x = b in place, 8x8, partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) throw new Error("singular system");
    [a[c], a[p]] = [a[p], a[c]];
    [b[c], b[p]] = [b[p], b[c]];
    const d = a[c][c];
    for (let k = c; k < n; k++) a[c][k] /= d;
    b[c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      if (f === 0) continue;
      for (let k = c; k < n; k++) a[r][k] -= f * a[c][k];
      b[r] -= f * b[c];
    }
  }
  return b;
}

/**
 * Projective transform from >=4 point pairs (least squares on the 8 unknowns).
 * h33 is fixed to 1; that is fine for a flat sheet, never at infinity.
 */
export function homography(src: Pt[], dst: Pt[]): Mat3 {
  if (src.length !== dst.length || src.length < 4) {
    throw new Error(`need >=4 pairs, got ${src.length}`);
  }
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const atb = new Array<number>(8).fill(0);
  for (let i = 0; i < src.length; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    const rows: [number[], number][] = [
      [[x, y, 1, 0, 0, 0, -u * x, -u * y], u],
      [[0, 0, 0, x, y, 1, -v * x, -v * y], v],
    ];
    for (const [row, rhs] of rows) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) ata[r][c] += row[r] * row[c];
        atb[r] += row[r] * rhs;
      }
    }
  }
  const h = solve(ata, atb);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyH(h: Mat3, p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

export function invert(h: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, i, j] = h;
  const A = e * j - f * i;
  const B = -(d * j - f * g);
  const C = d * i - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error("singular homography");
  const inv: Mat3 = [
    A, -(b * j - c * i), b * f - c * e,
    B, a * j - c * g, -(a * f - c * d),
    C, -(a * i - b * g), a * e - b * d,
  ];
  return inv.map((v) => v / det) as Mat3;
}
