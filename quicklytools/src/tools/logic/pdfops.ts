/**
 * PDF operations built on pdf-lib (@cantoo fork with encryption support).
 * Pure functions on bytes: they run in the browser and in Node (unit tests).
 */
import { PDFDict, PDFDocument, PDFName, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";

export const MAX_PDF_MB = 200;

export async function loadPdf(bytes: Uint8Array, password?: string): Promise<PDFDocument> {
  try {
    const doc = await PDFDocument.load(bytes, password !== undefined ? { password } : { ignoreEncryption: false, updateMetadata: false });
    return doc;
  } catch (e) {
    const msg = (e as Error).message || "";
    if (/encrypt/i.test(msg) || /password/i.test(msg)) {
      throw new Error(password !== undefined ? "The password is incorrect." : "This PDF is password-protected. Unlock it first with the PDF Unlock tool.");
    }
    throw new Error("This file could not be read as a PDF. It may be damaged or not a PDF.");
  }
}

async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return doc.getPageCount();
}

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length < 2) throw new Error("Add at least two PDF files to merge.");
  const out = await PDFDocument.create();
  for (const [i, bytes] of files.entries()) {
    let src: PDFDocument;
    try {
      src = await loadPdf(bytes);
    } catch (e) {
      throw new Error(`File ${i + 1}: ${(e as Error).message}`);
    }
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return save(out);
}

/** Builds a new PDF containing the given zero-based page indices in that order. */
export async function selectPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const total = src.getPageCount();
  if (indices.length === 0) throw new Error("No pages selected.");
  for (const i of indices) if (i < 0 || i >= total) throw new Error(`Page ${i + 1} does not exist (document has ${total} pages).`);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  copyInfo(src, out);
  return save(out);
}

function copyInfo(src: PDFDocument, out: PDFDocument) {
  const t = src.getTitle();
  if (t) out.setTitle(t);
  const a = src.getAuthor();
  if (a) out.setAuthor(a);
}

export async function deletePages(bytes: Uint8Array, remove: number[]): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const total = src.getPageCount();
  const del = new Set(remove);
  const keep = src.getPageIndices().filter((i) => !del.has(i));
  if (keep.length === 0) throw new Error("You cannot delete every page. Keep at least one.");
  if (keep.length === total) throw new Error("Select at least one page to delete.");
  return selectPages(bytes, keep);
}

export type SplitMode = { kind: "every"; size: number } | { kind: "ranges"; ranges: number[][] };

export async function splitPdf(bytes: Uint8Array, mode: SplitMode): Promise<{ name: string; bytes: Uint8Array }[]> {
  const src = await loadPdf(bytes);
  const total = src.getPageCount();
  let groups: number[][];
  if (mode.kind === "every") {
    if (!Number.isInteger(mode.size) || mode.size < 1) throw new Error("Pages per file must be a whole number of at least 1.");
    groups = [];
    for (let i = 0; i < total; i += mode.size) groups.push(Array.from({ length: Math.min(mode.size, total - i) }, (_, k) => i + k));
  } else groups = mode.ranges;
  if (groups.length > 1000) throw new Error("That would create more than 1,000 files.");
  const out: { name: string; bytes: Uint8Array }[] = [];
  for (const g of groups) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(src, g);
    pages.forEach((p) => doc.addPage(p));
    const label = g.length === 1 ? `page-${g[0] + 1}` : `pages-${g[0] + 1}-${g[g.length - 1] + 1}`;
    out.push({ name: `${label}.pdf`, bytes: await save(doc) });
  }
  return out;
}

export async function rotatePdf(bytes: Uint8Array, angle: 90 | 180 | 270, pages?: number[]): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const set = pages ? new Set(pages) : null;
  doc.getPages().forEach((p, i) => {
    if (set && !set.has(i)) return;
    p.setRotation(degrees((p.getRotation().angle + angle) % 360));
  });
  return save(doc);
}

export interface PageSizeInfo {
  index: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  name: string;
}

const PAPER: [string, number, number][] = [
  ["A3", 842, 1191], ["A4", 595, 842], ["A5", 420, 595], ["A6", 298, 420], ["B5", 499, 709],
  ["US Letter", 612, 792], ["US Legal", 612, 1008], ["Tabloid", 792, 1224], ["Executive", 522, 756],
];

export function paperName(w: number, h: number): string {
  const [a, b] = w < h ? [w, h] : [h, w];
  for (const [n, pw, ph] of PAPER) if (Math.abs(a - pw) <= 3 && Math.abs(b - ph) <= 3) return `${n} ${w > h ? "landscape" : "portrait"}`;
  return "Custom";
}

export async function pageSizes(bytes: Uint8Array): Promise<PageSizeInfo[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return doc.getPages().map((p, index) => {
    const { width, height } = p.getSize();
    const rotation = p.getRotation().angle;
    const [w, h] = rotation % 180 === 0 ? [width, height] : [height, width];
    return { index, widthPt: w, heightPt: h, rotation, name: paperName(w, h) };
  });
}

export interface PdfMeta {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  created?: Date;
  modified?: Date;
  pages: number;
  encrypted: boolean;
  version: string;
}

export async function readMetadata(bytes: Uint8Array): Promise<PdfMeta> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const header = new TextDecoder().decode(bytes.subarray(0, 16)).match(/%PDF-(\d\.\d)/);
  const safe = <T,>(f: () => T): T | undefined => {
    try {
      return f() ?? undefined;
    } catch {
      return undefined;
    }
  };
  return {
    title: safe(() => doc.getTitle()),
    author: safe(() => doc.getAuthor()),
    subject: safe(() => doc.getSubject()),
    keywords: safe(() => doc.getKeywords()),
    creator: safe(() => doc.getCreator()),
    producer: safe(() => doc.getProducer()),
    created: safe(() => doc.getCreationDate()),
    modified: safe(() => doc.getModificationDate()),
    pages: doc.getPageCount(),
    encrypted: doc.isEncrypted,
    version: header ? header[1] : "unknown",
  };
}

export async function writeMetadata(bytes: Uint8Array, m: { title: string; author: string; subject: string; keywords: string }): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  doc.setTitle(m.title);
  doc.setAuthor(m.author);
  doc.setSubject(m.subject);
  doc.setKeywords(m.keywords.split(",").map((k) => k.trim()).filter(Boolean));
  doc.setModificationDate(new Date());
  return save(doc);
}

// Characters representable in WinAnsiEncoding (Windows-1252), used by the standard 14 PDF fonts.
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
export function isWinAnsi(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252_EXTRA.has(ch);
}

/** Standard 14 fonts only cover WinAnsi (Western European); other characters become "?". */
export function toWinAnsi(text: string, _font?: PDFFont): { text: string; replaced: number } {
  let replaced = 0;
  let out = "";
  for (const ch of text.replace(/\t/g, "    ")) {
    if (ch === "\n" || isWinAnsi(ch)) out += ch;
    else {
      out += "?";
      replaced++;
    }
  }
  return { text: out, replaced };
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

export async function watermarkPdf(
  bytes: Uint8Array,
  o: { text: string; fontSize: number; opacity: number; rotation: number; color: string; position: "center" | "top" | "bottom" | "tile" },
): Promise<{ bytes: Uint8Array; replaced: number }> {
  if (!o.text.trim()) throw new Error("Enter watermark text.");
  const doc = await loadPdf(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const { text, replaced } = toWinAnsi(o.text, font);
  const color = hexToRgb(o.color);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(text, o.fontSize);
    const draw = (cx: number, cy: number) => {
      const rad = (o.rotation * Math.PI) / 180;
      // Rotate around the text centre.
      const x = cx - (Math.cos(rad) * tw) / 2 + (Math.sin(rad) * o.fontSize) / 3;
      const y = cy - (Math.sin(rad) * tw) / 2 - (Math.cos(rad) * o.fontSize) / 3;
      page.drawText(text, { x, y, size: o.fontSize, font, color, opacity: o.opacity, rotate: degrees(o.rotation) });
    };
    if (o.position === "tile") {
      const stepX = Math.max(tw * 0.9, 150), stepY = Math.max(o.fontSize * 4, 120);
      for (let y = stepY / 2; y < height; y += stepY) for (let x = stepX / 2; x < width + stepX; x += stepX) draw(x, y);
    } else draw(width / 2, o.position === "top" ? height - 60 : o.position === "bottom" ? 60 : height / 2);
  }
  return { bytes: await save(doc), replaced };
}

export async function addPageNumbers(
  bytes: Uint8Array,
  o: { format: string; position: "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left"; fontSize: number; start: number; margin: number; skipFirst: boolean },
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((page: PDFPage, i) => {
    if (o.skipFirst && i === 0) return;
    const n = o.start + i - (o.skipFirst ? 1 : 0);
    const label = toWinAnsi(o.format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total - (o.skipFirst ? 1 : 0) + o.start - 1)), font).text;
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(label, o.fontSize);
    const [v, h] = o.position.split("-");
    const x = h === "left" ? o.margin : h === "right" ? width - o.margin - tw : (width - tw) / 2;
    const y = v === "top" ? height - o.margin - o.fontSize : o.margin;
    page.drawText(label, { x, y, size: o.fontSize, font, color: rgb(0.2, 0.2, 0.2) });
  });
  return save(doc);
}

export async function protectPdf(bytes: Uint8Array, o: { userPassword: string; ownerPassword?: string; allowPrinting: boolean; allowCopying: boolean; allowModifying: boolean }): Promise<Uint8Array> {
  if (o.userPassword.length < 4) throw new Error("Use a password of at least 4 characters (12+ recommended).");
  const doc = await loadPdf(bytes);
  doc.encrypt({
    userPassword: o.userPassword,
    ownerPassword: o.ownerPassword || o.userPassword + "-owner-" + Math.random().toString(36).slice(2),
    permissions: {
      printing: o.allowPrinting ? "highResolution" : false,
      copying: o.allowCopying,
      modifying: o.allowModifying,
      annotating: o.allowModifying,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: o.allowModifying,
    },
  });
  return save(doc);
}

export async function isEncrypted(bytes: Uint8Array): Promise<boolean> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return doc.isEncrypted;
}

export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  if (!(await isEncrypted(bytes))) throw new Error("This PDF is not password-protected.");
  const doc = await loadPdf(bytes, password);
  // The decrypted document still carries the orphaned encryption dictionary; drop it so
  // viewers don't treat the saved copy as encrypted.
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of("Filter"))?.toString() === "/Standard" && obj.has(PDFName.of("O"))) doc.context.delete(ref);
  }
  return save(doc);
}

export type PageSizeOption = "fit" | "a4" | "letter";

const PAGE_DIMS: Record<Exclude<PageSizeOption, "fit">, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };

export async function imagesToPdf(
  images: { bytes: Uint8Array; type: "jpg" | "png" }[],
  o: { pageSize: PageSizeOption; orientation: "auto" | "portrait" | "landscape"; margin: number },
): Promise<Uint8Array> {
  if (images.length === 0) throw new Error("Add at least one image.");
  const doc = await PDFDocument.create();
  for (const img of images) {
    const embedded = img.type === "jpg" ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes);
    const iw = embedded.width, ih = embedded.height;
    if (o.pageSize === "fit") {
      const page = doc.addPage([iw + o.margin * 2, ih + o.margin * 2]);
      page.drawImage(embedded, { x: o.margin, y: o.margin, width: iw, height: ih });
      continue;
    }
    let [pw, ph] = PAGE_DIMS[o.pageSize];
    const landscape = o.orientation === "landscape" || (o.orientation === "auto" && iw > ih);
    if (landscape) [pw, ph] = [ph, pw];
    const page = doc.addPage([pw, ph]);
    const aw = pw - o.margin * 2, ah = ph - o.margin * 2;
    const s = Math.min(aw / iw, ah / ih, 1e9);
    const w = iw * s, h = ih * s;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  doc.setCreator("QuicklyTools");
  return save(doc);
}

export async function textToPdf(
  text: string,
  o: { fontSize: number; font: "Helvetica" | "TimesRoman" | "Courier"; pageSize: "a4" | "letter"; margin: number; title?: string },
): Promise<{ bytes: Uint8Array; replaced: number; pages: number }> {
  if (!text.trim()) throw new Error("Enter some text first.");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts[o.font]);
  const [pw, ph] = PAGE_DIMS[o.pageSize];
  const lineH = o.fontSize * 1.4;
  const maxW = pw - o.margin * 2;
  const { text: clean, replaced } = toWinAnsi(text.replace(/\r\n?/g, "\n"), font);
  const lines: string[] = [];
  for (const para of clean.split("\n")) {
    if (para === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (font.widthOfTextAtSize(test, o.fontSize) <= maxW) line = test;
      else if (line.trim() === "") {
        // Break very long words character by character.
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, o.fontSize) > maxW) {
            lines.push(chunk);
            chunk = "";
          }
          chunk += ch;
        }
        line = chunk;
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  const perPage = Math.max(1, Math.floor((ph - o.margin * 2) / lineH));
  for (let i = 0; i < lines.length; i += perPage) {
    const page = doc.addPage([pw, ph]);
    lines.slice(i, i + perPage).forEach((l, k) => {
      if (l) page.drawText(l, { x: o.margin, y: ph - o.margin - o.fontSize - k * lineH, size: o.fontSize, font, color: rgb(0.1, 0.1, 0.1) });
    });
  }
  if (o.title) doc.setTitle(o.title);
  doc.setCreator("QuicklyTools");
  return { bytes: await save(doc), replaced, pages: doc.getPageCount() };
}

/** Places a PNG image (signature) on one page. Coordinates are fractions of the page (0..1, origin top-left). */
export async function stampImage(
  bytes: Uint8Array,
  png: Uint8Array,
  o: { pageIndex: number; xFrac: number; yFrac: number; widthFrac: number; allPages?: boolean },
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const img = await doc.embedPng(png);
  const pages = o.allPages ? doc.getPages() : [doc.getPage(o.pageIndex)];
  for (const page of pages) {
    const { width, height } = page.getSize();
    const w = width * o.widthFrac;
    const h = (img.height / img.width) * w;
    page.drawImage(img, { x: width * o.xFrac - w / 2, y: height - height * o.yFrac - h / 2, width: w, height: h });
  }
  return save(doc);
}

/** Builds a PDF from page images (used by grayscale conversion). */
export async function pdfFromJpegPages(pages: { jpg: Uint8Array; widthPt: number; heightPt: number }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const img = await doc.embedJpg(p.jpg);
    const page = doc.addPage([p.widthPt, p.heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
  }
  return save(doc);
}
