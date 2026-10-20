"use client";

/** Lazy loader for Mozilla PDF.js (legacy build for wider browser support). */
type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfJs> | null = null;

export function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      return m;
    });
  }
  return pdfjsPromise;
}

export type PdfJsDoc = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;

export async function openPdf(bytes: Uint8Array, password?: string): Promise<PdfJsDoc> {
  const pdfjs = await getPdfJs();
  // pdf.js transfers the buffer to its worker, so pass a copy.
  const task = pdfjs.getDocument({ data: bytes.slice(), password, isEvalSupported: false, disableFontFace: false });
  try {
    return await task.promise;
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === "PasswordException") throw new Error(password ? "The password is incorrect." : "This PDF is password-protected. Unlock it first.");
    throw new Error("This file could not be opened as a PDF.");
  }
}

/** Renders one page (1-based) to a canvas at the given scale (1 = 72 DPI). */
export async function renderPage(doc: PdfJsDoc, pageNumber: number, scale: number, opts: { grayscale?: boolean; background?: string } = {}): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  if (canvas.width * canvas.height > 60_000_000) throw new Error("The requested resolution is too high for this page. Lower the DPI.");
  const ctx = canvas.getContext("2d", { willReadFrequently: !!opts.grayscale })!;
  ctx.fillStyle = opts.background ?? "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  if (opts.grayscale) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    ctx.putImageData(img, 0, 0);
  }
  return canvas;
}

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Image encoding failed."))), type, quality));
}
