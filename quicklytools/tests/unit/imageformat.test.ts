import { describe, expect, it } from "vitest";
import * as I from "@/tools/logic/imageformat";
import { applyPixelFilter, boxBlur } from "@/tools/imaging/pipeline";
import { parseUserAgent } from "@/tools/logic/useragent";

// Minimal 1×1 PNG with a tEXt chunk and pHYs (72 dpi), and a tiny JPEG with APP1/COM.
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, I.crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const ihdr = new Uint8Array([0, 0, 0, 2, 0, 0, 0, 3, 8, 6, 0, 0, 0]);
const phys = new Uint8Array(9);
new DataView(phys.buffer).setUint32(0, 2835);
new DataView(phys.buffer).setUint32(4, 2835);
phys[8] = 1;
const png = concat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("tEXt", new TextEncoder().encode("Author\0Me")), chunk("pHYs", phys), chunk("IDAT", new Uint8Array([1, 2, 3])), chunk("IEND", new Uint8Array()));

const jfif = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, 0, 150, 0, 150, 0, 0]);
const app1 = concat(new Uint8Array([0xff, 0xe1, 0, 10]), new TextEncoder().encode("Exif\0\0"), new Uint8Array([0, 0]));
const com = concat(new Uint8Array([0xff, 0xfe, 0, 6]), new TextEncoder().encode("hi!!"));
const sof = new Uint8Array([0xff, 0xc0, 0, 11, 8, 0, 20, 0, 30, 1, 1, 0x11, 0]);
const sos = new Uint8Array([0xff, 0xda, 0, 2, 0x12, 0x34, 0xff, 0xd9]);
const jpeg = concat(new Uint8Array([0xff, 0xd8]), jfif, app1, com, sof, sos);

describe("image byte formats", () => {
  it("sniffs formats", () => {
    expect(I.sniffImage(png)).toBe("png");
    expect(I.sniffImage(jpeg)).toBe("jpeg");
    expect(I.sniffImage(new TextEncoder().encode("<svg xmlns='x'></svg>"))).toBe("svg");
    expect(I.sniffImage(concat(new Uint8Array([0, 0, 0, 0x1c]), new TextEncoder().encode("ftypheic")))).toBe("heic");
    expect(I.sniffImage(new Uint8Array([1, 2, 3, 4]))).toBe("unknown");
  });
  it("reads dimensions and DPI", () => {
    expect(I.readDimensions(png)).toEqual({ width: 2, height: 3 });
    expect(I.readDimensions(jpeg)).toEqual({ width: 30, height: 20 });
    expect(I.readDpi(png)).toMatchObject({ x: 72, y: 72 });
    expect(I.readDpi(jpeg)).toMatchObject({ x: 150, y: 150, source: "JFIF header" });
  });
  it("strips JPEG metadata losslessly", () => {
    const r = I.stripJpegMetadata(jpeg);
    expect(r.removed).toEqual(["Exif (APP1)", "Comment"]);
    expect(r.output.length).toBe(jpeg.length - app1.length - com.length);
    expect(I.readDimensions(r.output)).toEqual({ width: 30, height: 20 });
    expect(Array.from(r.output.slice(-8))).toEqual(Array.from(sos));
    expect(() => I.stripJpegMetadata(png)).toThrow();
  });
  it("strips PNG text chunks and sets DPI", () => {
    const r = I.stripPngMetadata(png);
    expect(r.removed).toEqual(["tEXt"]);
    const d = I.setPngDpi(r.output, 300);
    expect(I.readDpi(d)).toMatchObject({ x: 300, y: 300 });
    expect(I.readDimensions(d)).toEqual({ width: 2, height: 3 });
  });
  it("builds and parses ICO", () => {
    const ico = I.buildIco([{ width: 16, height: 16, png }, { width: 256, height: 256, png }]);
    expect(I.parseIco(ico)).toEqual([{ width: 16, height: 16, size: png.length }, { width: 256, height: 256, size: png.length }]);
    expect(() => I.buildIco([])).toThrow();
    expect(I.crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
  it("parses page ranges", () => {
    expect(I.parsePageRanges("1-3, 5, 8-", 10)).toEqual([0, 1, 2, 4, 7, 8, 9]);
    expect(() => I.parsePageRanges("0", 5)).toThrow();
    expect(() => I.parsePageRanges("4-2", 5)).toThrow();
    expect(() => I.parsePageRanges("x", 5)).toThrow();
    expect(I.uniqueSorted([3, 1, 3])).toEqual([1, 3]);
    expect(I.replaceExtension("photo.final.jpeg", "png")).toBe("photo.final.png");
  });
});

describe("pixel filters", () => {
  it("grayscale, brightness and contrast", () => {
    const d = new Uint8ClampedArray([255, 0, 0, 255]);
    applyPixelFilter(d, { type: "grayscale" });
    expect(d[0]).toBe(d[1]);
    expect(d[0]).toBe(54);
    const b = new Uint8ClampedArray([100, 100, 100, 255]);
    applyPixelFilter(b, { type: "brightness", amount: 50 });
    expect(b[0]).toBe(150);
    const c = new Uint8ClampedArray([200, 50, 128, 255]);
    applyPixelFilter(c, { type: "contrast", amount: 100 });
    expect(Array.from(c.slice(0, 3))).toEqual([255, 0, 128]);
  });
  it("blur preserves a uniform image and averages edges", () => {
    const w = 10, h = 10;
    const u = new Uint8ClampedArray(w * h * 4).fill(200);
    boxBlur(u, w, h, 3);
    expect(Array.from(new Set(u))).toEqual([200]);
    const edge = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const v = i % w < 5 ? 0 : 255;
      edge.set([v, v, v, 255], i * 4);
    }
    boxBlur(edge, w, h, 2);
    const mid = edge[(5 * w + 5) * 4];
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(255);
  });
});

describe("user agent parsing", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", "Chrome", "Windows", "Blink", "desktop"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "Microsoft Edge", "Windows", "Blink", "desktop"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox", "macOS", "Gecko", "desktop"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", "Safari", "iOS", "WebKit", "mobile"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", "Chrome", "Android", "Blink", "mobile"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Unknown", "Unknown", "Unknown", "bot"],
  ])("%s", (ua, browser, os, engine, device) => {
    const p = parseUserAgent(ua);
    expect([p.browser, p.os, p.engine, p.device]).toEqual([browser, os, engine, device]);
  });
});
