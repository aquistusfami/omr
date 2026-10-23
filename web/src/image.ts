import type { Mat3 } from "./geometry";

/** 8-bit grayscale image, row-major. */
export interface Gray {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function fromRgba(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    data[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  }
  return { width, height, data };
}

/** Box-filter downscale so long edge <= maxEdge. No-op when already small. */
export function downscale(img: Gray, maxEdge: number): Gray {
  const scale = Math.max(img.width, img.height) / maxEdge;
  if (scale <= 1) return img;
  const w = Math.round(img.width / scale);
  const h = Math.round(img.height / scale);
  const data = new Uint8ClampedArray(w * h);
  const bw = img.width / w;
  const bh = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * bh);
    const y1 = Math.min(img.height, Math.ceil((y + 1) * bh));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * bw);
      const x1 = Math.min(img.width, Math.ceil((x + 1) * bw));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        const base = yy * img.width;
        for (let xx = x0; xx < x1; xx++) {
          sum += img.data[base + xx];
          n++;
        }
      }
      data[y * w + x] = sum / n;
    }
  }
  return { width: w, height: h, data };
}

/**
 * Sample the source through `toSource` (output pixel -> source pixel) with
 * bilinear interpolation. `scale` divides output coordinates before mapping,
 * so `toSource` can stay in canvas units.
 */
export function warp(
  src: Gray,
  toSource: Mat3,
  outWidth: number,
  outHeight: number,
  scale = 1,
): Gray {
  const data = new Uint8ClampedArray(outWidth * outHeight);
  const [a, b, c, d, e, f, g, i, j] = toSource;
  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const u = (x + 0.5) / scale;
      const v = (y + 0.5) / scale;
      const w = g * u + i * v + j;
      const sx = (a * u + b * v + c) / w;
      const sy = (d * u + e * v + f) / w;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= src.width - 1 || y0 >= src.height - 1) {
        data[y * outWidth + x] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const p = y0 * src.width + x0;
      const v00 = src.data[p];
      const v10 = src.data[p + 1];
      const v01 = src.data[p + src.width];
      const v11 = src.data[p + src.width + 1];
      data[y * outWidth + x] =
        v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
    }
  }
  return { width: outWidth, height: outHeight, data };
}

/** Mean intensity inside a disc. Coordinates in pixels, radius in pixels. */
export function discMean(img: Gray, cx: number, cy: number, radius: number): number {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(img.width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(img.height - 1, Math.ceil(cy + radius));
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    const base = y * img.width;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= r2) {
        sum += img.data[base + x];
        n++;
      }
    }
  }
  return n ? sum / n : 255;
}

export function otsu(img: Gray): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < img.data.length; i++) hist[img.data[i]]++;
  const total = img.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

/** Test fixture loader. PGM P5, max value 255. */
export function readPgm(bytes: Uint8Array): Gray {
  let pos = 0;
  const token = () => {
    while (pos < bytes.length) {
      const c = bytes[pos];
      if (c === 35) {                       // comment
        while (pos < bytes.length && bytes[pos] !== 10) pos++;
      } else if (c === 32 || c === 10 || c === 13 || c === 9) {
        pos++;
      } else break;
    }
    const start = pos;
    while (pos < bytes.length && bytes[pos] > 32) pos++;
    return new TextDecoder().decode(bytes.subarray(start, pos));
  };
  if (token() !== "P5") throw new Error("not a P5 pgm");
  const width = Number(token());
  const height = Number(token());
  const maxv = Number(token());
  if (maxv !== 255) throw new Error(`unsupported max value ${maxv}`);
  pos++;                                   // single whitespace before raster
  return { width, height, data: new Uint8ClampedArray(bytes.buffer, bytes.byteOffset + pos, width * height) };
}
