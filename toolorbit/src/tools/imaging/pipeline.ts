/**
 * Image processing pipeline shared by the Web Worker (OffscreenCanvas) and the
 * main-thread fallback (HTMLCanvasElement). Pixel filters are implemented on
 * ImageData so they behave identically in every browser (Safari lacks ctx.filter).
 */

export type ImageOp =
  | { type: "resize"; width: number; height: number; smoothing?: "low" | "medium" | "high" }
  | { type: "crop"; x: number; y: number; width: number; height: number }
  | { type: "rotate"; degrees: number; background?: string }
  | { type: "flip"; horizontal: boolean; vertical: boolean }
  | { type: "grayscale"; amount?: number }
  | { type: "brightness"; amount: number }
  | { type: "contrast"; amount: number }
  | { type: "blur"; radius: number };

export type OutputType = "image/png" | "image/jpeg" | "image/webp" | "image/avif";

export interface OutputSpec {
  type: OutputType;
  /** 0..1 for lossy formats */
  quality?: number;
  /** Fill for transparent areas when the output has no alpha (JPEG). */
  background?: string;
}

export const MAX_PIXELS = 100_000_000; // 100 MP – beyond this most browsers fail to allocate canvases.

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type CanvasFactory = (w: number, h: number) => AnyCanvas;

function ctx2d(c: AnyCanvas): Ctx2D {
  const ctx = c.getContext("2d", { willReadFrequently: true }) as Ctx2D | null;
  if (!ctx) throw new Error("Your browser could not create a 2D canvas (out of memory?).");
  return ctx;
}

function checkSize(w: number, h: number) {
  if (!(w >= 1 && h >= 1)) throw new Error("Image dimensions must be at least 1×1 pixel.");
  if (w * h > MAX_PIXELS) throw new Error(`The result would be ${(w * h / 1e6).toFixed(0)} megapixels; the limit is ${MAX_PIXELS / 1e6} MP.`);
  if (w > 32767 || h > 32767) throw new Error("Width and height must be 32,767 pixels or less.");
}

export function runPipeline(source: CanvasImageSource & { width: number; height: number }, ops: ImageOp[], make: CanvasFactory): AnyCanvas {
  checkSize(source.width, source.height);
  let canvas = make(source.width, source.height);
  ctx2d(canvas).drawImage(source, 0, 0);

  for (const op of ops) {
    switch (op.type) {
      case "resize": {
        const w = Math.round(op.width), h = Math.round(op.height);
        checkSize(w, h);
        // Downscale in halving steps for quality when shrinking a lot.
        let cur: AnyCanvas = canvas;
        while (cur.width / 2 >= w && cur.height / 2 >= h) {
          const half = make(Math.round(cur.width / 2), Math.round(cur.height / 2));
          const hc = ctx2d(half);
          hc.imageSmoothingQuality = "high";
          hc.drawImage(cur, 0, 0, half.width, half.height);
          cur = half;
        }
        const out = make(w, h);
        const oc = ctx2d(out);
        oc.imageSmoothingEnabled = true;
        oc.imageSmoothingQuality = op.smoothing ?? "high";
        oc.drawImage(cur, 0, 0, w, h);
        canvas = out;
        break;
      }
      case "crop": {
        const x = Math.max(0, Math.round(op.x)), y = Math.max(0, Math.round(op.y));
        const w = Math.min(canvas.width - x, Math.round(op.width)), h = Math.min(canvas.height - y, Math.round(op.height));
        checkSize(w, h);
        const out = make(w, h);
        ctx2d(out).drawImage(canvas, x, y, w, h, 0, 0, w, h);
        canvas = out;
        break;
      }
      case "rotate": {
        const rad = ((op.degrees % 360) * Math.PI) / 180;
        const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
        const w = Math.round(canvas.width * cos + canvas.height * sin);
        const h = Math.round(canvas.width * sin + canvas.height * cos);
        checkSize(w, h);
        const out = make(w, h);
        const oc = ctx2d(out);
        if (op.background) {
          oc.fillStyle = op.background;
          oc.fillRect(0, 0, w, h);
        }
        oc.translate(w / 2, h / 2);
        oc.rotate(rad);
        oc.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        canvas = out;
        break;
      }
      case "flip": {
        const out = make(canvas.width, canvas.height);
        const oc = ctx2d(out);
        oc.translate(op.horizontal ? canvas.width : 0, op.vertical ? canvas.height : 0);
        oc.scale(op.horizontal ? -1 : 1, op.vertical ? -1 : 1);
        oc.drawImage(canvas, 0, 0);
        canvas = out;
        break;
      }
      case "grayscale":
      case "brightness":
      case "contrast": {
        const c = ctx2d(canvas);
        const img = c.getImageData(0, 0, canvas.width, canvas.height);
        applyPixelFilter(img.data, op);
        c.putImageData(img, 0, 0);
        break;
      }
      case "blur": {
        const c = ctx2d(canvas);
        const img = c.getImageData(0, 0, canvas.width, canvas.height);
        boxBlur(img.data, canvas.width, canvas.height, Math.max(0, Math.round(op.radius)));
        c.putImageData(img, 0, 0);
        break;
      }
    }
  }
  return canvas;
}

/** Exported for unit tests. Operates in place on RGBA bytes. */
export function applyPixelFilter(d: Uint8ClampedArray, op: Extract<ImageOp, { type: "grayscale" | "brightness" | "contrast" }>) {
  if (op.type === "grayscale") {
    const a = op.amount ?? 1;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      d[i] = d[i] + (y - d[i]) * a;
      d[i + 1] = d[i + 1] + (y - d[i + 1]) * a;
      d[i + 2] = d[i + 2] + (y - d[i + 2]) * a;
    }
  } else if (op.type === "brightness") {
    // amount: -100..100 (percent). Multiplicative like CSS brightness().
    const f = 1 + op.amount / 100;
    for (let i = 0; i < d.length; i += 4) {
      d[i] *= f;
      d[i + 1] *= f;
      d[i + 2] *= f;
    }
  } else {
    // amount: -100..100. Same curve as CSS contrast(): (v - 128) * f + 128
    const f = 1 + op.amount / 100;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = (d[i] - 128) * f + 128;
      d[i + 1] = (d[i + 1] - 128) * f + 128;
      d[i + 2] = (d[i + 2] - 128) * f + 128;
    }
  }
}

/** Three-pass box blur ≈ Gaussian blur. Premultiplies alpha to avoid dark fringes. */
export function boxBlur(d: Uint8ClampedArray, w: number, h: number, radius: number) {
  if (radius < 1) return;
  const r = Math.min(radius, 200);
  const n = w * h;
  const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    ch[0][i] = d[i * 4] * a;
    ch[1][i] = d[i * 4 + 1] * a;
    ch[2][i] = d[i * 4 + 2] * a;
    ch[3][i] = d[i * 4 + 3];
  }
  const tmp = new Float32Array(n);
  const boxR = Math.max(1, Math.round(r / 1.7));
  for (const c of ch) {
    for (let pass = 0; pass < 3; pass++) {
      blurH(c, tmp, w, h, boxR);
      blurV(tmp, c, w, h, boxR);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = ch[3][i];
    const inv = a > 0 ? 255 / a : 0;
    d[i * 4] = ch[0][i] * inv;
    d[i * 4 + 1] = ch[1][i] * inv;
    d[i * 4 + 2] = ch[2][i] * inv;
    d[i * 4 + 3] = a;
  }
}

function blurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const iarr = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = src[row] * (r + 1);
    for (let x = 0; x < r; x++) acc += src[row + Math.min(x, w - 1)];
    for (let x = 0; x < w; x++) {
      acc += src[row + Math.min(x + r, w - 1)] - src[row + Math.max(x - r - 1, 0)];
      dst[row + x] = acc * iarr;
    }
  }
}

function blurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const iarr = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    let acc = src[x] * (r + 1);
    for (let y = 0; y < r; y++) acc += src[Math.min(y, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      acc += src[Math.min(y + r, h - 1) * w + x] - src[Math.max(y - r - 1, 0) * w + x];
      dst[y * w + x] = acc * iarr;
    }
  }
}

export async function encodeCanvas(canvas: AnyCanvas, out: OutputSpec): Promise<Blob> {
  let src = canvas;
  if (out.type === "image/jpeg" || out.background) {
    // JPEG has no alpha: flatten onto a background so transparent areas don't turn black.
    const flat = "convertToBlob" in canvas ? new OffscreenCanvas(canvas.width, canvas.height) : Object.assign(document.createElement("canvas"), { width: canvas.width, height: canvas.height });
    const fc = ctx2d(flat);
    fc.fillStyle = out.background ?? "#ffffff";
    fc.fillRect(0, 0, flat.width, flat.height);
    fc.drawImage(canvas, 0, 0);
    src = flat;
  }
  if (out.type === "image/avif") {
    const data = ctx2d(src).getImageData(0, 0, src.width, src.height);
    const { default: encode } = await import("@jsquash/avif/encode");
    const q = Math.round((out.quality ?? 0.6) * 100);
    const buf = await encode(data, { quality: q, speed: 8 });
    return new Blob([buf], { type: "image/avif" });
  }
  const quality = out.type === "image/png" ? undefined : (out.quality ?? 0.9);
  let blob: Blob | null;
  if ("convertToBlob" in src) blob = await src.convertToBlob({ type: out.type, quality });
  else blob = await new Promise<Blob | null>((res) => (src as HTMLCanvasElement).toBlob(res, out.type, quality));
  if (!blob) throw new Error("The browser could not encode the image.");
  if (blob.type !== out.type) throw new Error(`This browser cannot encode ${out.type.replace("image/", "").toUpperCase()} images. Try another browser (Chrome, Edge or Firefox).`);
  return blob;
}
