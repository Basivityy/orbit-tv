"use client";

import { encodeCanvas, runPipeline, type ImageOp, type OutputSpec } from "./pipeline";
import { sniffImage } from "../logic/imageformat";

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, { resolve: (v: ProcessedImage) => void; reject: (e: Error) => void }>();

function canUseWorker() {
  return !workerBroken && typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && "convertToBlob" in OffscreenCanvas.prototype;
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve({ blob: e.data.blob, width: e.data.width, height: e.data.height });
      else p.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      workerBroken = true;
      for (const p of pending.values()) p.reject(new Error("Image worker crashed (the image may be too large for available memory)."));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

/** Decodes any supported file (including HEIC via WebAssembly and SVG) to an ImageBitmap. */
export async function decodeImage(file: Blob, opts: { svgWidth?: number } = {}): Promise<ImageBitmap> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const kind = sniffImage(head);
  if (kind === "heic") {
    const heic2any = (await import("heic2any")).default;
    let converted: Blob | Blob[];
    try {
      converted = await heic2any({ blob: file, toType: "image/png" });
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "";
      throw new Error(`Could not decode this HEIC file${msg ? ` (${msg})` : ""}. Some HEIC variants (e.g. 10-bit or burst sequences) are not supported.`);
    }
    return createImageBitmap(Array.isArray(converted) ? converted[0] : converted);
  }
  if (kind === "svg") return decodeSvg(file, opts.svgWidth);
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (kind === "avif") {
      const { default: decode } = await import("@jsquash/avif/decode");
      const data = await decode(await file.arrayBuffer());
      if (!data) throw new Error("Could not decode this AVIF file.");
      return createImageBitmap(data);
    }
    throw new Error(kind === "unknown" ? "This file is not a recognised image." : `Your browser could not decode this ${kind.toUpperCase()} image. It may be corrupt.`);
  }
}

async function decodeSvg(file: Blob, targetWidth?: number): Promise<ImageBitmap> {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName !== "svg" || doc.querySelector("parsererror")) throw new Error("Invalid SVG file.");
  const vb = svg.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
  let w = parseFloat(svg.getAttribute("width") ?? "") || (vb ? vb[2] : 0) || 512;
  let h = parseFloat(svg.getAttribute("height") ?? "") || (vb ? vb[3] : 0) || 512;
  if (targetWidth) {
    h = (h / w) * targetWidth;
    w = targetWidth;
  }
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return await createImageBitmap(img, { resizeWidth: Math.round(w), resizeHeight: Math.round(h) });
  } catch {
    throw new Error("The SVG could not be rendered. External resources (fonts, linked images) are blocked for security and may be missing.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decodes, transforms and re-encodes an image. Uses a Web Worker when available. */
export type OpsSpec = ImageOp[] | ((width: number, height: number) => ImageOp[]);

export async function processImage(file: Blob, opsSpec: OpsSpec, output: OutputSpec, decodeOpts?: { svgWidth?: number }): Promise<ProcessedImage> {
  const bitmap = await decodeImage(file, decodeOpts);
  let ops: ImageOp[];
  try {
    ops = typeof opsSpec === "function" ? opsSpec(bitmap.width, bitmap.height) : opsSpec;
  } catch (e) {
    bitmap.close();
    throw e;
  }
  if (canUseWorker()) {
    const id = ++seq;
    return new Promise<ProcessedImage>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, bitmap, ops, output }, [bitmap]);
    });
  }
  const canvas = runPipeline(bitmap, ops, (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }));
  bitmap.close();
  const blob = await encodeCanvas(canvas, output);
  return { blob, width: canvas.width, height: canvas.height };
}

export async function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  const bmp = await decodeImage(file);
  const r = { width: bmp.width, height: bmp.height };
  bmp.close();
  return r;
}

/** Renders a bitmap to a PNG of the given square size (used for icons). */
export async function bitmapToPng(bmp: ImageBitmap, size: number, fit: "contain" | "cover" = "contain", background?: string): Promise<Uint8Array> {
  const c = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const ctx = c.getContext("2d")!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  const scale = fit === "contain" ? Math.min(size / bmp.width, size / bmp.height) : Math.max(size / bmp.width, size / bmp.height);
  const w = bmp.width * scale, h = bmp.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, (size - w) / 2, (size - h) / 2, w, h);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) throw new Error("PNG encoding failed.");
  return new Uint8Array(await blob.arrayBuffer());
}
