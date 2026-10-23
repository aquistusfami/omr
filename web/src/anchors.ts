import { applyH, homography, type Mat3 } from "./geometry";
import type { Pt, Template } from "./types";
import { downscale, type Gray, otsu } from "./image";

export interface Component {
  cx: number;
  cy: number;
  w: number;
  h: number;
  fill: number;
}

/** Connected components of the dark pixels. Iterative flood fill, 4-connected. */
export function darkComponents(img: Gray, threshold: number): Component[] {
  const { width: w, height: h, data } = img;
  const seen = new Uint8Array(w * h);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < data.length; start++) {
    if (seen[start] || data[start] >= threshold) continue;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    let n = 0;
    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && !seen[p - 1] && data[p - 1] < threshold) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && !seen[p + 1] && data[p + 1] < threshold) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !seen[p - w] && data[p - w] < threshold) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && !seen[p + w] && data[p + w] < threshold) { seen[p + w] = 1; stack.push(p + w); }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    out.push({
      cx: minX + bw / 2,
      cy: minY + bh / 2,
      w: bw,
      h: bh,
      fill: n / (bw * bh),
    });
  }
  return out;
}

export interface AnchorMatch {
  /** canvas -> image */
  h: Mat3;
  used: number;
  /** rms reprojection error, in image pixels */
  residual: number;
}

/** The four extremes of the anchor set: TL, TR, BR, BL. */
export function quadOrder(points: Pt[]): [Pt, Pt, Pt, Pt] {
  const sum = points.map((p) => p.x + p.y);
  const diff = points.map((p) => p.x - p.y);
  return [
    points[sum.indexOf(Math.min(...sum))],
    points[diff.indexOf(Math.max(...diff))],
    points[sum.indexOf(Math.max(...sum))],
    points[diff.indexOf(Math.min(...diff))],
  ];
}

/** Greedy one-to-one assignment of template anchors to observed marks. */
function matchPairs(
  h: Mat3,
  tmpl: Template,
  marks: Component[],
  tol: number,
): { pairs: { src: Pt; dst: Pt }[]; n: number; mean: number } | null {
  const taken = new Set<Component>();
  const pairs: { src: Pt; dst: Pt }[] = [];
  let sum = 0;
  for (const a of tmpl.anchors) {
    const p = applyH(h, a);
    let best: Component | null = null;
    let bestD = tol;
    for (const c of marks) {
      if (taken.has(c)) continue;
      const d = Math.hypot(c.cx - p.x, c.cy - p.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) {
      taken.add(best);
      pairs.push({ src: a, dst: { x: best.cx, y: best.cy } });
      sum += bestD;
    }
  }
  if (!pairs.length) return null;
  return { pairs, n: pairs.length, mean: sum / pairs.length };
}

/**
 * Locate the printed registration marks and fit canvas -> image.
 * The sheet is rejected when the marks are not where the template says they
 * should be: a wrong form, a rotated photo or a shadow over a corner.
 */
export function findAnchors(img: Gray, tmpl: Template, workWidth = 800): AnchorMatch | null {
  const scale0 = img.width / workWidth;
  const small: Gray = scale0 > 1 ? downscale(img, workWidth) : img;
  // downscale caps the long edge, so for a portrait photo small.width is not
  // workWidth: always take the real ratio or the final fit is scaled wrong
  const scale = img.width / small.width;
  const threshold = Math.max(60, otsu(small) * 0.9);
  const comps = darkComponents(small, threshold);

  const minSide = small.width * 0.011;
  const maxSide = small.width * 0.08;
  const marks = comps.filter(
    (c) =>
      c.w >= minSide && c.h >= minSide && c.w <= maxSide && c.h <= maxSide &&
      c.fill > 0.86 && Math.abs(c.w - c.h) <= 0.25 * Math.max(c.w, c.h),
  );
  if (marks.length < 6) return null;

  const canvasBox: Pt[] = [
    { x: 0, y: 0 }, { x: tmpl.canvas.width, y: 0 },
    { x: tmpl.canvas.width, y: tmpl.canvas.height }, { x: 0, y: tmpl.canvas.height },
  ];
  const xs = marks.map((c) => c.cx).sort((a, b) => a - b);
  const ys = marks.map((c) => c.cy).sort((a, b) => a - b);
  const at = (v: number[], i: number) => v[Math.min(Math.max(i, 0), v.length - 1)];

  // The printed page carries marks that are not on the form: an A4 scan has
  // corner marks below the instruction block. So the bounding box of all marks
  // is not the form. Try trimming 0..2 marks off each side and keep the box
  // that explains the most template anchors; a cropped corner still lands
  // because the box only seeds the fit.
  let best: { h: Mat3; n: number; mean: number } | null = null;
  for (let l = 0; l < 3; l++) {
    for (let r = 0; r < 3; r++) {
      for (let t = 0; t < 3; t++) {
        for (let b = 0; b < 3; b++) {
          const x0 = at(xs, l);
          const x1 = at(xs, xs.length - 1 - r);
          const y0 = at(ys, t);
          const y1 = at(ys, ys.length - 1 - b);
          if (x1 - x0 < small.width * 0.3 || y1 - y0 < small.height * 0.3) continue;
          const cand = homography(canvasBox, [
            { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
          ]);
          const fit = matchPairs(cand, tmpl, marks, 0.08 * small.width);
          if (!fit) continue;
          if (!best || fit.n > best.n || (fit.n === best.n && fit.mean < best.mean)) {
            best = { h: cand, n: fit.n, mean: fit.mean };
          }
        }
      }
    }
  }
  if (!best || best.n < 6) return null;

  let h = best.h;
  let pairs: { src: Pt; dst: Pt }[] = [];
  for (const tol of [0.08, 0.05, 0.035]) {
    pairs = matchPairs(h, tmpl, marks, tol * small.width)?.pairs ?? [];
    if (pairs.length < 6) return null;
    h = homography(pairs.map((p) => p.src), pairs.map((p) => p.dst));
  }

  // refine in full-resolution pixels so the caller can warp the original image
  const src = pairs.map((p) => p.src);
  const dstFull = pairs.map((p) => ({ x: p.dst.x * scale, y: p.dst.y * scale }));
  h = homography(src, dstFull);
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    const p = applyH(h, src[i]);
    sum += (p.x - dstFull[i].x) ** 2 + (p.y - dstFull[i].y) ** 2;
  }
  return { h, used: src.length, residual: Math.sqrt(sum / src.length) };
;
}
