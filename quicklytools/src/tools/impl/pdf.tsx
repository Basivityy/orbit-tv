"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eraser, FileText, Loader2, RotateCw, X } from "lucide-react";
import * as P from "../logic/pdfops";
import { parsePageRanges, uniqueSorted } from "../logic/imageformat";
import { canvasToBlob, openPdf, renderPage, type PdfJsDoc } from "../pdf/render";
import { decodeImage } from "../imaging/client";
import {
  Checkbox, DataTable, DownloadButton, ErrorBox, Field, FileDrop, KeyValueList, Notice, NumberInput, Panel, Range, Segmented, Select,
  downloadBlob, formatBytes, useReportUse,
} from "../ui/kit";

const PDF_ACCEPT = "application/pdf,.pdf";
const pdfBlob = (b: Uint8Array) => new Blob([b as BlobPart], { type: "application/pdf" });
const baseName = (n: string) => n.replace(/\.pdf$/i, "");

async function zipAndDownload(files: { name: string; bytes: Uint8Array }[], zipName: string) {
  const { zipSync } = await import("fflate");
  const obj: Record<string, Uint8Array> = {};
  for (const f of files) obj[f.name] = f.bytes;
  downloadBlob(new Blob([zipSync(obj, { level: 0 }) as BlobPart], { type: "application/zip" }), zipName);
}

// ---------- Shared single-PDF loader ----------

interface Loaded {
  file: File;
  bytes: Uint8Array;
  pages: number;
  doc: PdfJsDoc | null;
}

function useSinglePdf(withPreview = true) {
  const [pdf, setPdf] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => () => void pdf?.doc?.destroy(), [pdf]);
  const load = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (await P.isEncrypted(bytes).catch(() => false)) throw new Error("This PDF is password-protected. Remove the password with the PDF Unlock tool first.");
      const pages = await P.pageCount(bytes);
      const doc = withPreview ? await openPdf(bytes).catch(() => null) : null;
      setPdf({ file, bytes, pages, doc });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return { pdf, error, setError, loading, load, reset: () => setPdf(null) };
}

function PdfHeader({ pdf, onReset }: { pdf: Loaded; onReset: () => void }) {
  return (
    <div className="surface flex items-center gap-3 rounded-xl p-3">
      <FileText className="h-8 w-8 shrink-0 text-red-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{pdf.file.name}</p>
        <p className="text-muted text-xs">{pdf.pages} page{pdf.pages === 1 ? "" : "s"} · {formatBytes(pdf.file.size)}</p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
        <X className="h-4 w-4" aria-hidden /> Change file
      </button>
    </div>
  );
}

function PdfLoader({ state, children }: { state: ReturnType<typeof useSinglePdf>; children: (pdf: Loaded) => ReactNode }) {
  if (!state.pdf)
    return (
      <div className="space-y-3">
        <FileDrop accept={PDF_ACCEPT} maxSizeMB={P.MAX_PDF_MB} onFiles={([f]) => void state.load(f)} disabled={state.loading} label={state.loading ? "Opening PDF…" : "Choose a PDF or drop it here"} />
        {state.error && <ErrorBox message={state.error} />}
      </div>
    );
  return (
    <div className="space-y-4">
      <PdfHeader pdf={state.pdf} onReset={state.reset} />
      {children(state.pdf)}
      {state.error && <ErrorBox message={state.error} />}
    </div>
  );
}

// ---------- Thumbnails ----------

function Thumb({ doc, page, rotate = 0 }: { doc: PdfJsDoc; page: number; rotate?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      try {
        const c = await renderPage(doc, page, 0.3);
        const b = await canvasToBlob(c, "image/jpeg", 0.7);
        if (!cancelled) setUrl((made = URL.createObjectURL(b)));
      } catch {
        /* thumbnail failures are non-fatal */
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      if (made) URL.revokeObjectURL(made);
    };
  }, [doc, page]);
  return (
    <div ref={ref} className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-white">
      {url ? <img src={url} alt={`Page ${page}`} className="max-h-full max-w-full shadow-sm transition-transform" style={{ transform: `rotate(${rotate}deg)` }} /> : <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />}
    </div>
  );
}

function PageGrid({ count, doc, render }: { count: number; doc: PdfJsDoc | null; render: (i: number, thumb: ReactNode) => ReactNode }) {
  if (count > 500) return <Notice>Page previews are hidden for documents over 500 pages. Use the page range field instead.</Notice>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }, (_, i) => render(i, doc ? <Thumb doc={doc} page={i + 1} /> : <div className="bg-surface-2 flex aspect-[3/4] items-center justify-center rounded-md text-xs">Page {i + 1}</div>))}
    </div>
  );
}

// ---------- Merge ----------

function MergePdf() {
  const [files, setFiles] = useState<{ file: File; pages: number | null; error?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const add = async (list: File[]) => {
    const entries = await Promise.all(
      list.map(async (file) => {
        try {
          return { file, pages: await P.pageCount(new Uint8Array(await file.arrayBuffer())) };
        } catch {
          return { file, pages: null, error: "Not a readable PDF" };
        }
      }),
    );
    setFiles((p) => [...p, ...entries]);
  };
  const move = (i: number, d: number) => setFiles((p) => {
    const a = [...p];
    const j = i + d;
    if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  });
  const merge = async () => {
    setBusy(true);
    setError(null);
    try {
      const bytes = await Promise.all(files.map(async (f) => new Uint8Array(await f.file.arrayBuffer())));
      downloadBlob(pdfBlob(await P.mergePdfs(bytes)), "merged.pdf");
      report();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const total = files.reduce((s, f) => s + (f.pages ?? 0), 0);
  return (
    <div className="space-y-4">
      <FileDrop accept={PDF_ACCEPT} multiple maxSizeMB={P.MAX_PDF_MB} maxFiles={100} onFiles={(f) => void add(f)} label="Add PDF files" />
      {files.length > 0 && (
        <ol className="space-y-2">
          {files.map((f, i) => (
            <li key={`${f.file.name}-${i}`} className="surface flex items-center gap-3 rounded-xl p-2.5">
              <span className="bg-surface-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.file.name}</p>
                <p className={`text-xs ${f.error ? "text-red-600" : "text-muted"}`}>{f.error ?? `${f.pages} pages · ${formatBytes(f.file.size)}`}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" aria-hidden /></button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Move down" disabled={i === files.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" aria-hidden /></button>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><X className="h-4 w-4" aria-hidden /></button>
            </li>
          ))}
        </ol>
      )}
      {error && <ErrorBox message={error} />}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <DownloadButton label={busy ? "Merging…" : `Merge ${files.length} files (${total} pages)`} disabled={busy || files.length < 2 || files.some((f) => f.error)} onClick={() => void merge()} />
          {files.length < 2 && <span className="text-muted text-sm">Add at least two files.</span>}
        </div>
      )}
    </div>
  );
}

// ---------- Split ----------

function SplitPdf() {
  const state = useSinglePdf(false);
  const [mode, setMode] = useState<"every" | "ranges">("every");
  const [size, setSize] = useState("1");
  const [ranges, setRanges] = useState("1-3, 4-6");
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <Segmented ariaLabel="Split mode" value={mode} onChange={setMode} options={[{ value: "every", label: "Every N pages" }, { value: "ranges", label: "Custom ranges" }]} />
          {mode === "every" ? (
            <Field label="Pages per file" htmlFor="sp-n" className="w-40" hint={`Creates ${Math.ceil(pdf.pages / Math.max(1, Number(size) || 1))} files`}><NumberInput id="sp-n" value={size} onChange={setSize} min={1} max={pdf.pages} step={1} /></Field>
          ) : (
            <Field label="Ranges (each range becomes one file)" htmlFor="sp-r" hint="Separate files with commas, e.g. 1-3, 4, 5-10"><input id="sp-r" className="field" value={ranges} onChange={(e) => setRanges(e.target.value)} /></Field>
          )}
          <DownloadButton
            label={busy ? "Splitting…" : "Split & download ZIP"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              state.setError(null);
              try {
                const m: P.SplitMode = mode === "every" ? { kind: "every", size: Number(size) } : { kind: "ranges", ranges: ranges.split(",").map((r) => parsePageRanges(r, pdf.pages)) };
                const parts = await P.splitPdf(pdf.bytes, m);
                if (parts.length === 1) downloadBlob(pdfBlob(parts[0].bytes), `${baseName(pdf.file.name)}-${parts[0].name}`);
                else await zipAndDownload(parts.map((p) => ({ ...p, name: `${baseName(pdf.file.name)}-${p.name}` })), `${baseName(pdf.file.name)}-split.zip`);
                report();
              } catch (e) {
                state.setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </PdfLoader>
  );
}

// ---------- Rotate ----------

function RotatePdf() {
  const state = useSinglePdf();
  const [rot, setRot] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <div className="flex flex-wrap gap-2">
            {[90, 180, 270].map((a) => (
              <button key={a} type="button" className="btn btn-secondary btn-sm" onClick={() => setRot(Object.fromEntries(Array.from({ length: pdf.pages }, (_, i) => [i, ((rot[i] ?? 0) + a) % 360])))}>
                <RotateCw className="h-3.5 w-3.5" aria-hidden /> Rotate all {a === 270 ? "90° left" : `${a}°`}
              </button>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRot({})}>Reset</button>
          </div>
          <p className="text-muted text-sm">Click a page to rotate it by 90°.</p>
          <PageGrid
            count={pdf.pages}
            doc={pdf.doc}
            render={(i) => (
              <button key={i} type="button" className="surface rounded-lg p-1.5 text-center hover:border-brand-400" onClick={() => setRot((r) => ({ ...r, [i]: ((r[i] ?? 0) + 90) % 360 }))}>
                {pdf.doc ? <Thumb doc={pdf.doc} page={i + 1} rotate={rot[i] ?? 0} /> : null}
                <span className="text-muted mt-1 block text-xs">{i + 1}{rot[i] ? ` · ${rot[i]}°` : ""}</span>
              </button>
            )}
          />
          <DownloadButton
            label={busy ? "Saving…" : "Download rotated PDF"}
            disabled={busy || !Object.values(rot).some(Boolean)}
            onClick={async () => {
              setBusy(true);
              try {
                let bytes = pdf.bytes;
                for (const angle of [90, 180, 270] as const) {
                  const pages = Object.entries(rot).filter(([, a]) => a === angle).map(([i]) => Number(i));
                  if (pages.length) bytes = await P.rotatePdf(bytes, angle, pages);
                }
                downloadBlob(pdfBlob(bytes), `${baseName(pdf.file.name)}-rotated.pdf`);
                report();
              } catch (e) {
                state.setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </PdfLoader>
  );
}

// ---------- Delete / Extract (page selection) ----------

function PageSelectTool({ mode }: { mode: "delete" | "extract" }) {
  const state = useSinglePdf();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  const toggle = (i: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    return n;
  });
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Select pages by range" htmlFor="ps-r" className="min-w-60 flex-1" hint="e.g. 1-3, 7, 10-">
              <input id="ps-r" className="field" value={range} onChange={(e) => setRange(e.target.value)} />
            </Field>
            <button type="button" className="btn btn-secondary" onClick={() => {
              try {
                setSel(new Set(parsePageRanges(range, pdf.pages)));
                state.setError(null);
              } catch (e) {
                state.setError((e as Error).message);
              }
            }}>Apply</button>
            <button type="button" className="btn btn-ghost" onClick={() => setSel(new Set())}>Clear</button>
          </div>
          <p className="text-muted text-sm">{sel.size} page(s) selected to {mode}. Click pages to toggle.</p>
          <PageGrid
            count={pdf.pages}
            doc={pdf.doc}
            render={(i, thumb) => (
              <button key={i} type="button" aria-pressed={sel.has(i)} onClick={() => toggle(i)} className={`relative rounded-lg border-2 p-1.5 text-center transition ${sel.has(i) ? (mode === "delete" ? "border-red-500 opacity-60" : "border-brand-500") : "border-transparent"} bg-surface`}>
                {thumb}
                <span className="text-muted mt-1 block text-xs">{i + 1}</span>
                {sel.has(i) && <span className={`absolute top-2 right-2 rounded-full px-1.5 text-xs font-bold text-white ${mode === "delete" ? "bg-red-500" : "bg-brand-600"}`}>{mode === "delete" ? "✕" : "✓"}</span>}
              </button>
            )}
          />
          <DownloadButton
            label={busy ? "Working…" : mode === "delete" ? `Delete ${sel.size} page(s) & download` : `Extract ${sel.size} page(s)`}
            disabled={busy || sel.size === 0}
            onClick={async () => {
              setBusy(true);
              state.setError(null);
              try {
                const out = mode === "delete" ? await P.deletePages(pdf.bytes, [...sel]) : await P.selectPages(pdf.bytes, uniqueSorted([...sel]));
                downloadBlob(pdfBlob(out), `${baseName(pdf.file.name)}-${mode === "delete" ? "edited" : "extracted"}.pdf`);
                report();
              } catch (e) {
                state.setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </PdfLoader>
  );
}

// ---------- Reorder ----------

function ReorderPdf() {
  const state = useSinglePdf();
  const [order, setOrder] = useState<number[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  useEffect(() => setOrder(state.pdf ? Array.from({ length: state.pdf.pages }, (_, i) => i) : []), [state.pdf]);
  const move = (from: number, to: number) => setOrder((o) => {
    if (to < 0 || to >= o.length) return o;
    const a = [...o];
    const [x] = a.splice(from, 1);
    a.splice(to, 0, x);
    return a;
  });
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOrder((o) => [...o].reverse())}>Reverse order</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOrder(Array.from({ length: pdf.pages }, (_, i) => i))}>Reset</button>
          </div>
          <p className="text-muted text-sm">Drag pages to a new position, or use the arrows.</p>
          {pdf.pages > 500 ? <Notice>Reordering by drag is limited to 500 pages.</Notice> : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {order.map((p, pos) => (
                <div
                  key={p}
                  draggable
                  onDragStart={() => setDragFrom(pos)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => (dragFrom !== null && move(dragFrom, pos), setDragFrom(null))}
                  className={`surface cursor-grab rounded-lg p-1.5 text-center ${dragFrom === pos ? "opacity-40" : ""}`}
                >
                  {pdf.doc && <Thumb doc={pdf.doc} page={p + 1} />}
                  <div className="mt-1 flex items-center justify-between">
                    <button type="button" className="btn btn-ghost !p-1" aria-label="Move earlier" onClick={() => move(pos, pos - 1)}><ArrowLeft className="h-3.5 w-3.5" aria-hidden /></button>
                    <span className="text-muted text-xs">{pos + 1} <span className="opacity-60">(p{p + 1})</span></span>
                    <button type="button" className="btn btn-ghost !p-1" aria-label="Move later" onClick={() => move(pos, pos + 1)}><ArrowRight className="h-3.5 w-3.5" aria-hidden /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DownloadButton
            label={busy ? "Saving…" : "Download reordered PDF"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                downloadBlob(pdfBlob(await P.selectPages(pdf.bytes, order)), `${baseName(pdf.file.name)}-reordered.pdf`);
                report();
              } catch (e) {
                state.setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
    </PdfLoader>
  );
}

// ---------- Images → PDF ----------

function ImagesToPdf({ accept, label }: { accept: string; label: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<P.PageSizeOption>("a4");
  const [orientation, setOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const [margin, setMargin] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      const images: { bytes: Uint8Array; type: "jpg" | "png" }[] = [];
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (bytes[0] === 0xff && bytes[1] === 0xd8) images.push({ bytes, type: "jpg" });
        else if (bytes[0] === 0x89 && bytes[1] === 0x50) images.push({ bytes, type: "png" });
        else {
          // Other formats (WebP, HEIC…) are converted to JPEG first.
          const bmp = await decodeImage(f);
          const c = Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(bmp, 0, 0);
          bmp.close();
          images.push({ bytes: new Uint8Array(await (await canvasToBlob(c, "image/jpeg", 0.92)).arrayBuffer()), type: "jpg" });
        }
      }
      downloadBlob(pdfBlob(await P.imagesToPdf(images, { pageSize, orientation, margin })), files.length === 1 ? files[0].name.replace(/\.[^.]+$/, ".pdf") : "images.pdf");
      report();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <FileDrop accept={accept} multiple maxSizeMB={50} maxFiles={200} onFiles={(f) => setFiles((p) => [...p, ...f])} label={label} />
      {files.length > 0 && (
        <>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {files.map((f, i) => (
              <li key={i} className="surface flex items-center gap-2 rounded-lg p-2 text-xs">
                <span className="font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => setFiles((p) => { const a = [...p]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })}><ArrowLeft className="h-3.5 w-3.5" aria-hidden /></button>
                <button type="button" aria-label="Remove" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" aria-hidden /></button>
              </li>
            ))}
          </ol>
          <div className="surface grid gap-4 rounded-2xl p-4 sm:grid-cols-3">
            <Field label="Page size" htmlFor="ip-s"><Select id="ip-s" value={pageSize} onChange={setPageSize} options={[{ value: "a4", label: "A4" }, { value: "letter", label: "US Letter" }, { value: "fit", label: "Same as image" }]} /></Field>
            {pageSize !== "fit" && <Field label="Orientation" htmlFor="ip-o"><Select id="ip-o" value={orientation} onChange={setOrientation} options={[{ value: "auto", label: "Automatic" }, { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} /></Field>}
            <Range label="Margin" value={margin} min={0} max={72} onChange={setMargin} display={`${margin} pt`} />
          </div>
          {error && <ErrorBox message={error} />}
          <DownloadButton label={busy ? "Creating PDF…" : `Create PDF (${files.length} page${files.length === 1 ? "" : "s"})`} onClick={() => void build()} disabled={busy} />
        </>
      )}
    </div>
  );
}

// ---------- PDF → images ----------

function PdfToImages({ format }: { format: "image/jpeg" | "image/png" }) {
  const state = useSinglePdf(false);
  const [dpi, setDpi] = useState(150);
  const [range, setRange] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const report = useReportUse();
  const ext = format === "image/png" ? "png" : "jpg";
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <div className="surface grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
            <Range label="Resolution" value={dpi} min={72} max={300} step={6} onChange={setDpi} display={`${dpi} DPI`} />
            <Field label="Pages (empty = all)" htmlFor="pi-r"><input id="pi-r" className="field" value={range} onChange={(e) => setRange(e.target.value)} placeholder={`1-${pdf.pages}`} /></Field>
          </div>
          {progress && <Notice>{progress}</Notice>}
          <DownloadButton
            label={progress ? "Converting…" : `Convert to ${ext.toUpperCase()}`}
            disabled={!!progress}
            onClick={async () => {
              state.setError(null);
              try {
                const pages = range.trim() ? uniqueSorted(parsePageRanges(range, pdf.pages)) : Array.from({ length: pdf.pages }, (_, i) => i);
                if (pages.length > 300) throw new Error("Convert at most 300 pages at a time.");
                const doc = await openPdf(pdf.bytes);
                const out: { name: string; bytes: Uint8Array }[] = [];
                for (const [k, p] of pages.entries()) {
                  setProgress(`Rendering page ${k + 1} of ${pages.length}…`);
                  const c = await renderPage(doc, p + 1, dpi / 72);
                  const b = await canvasToBlob(c, format, 0.9);
                  c.width = c.height = 0;
                  out.push({ name: `${baseName(pdf.file.name)}-page-${String(p + 1).padStart(3, "0")}.${ext}`, bytes: new Uint8Array(await b.arrayBuffer()) });
                }
                await doc.destroy();
                if (out.length === 1) downloadBlob(new Blob([out[0].bytes as BlobPart], { type: format }), out[0].name);
                else await zipAndDownload(out, `${baseName(pdf.file.name)}-${ext}.zip`);
                report();
              } catch (e) {
                state.setError((e as Error).message);
              } finally {
                setProgress(null);
              }
            }}
          />
          <p className="text-muted text-xs">150 DPI suits screens and email; use 300 DPI for print. Higher DPI uses more memory.</p>
        </>
      )}
    </PdfLoader>
  );
}

// ---------- Info tools ----------

function PageCounter() {
  const [rows, setRows] = useState<{ name: string; pages: number | string; size: number }[]>([]);
  const report = useReportUse();
  const add = async (files: File[]) => {
    const r = await Promise.all(files.map(async (f) => {
      try {
        return { name: f.name, pages: await P.pageCount(new Uint8Array(await f.arrayBuffer())), size: f.size };
      } catch {
        return { name: f.name, pages: "Unreadable", size: f.size };
      }
    }));
    setRows((p) => [...p, ...r]);
    report();
  };
  const total = rows.reduce((s, r) => s + (typeof r.pages === "number" ? r.pages : 0), 0);
  return (
    <div className="space-y-4">
      <FileDrop accept={PDF_ACCEPT} multiple maxSizeMB={P.MAX_PDF_MB} maxFiles={500} onFiles={(f) => void add(f)} label="Choose one or many PDFs" />
      {rows.length > 0 && (
        <>
          <div className="surface rounded-2xl py-6 text-center"><p className="text-muted text-sm">Total pages</p><p className="text-5xl font-bold tabular-nums">{total.toLocaleString("en-US")}</p></div>
          <DataTable columns={["File", "Pages", "Size"]} rows={rows.map((r) => [r.name, r.pages, formatBytes(r.size)])} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows([])}>Clear list</button>
        </>
      )}
    </div>
  );
}

function PageSizeChecker() {
  const [sizes, setSizes] = useState<P.PageSizeInfo[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  return (
    <div className="space-y-4">
      <FileDrop accept={PDF_ACCEPT} maxSizeMB={P.MAX_PDF_MB} onFiles={async ([f]) => {
        try {
          setSizes(await P.pageSizes(new Uint8Array(await f.arrayBuffer())));
          setName(f.name);
          setError(null);
          report();
        } catch (e) {
          setError((e as Error).message);
        }
      }} />
      {error && <ErrorBox message={error} />}
      {sizes && (
        <>
          <p className="text-sm font-semibold">{name}: {sizes.length} pages{new Set(sizes.map((s) => `${Math.round(s.widthPt)}x${Math.round(s.heightPt)}`)).size > 1 ? " — mixed page sizes" : ""}</p>
          <DataTable
            columns={["Page", "Paper", "Points", "Millimetres", "Inches", "Rotation"]}
            rows={sizes.slice(0, 2000).map((s) => [s.index + 1, s.name, `${s.widthPt.toFixed(0)} × ${s.heightPt.toFixed(0)}`, `${(s.widthPt / 72 * 25.4).toFixed(1)} × ${(s.heightPt / 72 * 25.4).toFixed(1)}`, `${(s.widthPt / 72).toFixed(2)} × ${(s.heightPt / 72).toFixed(2)}`, `${s.rotation}°`])}
          />
        </>
      )}
    </div>
  );
}

function MetadataViewer() {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [meta, setMeta] = useState<P.PdfMeta | null>(null);
  const [edit, setEdit] = useState({ title: "", author: "", subject: "", keywords: "" });
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const fmt = (d?: Date) => (d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-US") : "—");
  return (
    <div className="space-y-4">
      <FileDrop accept={PDF_ACCEPT} maxSizeMB={P.MAX_PDF_MB} onFiles={async ([f]) => {
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          const m = await P.readMetadata(bytes);
          setFile({ name: f.name, bytes });
          setMeta(m);
          setEdit({ title: m.title ?? "", author: m.author ?? "", subject: m.subject ?? "", keywords: m.keywords ?? "" });
          setError(null);
          report();
        } catch (e) {
          setError((e as Error).message);
        }
      }} />
      {error && <ErrorBox message={error} />}
      {meta && file && (
        <>
          <KeyValueList
            items={[
              { k: "Title", v: meta.title || "—" }, { k: "Author", v: meta.author || "—" }, { k: "Subject", v: meta.subject || "—" }, { k: "Keywords", v: meta.keywords || "—" },
              { k: "Creator (app)", v: meta.creator || "—" }, { k: "Producer", v: meta.producer || "—" }, { k: "Created", v: fmt(meta.created) }, { k: "Modified", v: fmt(meta.modified) },
              { k: "Pages", v: meta.pages }, { k: "PDF version", v: meta.version }, { k: "Encrypted", v: meta.encrypted ? "Yes" : "No" },
            ]}
          />
          {!meta.encrypted && (
            <Panel title="Edit metadata">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["title", "author", "subject", "keywords"] as const).map((k) => (
                  <Field key={k} label={k[0].toUpperCase() + k.slice(1)} htmlFor={`pm-${k}`}><input id={`pm-${k}`} className="field" value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>
                ))}
              </div>
              <div className="mt-3">
                <DownloadButton label="Save PDF with new metadata" onClick={async () => {
                  try {
                    downloadBlob(pdfBlob(await P.writeMetadata(file.bytes, edit)), file.name);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }} />
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Watermark & page numbers ----------

function WatermarkPdf() {
  const state = useSinglePdf(false);
  const [o, setO] = useState({ text: "CONFIDENTIAL", fontSize: 60, opacity: 0.2, rotation: 45, color: "#dc2626", position: "center" as "center" | "top" | "bottom" | "tile" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const report = useReportUse();
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <div className="surface grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
            <Field label="Watermark text" htmlFor="wm-t"><input id="wm-t" className="field" value={o.text} onChange={(e) => setO({ ...o, text: e.target.value })} /></Field>
            <Field label="Position" htmlFor="wm-p"><Select id="wm-p" value={o.position} onChange={(v) => setO({ ...o, position: v })} options={[{ value: "center", label: "Center" }, { value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }, { value: "tile", label: "Tiled across page" }]} /></Field>
            <Range label="Font size" value={o.fontSize} min={10} max={150} onChange={(v) => setO({ ...o, fontSize: v })} display={`${o.fontSize} pt`} />
            <Range label="Opacity" value={Math.round(o.opacity * 100)} min={5} max={100} onChange={(v) => setO({ ...o, opacity: v / 100 })} display={`${Math.round(o.opacity * 100)}%`} />
            <Range label="Rotation" value={o.rotation} min={-90} max={90} onChange={(v) => setO({ ...o, rotation: v })} display={`${o.rotation}°`} />
            <Field label="Color" htmlFor="wm-c"><input id="wm-c" type="color" className="border-base h-10 w-20 rounded-lg border" value={o.color} onChange={(e) => setO({ ...o, color: e.target.value })} /></Field>
          </div>
          {note && <Notice tone="warn">{note}</Notice>}
          <DownloadButton label={busy ? "Applying…" : "Add watermark & download"} disabled={busy} onClick={async () => {
            setBusy(true);
            state.setError(null);
            try {
              const r = await P.watermarkPdf(pdf.bytes, o);
              setNote(r.replaced ? `${r.replaced} character(s) are not supported by the built-in PDF font and were replaced with “?”. Use Latin characters for best results.` : null);
              downloadBlob(pdfBlob(r.bytes), `${baseName(pdf.file.name)}-watermarked.pdf`);
              report();
            } catch (e) {
              state.setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }} />
          <p className="text-muted text-xs">The watermark is added as a text layer. It deters casual copying but can be removed by someone with PDF editing software.</p>
        </>
      )}
    </PdfLoader>
  );
}

function PageNumbers() {
  const state = useSinglePdf(false);
  const [o, setO] = useState({ format: "Page {n} of {total}", position: "bottom-center" as const, fontSize: 10, start: 1, margin: 30, skipFirst: false });
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <div className="surface grid gap-4 rounded-2xl p-4 sm:grid-cols-3">
            <Field label="Format" htmlFor="pn-f" hint="{n} = page number, {total} = page count"><input id="pn-f" className="field" value={o.format} onChange={(e) => setO({ ...o, format: e.target.value })} /></Field>
            <Field label="Position" htmlFor="pn-p">
              <Select id="pn-p" value={o.position} onChange={(v) => setO({ ...o, position: v as typeof o.position })} options={["bottom-center", "bottom-right", "bottom-left", "top-center", "top-right", "top-left"].map((v) => ({ value: v, label: v.replace("-", " ") }))} />
            </Field>
            <Field label="Start at" htmlFor="pn-s"><NumberInput id="pn-s" value={String(o.start)} onChange={(v) => setO({ ...o, start: Math.max(0, Number(v) || 1) })} min={0} step={1} /></Field>
            <Range label="Font size" value={o.fontSize} min={6} max={24} onChange={(v) => setO({ ...o, fontSize: v })} display={`${o.fontSize} pt`} />
            <Range label="Margin" value={o.margin} min={10} max={80} onChange={(v) => setO({ ...o, margin: v })} display={`${o.margin} pt`} />
            <div className="flex items-end pb-2"><Checkbox checked={o.skipFirst} onChange={(v) => setO({ ...o, skipFirst: v })} label="Skip first page (cover)" /></div>
          </div>
          <DownloadButton label={busy ? "Numbering…" : `Number ${pdf.pages} pages & download`} disabled={busy} onClick={async () => {
            setBusy(true);
            state.setError(null);
            try {
              downloadBlob(pdfBlob(await P.addPageNumbers(pdf.bytes, o)), `${baseName(pdf.file.name)}-numbered.pdf`);
              report();
            } catch (e) {
              state.setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }} />
        </>
      )}
    </PdfLoader>
  );
}

// ---------- Grayscale ----------

function GrayscalePdf() {
  const state = useSinglePdf(false);
  const [dpi, setDpi] = useState(150);
  const [progress, setProgress] = useState<string | null>(null);
  const report = useReportUse();
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <Notice tone="warn">Converting to grayscale renders each page as an image. The result looks the same but text is no longer selectable or searchable, and file size may change.</Notice>
          <div className="surface rounded-2xl p-4"><Range label="Quality" value={dpi} min={96} max={300} step={6} onChange={setDpi} display={`${dpi} DPI`} /></div>
          {progress && <Notice>{progress}</Notice>}
          <DownloadButton label={progress ? "Converting…" : "Convert to grayscale"} disabled={!!progress || pdf.pages > 500} onClick={async () => {
            state.setError(null);
            try {
              const doc = await openPdf(pdf.bytes);
              const pages: { jpg: Uint8Array; widthPt: number; heightPt: number }[] = [];
              for (let p = 1; p <= pdf.pages; p++) {
                setProgress(`Converting page ${p} of ${pdf.pages}…`);
                const page = await doc.getPage(p);
                const vp = page.getViewport({ scale: 1 });
                const c = await renderPage(doc, p, dpi / 72, { grayscale: true });
                pages.push({ jpg: new Uint8Array(await (await canvasToBlob(c, "image/jpeg", 0.85)).arrayBuffer()), widthPt: vp.width, heightPt: vp.height });
                c.width = c.height = 0;
              }
              await doc.destroy();
              downloadBlob(pdfBlob(await P.pdfFromJpegPages(pages)), `${baseName(pdf.file.name)}-grayscale.pdf`);
              report();
            } catch (e) {
              state.setError((e as Error).message);
            } finally {
              setProgress(null);
            }
          }} />
        </>
      )}
    </PdfLoader>
  );
}

// ---------- Password protect / unlock ----------

function ProtectPdf() {
  const state = useSinglePdf(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [owner, setOwner] = useState("");
  const [perm, setPerm] = useState({ allowPrinting: true, allowCopying: false, allowModifying: false });
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <div className="surface grid gap-4 rounded-2xl p-4 sm:grid-cols-2">
            <Field label="Password to open" htmlFor="pp-1"><input id="pp-1" type="password" autoComplete="new-password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <Field label="Repeat password" htmlFor="pp-2"><input id="pp-2" type="password" autoComplete="new-password" className="field" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-invalid={pw2 !== "" && pw !== pw2} /></Field>
            <Field label="Owner password (optional)" htmlFor="pp-o" hint="Needed to change permissions. A random one is used if empty."><input id="pp-o" type="password" autoComplete="new-password" className="field" value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
            <div className="space-y-2 pt-6">
              <Checkbox checked={perm.allowPrinting} onChange={(v) => setPerm({ ...perm, allowPrinting: v })} label="Allow printing" />
              <Checkbox checked={perm.allowCopying} onChange={(v) => setPerm({ ...perm, allowCopying: v })} label="Allow copying text" />
              <Checkbox checked={perm.allowModifying} onChange={(v) => setPerm({ ...perm, allowModifying: v })} label="Allow editing" />
            </div>
          </div>
          <DownloadButton label={busy ? "Encrypting…" : "Protect PDF with AES-256"} disabled={busy || !pw || pw !== pw2} onClick={async () => {
            setBusy(true);
            state.setError(null);
            try {
              downloadBlob(pdfBlob(await P.protectPdf(pdf.bytes, { userPassword: pw, ownerPassword: owner, ...perm })), `${baseName(pdf.file.name)}-protected.pdf`);
              report();
            } catch (e) {
              state.setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }} />
          {pw && pw !== pw2 && <p className="text-sm text-red-600">Passwords do not match.</p>}
          <Notice>Encryption uses AES-256 (PDF 2.0, revision 6), supported by Adobe Acrobat X+, modern browsers and current macOS/iOS viewers. Very old readers may not open it. Permission flags are honoured by compliant viewers only. We cannot recover a forgotten password.</Notice>
        </>
      )}
    </PdfLoader>
  );
}

function UnlockPdf() {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  return (
    <div className="space-y-4">
      {!file ? (
        <FileDrop accept={PDF_ACCEPT} maxSizeMB={P.MAX_PDF_MB} onFiles={async ([f]) => {
          const bytes = new Uint8Array(await f.arrayBuffer());
          try {
            if (!(await P.isEncrypted(bytes))) {
              setError("This PDF is not password-protected — there is nothing to unlock.");
              return;
            }
            setFile({ name: f.name, bytes });
            setError(null);
          } catch {
            setError("This file could not be read as a PDF.");
          }
        }} />
      ) : (
        <form className="surface flex flex-wrap items-end gap-3 rounded-2xl p-4" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            downloadBlob(pdfBlob(await P.unlockPdf(file.bytes, pw)), `${baseName(file.name)}-unlocked.pdf`);
            report();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}>
          <p className="w-full text-sm font-semibold">{file.name} is encrypted.</p>
          <Field label="Password" htmlFor="ul-p" className="min-w-60 flex-1"><input id="ul-p" type="password" autoComplete="off" className="field" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></Field>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Unlocking…" : "Unlock & download"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => (setFile(null), setPw(""))}>Change file</button>
        </form>
      )}
      {error && <ErrorBox message={error} />}
      <Notice>You must know the password. This tool removes protection from PDFs you are authorised to open; it does not crack or bypass unknown passwords.</Notice>
    </div>
  );
}

// ---------- Sign ----------

function SignaturePad({ onChange }: { onChange: (png: Uint8Array | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [mode, setMode] = useState<"draw" | "type" | "upload">("draw");
  const [typed, setTyped] = useState("");
  const [color, setColor] = useState("#1e3a8a");
  const export_ = async () => {
    const c = ref.current!;
    // Trim to the drawn area.
    const ctx = c.getContext("2d")!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (maxX < 0) return onChange(null);
    const t = Object.assign(document.createElement("canvas"), { width: maxX - minX + 8, height: maxY - minY + 8 });
    t.getContext("2d")!.drawImage(c, minX - 4, minY - 4, t.width, t.height, 0, 0, t.width, t.height);
    onChange(new Uint8Array(await (await canvasToBlob(t, "image/png")).arrayBuffer()));
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    onChange(null);
  };
  useEffect(() => {
    if (mode !== "type") return;
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!typed.trim()) return onChange(null);
    ctx.fillStyle = color;
    ctx.font = "italic 64px 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(typed, 20, c.height / 2);
    void export_();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, mode, color]);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * e.currentTarget.width, y: ((e.clientY - b.top) / b.height) * e.currentTarget.height };
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented ariaLabel="Signature type" value={mode} onChange={(m) => (setMode(m), clear())} options={[{ value: "draw", label: "Draw" }, { value: "type", label: "Type" }, { value: "upload", label: "Upload image" }]} />
        {mode !== "upload" && <input type="color" aria-label="Ink color" className="border-base h-9 w-12 rounded-lg border" value={color} onChange={(e) => setColor(e.target.value)} />}
        {mode === "draw" && <button type="button" className="btn btn-ghost btn-sm" onClick={clear}><Eraser className="h-3.5 w-3.5" aria-hidden /> Clear</button>}
      </div>
      {mode === "type" && <input className="field" placeholder="Type your name" value={typed} onChange={(e) => setTyped(e.target.value)} />}
      {mode === "upload" ? (
        <FileDrop accept="image/png,image/jpeg,image/webp" maxSizeMB={5} onFiles={async ([f]) => {
          const bmp = await decodeImage(f);
          const c = Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
          c.getContext("2d")!.drawImage(bmp, 0, 0);
          bmp.close();
          onChange(new Uint8Array(await (await canvasToBlob(c, "image/png")).arrayBuffer()));
        }} label="Upload a signature image (transparent PNG works best)" />
      ) : (
        <canvas
          ref={ref}
          width={600}
          height={200}
          className={`border-base w-full max-w-xl touch-none rounded-xl border-2 border-dashed bg-white ${mode === "draw" ? "cursor-crosshair" : ""}`}
          onPointerDown={(e) => {
            if (mode !== "draw") return;
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const ctx = e.currentTarget.getContext("2d")!;
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d")!;
            ctx.lineWidth = 3;
            ctx.lineCap = ctx.lineJoin = "round";
            ctx.strokeStyle = color;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }}
          onPointerUp={() => {
            drawing.current = false;
            void export_();
          }}
        />
      )}
    </div>
  );
}

function SignPdf() {
  const state = useSinglePdf();
  const [sig, setSig] = useState<Uint8Array | null>(null);
  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0.75, y: 0.88 });
  const [width, setWidth] = useState(25);
  const [allPages, setAllPages] = useState(false);
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  useEffect(() => {
    if (!sig) return setSigUrl(null);
    const u = URL.createObjectURL(new Blob([sig as BlobPart], { type: "image/png" }));
    setSigUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [sig]);
  useEffect(() => {
    const doc = state.pdf?.doc;
    if (!doc) return;
    let url: string | null = null;
    void renderPage(doc, page, 1).then((c) => canvasToBlob(c, "image/jpeg", 0.8)).then((b) => setPreview((url = URL.createObjectURL(b))));
    return () => void (url && URL.revokeObjectURL(url));
  }, [state.pdf, page]);
  return (
    <PdfLoader state={state}>
      {(pdf) => (
        <>
          <Panel title="1. Create your signature"><SignaturePad onChange={setSig} /></Panel>
          <Panel title="2. Place it on the page (click to position)">
            <div className="mb-3 flex flex-wrap items-end gap-4">
              <Field label="Page" htmlFor="sg-p" className="w-28"><NumberInput id="sg-p" value={String(page)} onChange={(v) => setPage(Math.min(pdf.pages, Math.max(1, Number(v) || 1)))} min={1} max={pdf.pages} step={1} /></Field>
              <div className="w-56"><Range label="Signature width" value={width} min={5} max={80} onChange={setWidth} display={`${width}% of page`} /></div>
              <div className="pb-2"><Checkbox checked={allPages} onChange={setAllPages} label="Place on every page" /></div>
            </div>
            {preview && (
              <div className="relative mx-auto w-fit cursor-crosshair select-none" onClick={(e) => {
                const b = e.currentTarget.getBoundingClientRect();
                setPos({ x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height });
              }}>
                <img src={preview} alt={`Page ${page}`} className="border-base max-h-[70vh] border shadow" draggable={false} />
                {sigUrl && <img src={sigUrl} alt="Signature" className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 outline outline-1 outline-brand-400/60 outline-dashed" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${width}%` }} />}
              </div>
            )}
          </Panel>
          <DownloadButton label={busy ? "Signing…" : "Download signed PDF"} disabled={!sig || busy} onClick={async () => {
            setBusy(true);
            state.setError(null);
            try {
              downloadBlob(pdfBlob(await P.stampImage(pdf.bytes, sig!, { pageIndex: page - 1, xFrac: pos.x, yFrac: pos.y, widthFrac: width / 100, allPages })), `${baseName(pdf.file.name)}-signed.pdf`);
              report();
            } catch (e) {
              state.setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }} />
          <Notice>This adds a visual (electronic) signature image. It is not a certificate-based digital signature and does not cryptographically prove identity or detect later changes. Whether a visual signature is legally sufficient depends on your jurisdiction and document type.</Notice>
        </>
      )}
    </PdfLoader>
  );
}

// ---------- Text → PDF ----------

function TextToPdf() {
  const [text, setText] = useState("");
  const [o, setO] = useState({ fontSize: 11, font: "Helvetica" as "Helvetica" | "TimesRoman" | "Courier", pageSize: "letter" as "a4" | "letter", margin: 54, title: "" });
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  return (
    <div className="space-y-4">
      <Field label="Text" htmlFor="tp-t"><textarea id="tp-t" className="field !font-sans" rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste text. Line breaks are preserved; long lines wrap automatically." /></Field>
      <div className="surface grid gap-4 rounded-2xl p-4 sm:grid-cols-4">
        <Field label="Font" htmlFor="tp-f"><Select id="tp-f" value={o.font} onChange={(v) => setO({ ...o, font: v })} options={[{ value: "Helvetica", label: "Helvetica (sans)" }, { value: "TimesRoman", label: "Times (serif)" }, { value: "Courier", label: "Courier (mono)" }]} /></Field>
        <Field label="Page size" htmlFor="tp-s"><Select id="tp-s" value={o.pageSize} onChange={(v) => setO({ ...o, pageSize: v })} options={[{ value: "letter", label: "US Letter" }, { value: "a4", label: "A4" }]} /></Field>
        <Range label="Font size" value={o.fontSize} min={7} max={24} onChange={(v) => setO({ ...o, fontSize: v })} display={`${o.fontSize} pt`} />
        <Range label="Margins" value={o.margin} min={18} max={108} step={6} onChange={(v) => setO({ ...o, margin: v })} display={`${(o.margin / 72).toFixed(2)} in`} />
      </div>
      {note && <Notice tone="warn">{note}</Notice>}
      {error && <ErrorBox message={error} />}
      <DownloadButton label="Create PDF" disabled={!text.trim()} onClick={async () => {
        try {
          const r = await P.textToPdf(text, o);
          setNote(r.replaced ? `${r.replaced} character(s) outside the Latin-1 range (e.g. emoji, Cyrillic, CJK) are not supported by the standard PDF fonts and were replaced with “?”.` : null);
          setError(null);
          downloadBlob(pdfBlob(r.bytes), "document.pdf");
          report();
        } catch (e) {
          setError((e as Error).message);
        }
      }} />
    </div>
  );
}

const tools: Record<string, ComponentType> = {
  "merge-pdf": MergePdf,
  "split-pdf": SplitPdf,
  "rotate-pdf": RotatePdf,
  "delete-pdf-pages": () => <PageSelectTool mode="delete" />,
  "extract-pdf-pages": () => <PageSelectTool mode="extract" />,
  "reorder-pdf": ReorderPdf,
  "jpg-to-pdf": () => <ImagesToPdf accept="image/jpeg,.jpg,.jpeg" label="Choose JPG images" />,
  "png-to-pdf": () => <ImagesToPdf accept="image/png,.png" label="Choose PNG images" />,
  "pdf-to-jpg": () => <PdfToImages format="image/jpeg" />,
  "pdf-to-png": () => <PdfToImages format="image/png" />,
  "pdf-page-counter": PageCounter,
  "pdf-page-size-checker": PageSizeChecker,
  "pdf-metadata-viewer": MetadataViewer,
  "pdf-watermark": WatermarkPdf,
  "pdf-page-numbers": PageNumbers,
  "pdf-grayscale": GrayscalePdf,
  "pdf-password-protect": ProtectPdf,
  "pdf-unlock": UnlockPdf,
  "pdf-sign": SignPdf,
  "text-to-pdf": TextToPdf,
};

export default tools;
