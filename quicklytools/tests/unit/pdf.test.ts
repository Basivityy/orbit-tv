import { describe, expect, it } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import * as P from "@/tools/logic/pdfops";

async function makePdf(pages: number, size: [number, number] = [595.28, 841.89], title?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage(size).drawText(`Page ${i + 1}`, { x: 50, y: 50, size: 12 });
  if (title) doc.setTitle(title);
  return doc.save();
}

// 1×1 red PNG
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64"));

describe("pdf operations", () => {
  it("counts pages and rejects non-PDFs", async () => {
    expect(await P.pageCount(await makePdf(3))).toBe(3);
    await expect(P.loadPdf(new TextEncoder().encode("not a pdf"))).rejects.toThrow(/could not be read/);
  });
  it("merges in order", async () => {
    const out = await P.mergePdfs([await makePdf(2), await makePdf(3, [612, 792])]);
    const sizes = await P.pageSizes(out);
    expect(sizes).toHaveLength(5);
    expect(sizes[2].name).toBe("US Letter portrait");
    await expect(P.mergePdfs([await makePdf(1)])).rejects.toThrow(/at least two/);
  });
  it("selects, deletes and reorders pages", async () => {
    const src = await makePdf(5);
    expect(await P.pageCount(await P.selectPages(src, [4, 0]))).toBe(2);
    expect(await P.pageCount(await P.deletePages(src, [1, 2]))).toBe(3);
    await expect(P.deletePages(src, [0, 1, 2, 3, 4])).rejects.toThrow(/at least one/);
    await expect(P.selectPages(src, [9])).rejects.toThrow(/does not exist/);
  });
  it("splits every N pages and by ranges", async () => {
    const src = await makePdf(5);
    const parts = await P.splitPdf(src, { kind: "every", size: 2 });
    expect(parts.map((p) => p.name)).toEqual(["pages-1-2.pdf", "pages-3-4.pdf", "page-5.pdf"]);
    const r = await P.splitPdf(src, { kind: "ranges", ranges: [[0], [1, 2, 3]] });
    expect(await P.pageCount(r[1].bytes)).toBe(3);
  });
  it("rotates selected pages", async () => {
    const out = await P.rotatePdf(await makePdf(2), 90, [1]);
    const sizes = await P.pageSizes(out);
    expect(sizes[0].rotation).toBe(0);
    expect(sizes[1].rotation).toBe(90);
    expect(sizes[1].name).toBe("A4 landscape");
  });
  it("reads and writes metadata", async () => {
    const m = await P.readMetadata(await makePdf(1, undefined, "Original"));
    expect(m.title).toBe("Original");
    expect(m.encrypted).toBe(false);
    const updated = await P.writeMetadata(await makePdf(1), { title: "New", author: "Ada", subject: "S", keywords: "a, b" });
    const m2 = await P.readMetadata(updated);
    expect([m2.title, m2.author]).toEqual(["New", "Ada"]);
  });
  it("encrypts with a password and unlocks again", async () => {
    const enc = await P.protectPdf(await makePdf(2), { userPassword: "s3cret-pass", allowPrinting: true, allowCopying: false, allowModifying: false });
    expect(await P.isEncrypted(enc)).toBe(true);
    await expect(P.loadPdf(enc)).rejects.toThrow(/password-protected/);
    await expect(P.unlockPdf(enc, "wrong")).rejects.toThrow(/incorrect/);
    const plain = await P.unlockPdf(enc, "s3cret-pass");
    expect(await P.isEncrypted(plain)).toBe(false);
    expect(await P.pageCount(plain)).toBe(2);
    await expect(P.unlockPdf(plain, "x")).rejects.toThrow(/not password-protected/);
    await expect(P.protectPdf(plain, { userPassword: "ab", allowPrinting: true, allowCopying: true, allowModifying: true })).rejects.toThrow();
  });
  it("adds watermark and page numbers", async () => {
    const w = await P.watermarkPdf(await makePdf(2), { text: "CONFIDENTIAL ✓", fontSize: 40, opacity: 0.2, rotation: 45, color: "#ff0000", position: "tile" });
    expect(w.replaced).toBe(1);
    expect(await P.pageCount(w.bytes)).toBe(2);
    await expect(P.watermarkPdf(await makePdf(1), { text: " ", fontSize: 10, opacity: 1, rotation: 0, color: "#000000", position: "center" })).rejects.toThrow();
    const n = await P.addPageNumbers(await makePdf(3), { format: "Page {n} of {total}", position: "bottom-center", fontSize: 10, start: 1, margin: 30, skipFirst: true });
    expect(await P.pageCount(n)).toBe(3);
  });
  it("creates PDFs from images and text", async () => {
    const fit = await P.imagesToPdf([{ bytes: PNG, type: "png" }], { pageSize: "fit", orientation: "auto", margin: 0 });
    expect((await P.pageSizes(fit))[0]).toMatchObject({ widthPt: 1, heightPt: 1 });
    const a4 = await P.imagesToPdf([{ bytes: PNG, type: "png" }, { bytes: PNG, type: "png" }], { pageSize: "a4", orientation: "landscape", margin: 20 });
    expect((await P.pageSizes(a4))[1].name).toBe("A4 landscape");
    await expect(P.imagesToPdf([], { pageSize: "a4", orientation: "auto", margin: 0 })).rejects.toThrow();
    const t = await P.textToPdf("Hello\n\n" + "word ".repeat(3000) + "\nЖ", { fontSize: 11, font: "Helvetica", pageSize: "letter", margin: 54 });
    expect(t.pages).toBeGreaterThan(1);
    expect(t.replaced).toBe(1);
    await expect(P.textToPdf("   ", { fontSize: 11, font: "Courier", pageSize: "a4", margin: 54 })).rejects.toThrow();
  });
  it("stamps a signature image", async () => {
    const out = await P.stampImage(await makePdf(2), PNG, { pageIndex: 1, xFrac: 0.5, yFrac: 0.5, widthFrac: 0.2 });
    expect(await P.pageCount(out)).toBe(2);
  });
  it("paper names", () => {
    expect(P.paperName(595, 842)).toBe("A4 portrait");
    expect(P.paperName(792, 612)).toBe("US Letter landscape");
    expect(P.paperName(100, 100)).toBe("Custom");
  });
});
