/** Byte-level helpers for image formats (no canvas). Fully testable in Node. */

export type ImageKind = "jpeg" | "png" | "gif" | "webp" | "avif" | "heic" | "bmp" | "ico" | "svg" | "tiff" | "unknown";

export function sniffImage(bytes: Uint8Array): ImageKind {
  const b = bytes;
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return "png";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) return "heic";
  }
  if (b[0] === 0x42 && b[1] === 0x4d) return "bmp";
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "ico";
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) return "tiff";
  const head = new TextDecoder().decode(b.subarray(0, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return "unknown";
}

export interface IcoEntry {
  width: number;
  height: number;
  png: Uint8Array;
}

/** Builds a .ico container with PNG-compressed entries (supported by all modern Windows/browsers). */
export function buildIco(entries: IcoEntry[]): Uint8Array {
  if (entries.length === 0) throw new Error("An ICO file needs at least one image.");
  const headerSize = 6 + 16 * entries.length;
  const total = headerSize + entries.reduce((s, e) => s + e.png.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0, true);
  dv.setUint16(2, 1, true);
  dv.setUint16(4, entries.length, true);
  let offset = headerSize;
  entries.forEach((e, i) => {
    if (e.width > 256 || e.height > 256) throw new Error("ICO images can be at most 256×256 pixels.");
    const base = 6 + i * 16;
    out[base] = e.width >= 256 ? 0 : e.width;
    out[base + 1] = e.height >= 256 ? 0 : e.height;
    out[base + 2] = 0;
    out[base + 3] = 0;
    dv.setUint16(base + 4, 1, true);
    dv.setUint16(base + 6, 32, true);
    dv.setUint32(base + 8, e.png.length, true);
    dv.setUint32(base + 12, offset, true);
    out.set(e.png, offset);
    offset += e.png.length;
  });
  return out;
}

export function parseIco(bytes: Uint8Array): { width: number; height: number; size: number }[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint16(0, true) !== 0 || dv.getUint16(2, true) !== 1) throw new Error("Not an ICO file.");
  const n = dv.getUint16(4, true);
  return Array.from({ length: n }, (_, i) => {
    const b = 6 + i * 16;
    return { width: bytes[b] || 256, height: bytes[b + 1] || 256, size: dv.getUint32(b + 8, true) };
  });
}

/**
 * Removes metadata segments from a JPEG without re-encoding (lossless):
 * APP1 (EXIF/XMP), APP2-APP15 except ICC (APP2 "ICC_PROFILE" is kept when keepIcc), and COM.
 */
export function stripJpegMetadata(bytes: Uint8Array, keepIcc = true): { output: Uint8Array; removed: string[] } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Not a JPEG file.");
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  const removed: string[] = [];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error("Corrupt JPEG: marker expected.");
    const marker = bytes[i + 1];
    if (marker === 0xda) {
      // Start of scan: the rest is image data.
      parts.push(bytes.subarray(i));
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    const seg = bytes.subarray(i, i + 2 + len);
    const id = String.fromCharCode(...bytes.subarray(i + 4, i + 4 + Math.min(12, len - 2))).replace(/\0.*$/, "");
    const isApp = marker >= 0xe1 && marker <= 0xef;
    const isIcc = marker === 0xe2 && id.startsWith("ICC_PROFILE");
    if ((isApp && !(keepIcc && isIcc)) || marker === 0xfe) {
      removed.push(marker === 0xfe ? "Comment" : id ? `${id} (APP${marker - 0xe0})` : `APP${marker - 0xe0}`);
    } else {
      parts.push(seg);
    }
    i += 2 + len;
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { output: out, removed };
}

/** Removes ancillary text/EXIF chunks from PNG (tEXt, zTXt, iTXt, eXIf, tIME). Lossless. */
export function stripPngMetadata(bytes: Uint8Array): { output: Uint8Array; removed: string[] } {
  if (sniffImage(bytes) !== "png") throw new Error("Not a PNG file.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  const removed: string[] = [];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const len = dv.getUint32(i);
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    const end = i + 12 + len;
    if (["tEXt", "zTXt", "iTXt", "eXIf", "tIME"].includes(type)) removed.push(type);
    else parts.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { output: out, removed };
}

export interface DpiInfo {
  x: number | null;
  y: number | null;
  source: string;
}

/** Reads the stored print resolution from JPEG (JFIF / EXIF) or PNG (pHYs). */
export function readDpi(bytes: Uint8Array): DpiInfo {
  const kind = sniffImage(bytes);
  if (kind === "png") {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let i = 8;
    while (i + 8 <= bytes.length) {
      const len = dv.getUint32(i);
      const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
      if (type === "pHYs") {
        const px = dv.getUint32(i + 8), py = dv.getUint32(i + 12), unit = bytes[i + 16];
        if (unit === 1) return { x: Math.round(px * 0.0254), y: Math.round(py * 0.0254), source: "PNG pHYs chunk" };
        return { x: null, y: null, source: "PNG pHYs chunk (aspect ratio only, no unit)" };
      }
      if (type === "IDAT" || type === "IEND") break;
      i += 12 + len;
    }
    return { x: null, y: null, source: "No pHYs chunk" };
  }
  if (kind === "jpeg") {
    let i = 2;
    let exif: DpiInfo | null = null;
    let jfif: DpiInfo | null = null;
    while (i + 4 < bytes.length && bytes[i] === 0xff) {
      const marker = bytes[i + 1];
      if (marker === 0xda) break;
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      const id = String.fromCharCode(...bytes.subarray(i + 4, i + 9));
      if (marker === 0xe0 && id === "JFIF\0") {
        const unit = bytes[i + 11];
        const x = (bytes[i + 12] << 8) | bytes[i + 13];
        const y = (bytes[i + 14] << 8) | bytes[i + 15];
        if (unit === 1) jfif = { x, y, source: "JFIF header" };
        else if (unit === 2) jfif = { x: Math.round(x * 2.54), y: Math.round(y * 2.54), source: "JFIF header (dots per cm)" };
        else jfif = { x: null, y: null, source: "JFIF header (aspect ratio only)" };
      }
      if (marker === 0xe1 && id.startsWith("Exif")) exif = readExifResolution(bytes.subarray(i + 10, i + 2 + len));
      i += 2 + len;
    }
    return exif ?? jfif ?? { x: null, y: null, source: "No resolution metadata" };
  }
  return { x: null, y: null, source: `DPI metadata is not read for ${kind.toUpperCase()} files` };
}

function readExifResolution(tiff: Uint8Array): DpiInfo | null {
  if (tiff.length < 8) return null;
  const le = tiff[0] === 0x49;
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  try {
    const ifd = u32(4);
    const n = u16(ifd);
    let x: number | null = null, y: number | null = null, unit = 2;
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      const tag = u16(e);
      if (tag === 0x011a || tag === 0x011b) {
        const off = u32(e + 8);
        const val = u32(off) / (u32(off + 4) || 1);
        if (tag === 0x011a) x = val;
        else y = val;
      } else if (tag === 0x0128) unit = u16(e + 8);
    }
    if (x === null && y === null) return null;
    const f = unit === 3 ? 2.54 : 1;
    return { x: x !== null ? Math.round(x * f) : null, y: y !== null ? Math.round(y * f) : null, source: "EXIF XResolution/YResolution" };
  } catch {
    return null;
  }
}

/** Writes DPI into a PNG by inserting/replacing the pHYs chunk. */
export function setPngDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (sniffImage(bytes) !== "png") throw new Error("Not a PNG file.");
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const src = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  let inserted = false;
  while (i + 8 <= bytes.length) {
    const len = src.getUint32(i);
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    const end = i + 12 + len;
    if (type === "pHYs") {
      i = end;
      continue;
    }
    if (!inserted && type === "IDAT") {
      parts.push(chunk);
      inserted = true;
    }
    parts.push(bytes.subarray(i, end));
    i = end;
  }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

let crcTable: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Reads pixel dimensions from the header without decoding (PNG, JPEG, GIF, WebP). */
export function readDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const kind = sniffImage(bytes);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (kind === "png") return { width: dv.getUint32(16), height: dv.getUint32(20) };
    if (kind === "gif") return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) };
    if (kind === "jpeg") {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) return null;
        const m = bytes[i + 1];
        const len = dv.getUint16(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) };
        i += 2 + len;
      }
    }
    if (kind === "webp") {
      const fmt = String.fromCharCode(...bytes.subarray(12, 16));
      if (fmt === "VP8 ") return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
      if (fmt === "VP8L") {
        const b = dv.getUint32(21, true);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (fmt === "VP8X") return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    }
  } catch {
    return null;
  }
  return null;
}

/** Parses "1-3, 5, 8-" into zero-based page indices for a document with `total` pages. */
export function parsePageRanges(input: string, total: number): number[] {
  const s = input.trim();
  if (!s) throw new Error("Enter pages, for example: 1-3, 5, 8-10");
  const out: number[] = [];
  for (const raw of s.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m || (!m[1] && !m[3])) throw new Error(`"${part}" is not a valid page or range.`);
    const start = m[1] ? Number(m[1]) : 1;
    const end = m[2] ? (m[3] ? Number(m[3]) : total) : start;
    if (start < 1 || end > total || start > end) throw new Error(`Range "${part}" is outside 1–${total}.`);
    for (let p = start; p <= end; p++) out.push(p - 1);
  }
  if (out.length === 0) throw new Error("No pages selected.");
  return out;
}

export function uniqueSorted(nums: number[]): number[] {
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "image";
  return `${base}.${ext}`;
}
