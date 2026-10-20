"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type PointerEvent as RPointerEvent } from "react";
import { ImageBatch, type ImageJob } from "../ui/ImageBatch";
import { bitmapToPng, decodeImage, processImage } from "../imaging/client";
import type { ImageOp, OutputType } from "../imaging/pipeline";
import { buildIco, readDimensions, readDpi, replaceExtension, setPngDpi, sniffImage, stripJpegMetadata, stripPngMetadata } from "../logic/imageformat";
import { bytesToBase64 } from "../logic/developer";
import * as C from "../logic/color";
import {
  Checkbox, CopyButton, DataTable, DownloadButton, ErrorBox, Field, FileDrop, KeyValueList, Notice, NumberInput, Panel, Range, Segmented, Select,
  downloadBlob, downloadText, formatBytes, useReportUse,
} from "../ui/kit";

// ---------- Format converters ----------

const MIME_EXT: Record<OutputType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif" };

function Converter({ accept, to, lossy, hint, svg }: { accept: string; to: OutputType; lossy?: boolean; hint?: string; svg?: boolean }) {
  const [quality, setQuality] = useState(to === "image/avif" ? 60 : 90);
  const [bg, setBg] = useState("#ffffff");
  const [svgWidth, setSvgWidth] = useState("1024");
  const job = (): ImageJob => {
    const w = Number(svgWidth);
    if (svg && !(w >= 16 && w <= 8192)) throw new Error("Output width must be between 16 and 8192 pixels.");
    return { ops: [], output: { type: to, quality: quality / 100, background: to === "image/jpeg" ? bg : undefined }, ext: MIME_EXT[to], svgWidth: svg ? w : undefined };
  };
  const options =
    lossy || to === "image/jpeg" || svg ? (
      <div className="grid gap-4 sm:grid-cols-2">
        {lossy && <Range label="Quality" value={quality} min={10} max={100} onChange={setQuality} display={`${quality}%`} />}
        {to === "image/jpeg" && (
          <Field label="Background for transparent areas" htmlFor="cv-bg" hint="JPEG cannot store transparency">
            <input id="cv-bg" type="color" className="border-base h-10 w-20 rounded-lg border" value={bg} onChange={(e) => setBg(e.target.value)} />
          </Field>
        )}
        {svg && (
          <Field label="Output width (px)" htmlFor="cv-sw" hint="Height follows the SVG's aspect ratio">
            <NumberInput id="cv-sw" value={svgWidth} onChange={setSvgWidth} min={16} max={8192} step={1} />
          </Field>
        )}
      </div>
    ) : undefined;
  return <ImageBatch accept={accept} job={job} options={options} hint={hint} autoKey={`${quality}|${bg}|${svgWidth}`} />;
}

// ---------- Compressor ----------

function Compressor() {
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState<"same" | OutputType>("same");
  const [maxWidth, setMaxWidth] = useState("");
  const job = (): ImageJob => {
    const mw = Number(maxWidth);
    const out: OutputType = format === "same" ? "image/jpeg" : format;
    return {
      ops: (w, h) => (mw > 0 && w > mw ? [{ type: "resize", width: mw, height: Math.round((h * mw) / w) }] : []),
      output: { type: out, quality: quality / 100 },
      ext: MIME_EXT[out],
    };
  };
  return (
    <div className="space-y-3">
      <ImageBatch
        accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
        job={job}
        autoKey={`${quality}|${format}|${maxWidth}`}
        options={
          <div className="grid gap-4 sm:grid-cols-3">
            <Range label="Quality" value={quality} min={10} max={95} onChange={setQuality} display={`${quality}%`} />
            <Field label="Output format" htmlFor="cmp-f">
              <Select id="cmp-f" value={format} onChange={setFormat} options={[{ value: "same", label: "JPEG (best compatibility)" }, { value: "image/webp", label: "WebP (smaller)" }, { value: "image/avif", label: "AVIF (smallest, slower)" }, { value: "image/png", label: "PNG (lossless)" }]} />
            </Field>
            <Field label="Max width (optional)" htmlFor="cmp-w" hint="Downscale larger images">
              <NumberInput id="cmp-w" value={maxWidth} onChange={setMaxWidth} min={16} step={1} suffix="px" />
            </Field>
          </div>
        }
      />
      <Notice>Compression re-encodes the image, which removes EXIF metadata. If the result is larger than the original (common for already-optimised files), keep the original.</Notice>
    </div>
  );
}

// ---------- Resizer ----------

function Resizer() {
  const [mode, setMode] = useState<"px" | "pct">("px");
  const [w, setW] = useState("1280");
  const [h, setH] = useState("");
  const [pct, setPct] = useState(50);
  const [keep, setKeep] = useState(true);
  const [format, setFormat] = useState<OutputType>("image/jpeg");
  const job = (): ImageJob => ({
    ops: (sw, sh) => {
      let tw: number, th: number;
      if (mode === "pct") {
        tw = Math.max(1, Math.round((sw * pct) / 100));
        th = Math.max(1, Math.round((sh * pct) / 100));
      } else {
        const nw = Number(w), nh = Number(h);
        if (!(nw > 0) && !(nh > 0)) throw new Error("Enter a width, a height, or both.");
        if (keep) {
          if (nw > 0 && nh > 0) {
            const s = Math.min(nw / sw, nh / sh);
            tw = Math.round(sw * s);
            th = Math.round(sh * s);
          } else if (nw > 0) {
            tw = nw;
            th = Math.round((sh * nw) / sw);
          } else {
            th = nh;
            tw = Math.round((sw * nh) / sh);
          }
        } else {
          tw = nw > 0 ? nw : sw;
          th = nh > 0 ? nh : sh;
        }
      }
      return [{ type: "resize", width: Math.max(1, tw), height: Math.max(1, th) }];
    },
    output: { type: format, quality: 0.92 },
    ext: MIME_EXT[format],
  });
  return (
    <ImageBatch
      accept="image/*,.heic,.heif,.avif"
      job={job}
      autoKey={`${mode}|${w}|${h}|${pct}|${keep}|${format}`}
      options={
        <div className="space-y-4">
          <Segmented ariaLabel="Resize by" value={mode} onChange={setMode} options={[{ value: "px", label: "By pixels" }, { value: "pct", label: "By percentage" }]} />
          {mode === "px" ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Width" htmlFor="rs-w" className="w-36"><NumberInput id="rs-w" value={w} onChange={setW} min={1} step={1} suffix="px" /></Field>
              <Field label="Height" htmlFor="rs-h" className="w-36"><NumberInput id="rs-h" value={h} onChange={setH} min={1} step={1} suffix="px" /></Field>
              <div className="pb-2"><Checkbox checked={keep} onChange={setKeep} label="Keep aspect ratio (fit inside)" /></div>
            </div>
          ) : (
            <Range label="Scale" value={pct} min={1} max={400} onChange={setPct} display={`${pct}%`} />
          )}
          <Field label="Output format" htmlFor="rs-f" className="w-56">
            <Select id="rs-f" value={format} onChange={setFormat} options={[{ value: "image/jpeg", label: "JPEG" }, { value: "image/png", label: "PNG" }, { value: "image/webp", label: "WebP" }]} />
          </Field>
        </div>
      }
    />
  );
}

// ---------- Simple transforms ----------

function Transform({ make, controls, keyOf, accept = "image/*,.heic,.heif,.avif" }: { make: () => ImageOp[]; controls: React.ReactNode; keyOf: string; accept?: string }) {
  const [format, setFormat] = useState<OutputType>("image/png");
  return (
    <ImageBatch
      accept={accept}
      job={() => ({ ops: make(), output: { type: format, quality: 0.92 }, ext: MIME_EXT[format] })}
      autoKey={`${keyOf}|${format}`}
      options={
        <div className="space-y-4">
          {controls}
          <Field label="Output format" htmlFor="tf-f" className="w-56">
            <Select id="tf-f" value={format} onChange={setFormat} options={[{ value: "image/png", label: "PNG (lossless)" }, { value: "image/jpeg", label: "JPEG" }, { value: "image/webp", label: "WebP" }]} />
          </Field>
        </div>
      }
    />
  );
}

function Rotator() {
  const [deg, setDeg] = useState(90);
  const [bg, setBg] = useState("transparent");
  return (
    <Transform
      make={() => [{ type: "rotate", degrees: deg, background: bg === "transparent" ? undefined : bg }]}
      keyOf={`${deg}|${bg}`}
      controls={
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[90, 180, 270].map((d) => (
              <button key={d} type="button" className={`btn btn-sm ${deg === d ? "btn-primary" : "btn-secondary"}`} onClick={() => setDeg(d)}>{d === 270 ? "90° left" : d === 90 ? "90° right" : "180°"}</button>
            ))}
          </div>
          <Range label="Custom angle" value={deg} min={-180} max={360} onChange={setDeg} display={`${deg}°`} />
          {deg % 90 !== 0 && (
            <Field label="Fill corners" htmlFor="rot-bg" className="w-56">
              <Select id="rot-bg" value={bg} onChange={setBg} options={[{ value: "transparent", label: "Transparent (PNG/WebP)" }, { value: "#ffffff", label: "White" }, { value: "#000000", label: "Black" }]} />
            </Field>
          )}
        </div>
      }
    />
  );
}

function Flipper() {
  const [h, setH] = useState(true);
  const [v, setV] = useState(false);
  return (
    <Transform
      make={() => {
        if (!h && !v) throw new Error("Choose horizontal, vertical or both.");
        return [{ type: "flip", horizontal: h, vertical: v }];
      }}
      keyOf={`${h}|${v}`}
      controls={<div className="flex gap-5"><Checkbox checked={h} onChange={setH} label="Flip horizontally (mirror)" /><Checkbox checked={v} onChange={setV} label="Flip vertically" /></div>}
    />
  );
}

function Grayscale() {
  const [amt, setAmt] = useState(100);
  return <Transform make={() => [{ type: "grayscale", amount: amt / 100 }]} keyOf={String(amt)} controls={<Range label="Strength" value={amt} min={0} max={100} onChange={setAmt} display={`${amt}%`} />} />;
}

function Blur() {
  const [r, setR] = useState(8);
  return <Transform make={() => [{ type: "blur", radius: r }]} keyOf={String(r)} controls={<Range label="Blur radius" value={r} min={1} max={100} onChange={setR} display={`${r}px`} />} />;
}

function Brightness() {
  const [v, setV] = useState(20);
  return <Transform make={() => [{ type: "brightness", amount: v }]} keyOf={String(v)} controls={<Range label="Brightness" value={v} min={-100} max={100} onChange={setV} display={`${v > 0 ? "+" : ""}${v}%`} />} />;
}

function Contrast() {
  const [v, setV] = useState(25);
  return <Transform make={() => [{ type: "contrast", amount: v }]} keyOf={String(v)} controls={<Range label="Contrast" value={v} min={-100} max={100} onChange={setV} display={`${v > 0 ? "+" : ""}${v}%`} />} />;
}

// ---------- Cropper ----------

interface Rect { x: number; y: number; w: number; h: number }

function Cropper() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [ratio, setRatio] = useState("free");
  const [format, setFormat] = useState<OutputType>("image/png");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "new" | "se"; sx: number; sy: number; start: Rect } | null>(null);
  const report = useReportUse();

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const load = async (f: File) => {
    setError(null);
    try {
      const bmp = await decodeImage(f);
      const c = Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
      c.getContext("2d")!.drawImage(bmp, 0, 0);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) throw new Error("Could not prepare the preview.");
      setFile(f);
      setNat({ w: bmp.width, h: bmp.height });
      setRect({ x: Math.round(bmp.width * 0.1), y: Math.round(bmp.height * 0.1), w: Math.round(bmp.width * 0.8), h: Math.round(bmp.height * 0.8) });
      setUrl(URL.createObjectURL(blob));
      bmp.close();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const ratioValue = ratio === "free" ? null : ratio.split(":").map(Number).reduce((a, b) => a / b);
  const applyRatio = (r: Rect): Rect => {
    if (!ratioValue || !nat) return r;
    let w = r.w, h = Math.round(r.w / ratioValue);
    if (r.y + h > nat.h) {
      h = nat.h - r.y;
      w = Math.round(h * ratioValue);
    }
    return { ...r, w, h };
  };
  useEffect(() => setRect((r) => applyRatio(r)), [ratio]); // eslint-disable-line react-hooks/exhaustive-deps

  const toImg = (e: RPointerEvent) => {
    const b = boxRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * nat!.w, y: ((e.clientY - b.top) / b.height) * nat!.h };
  };
  const clamp = (r: Rect): Rect => {
    const w = Math.max(1, Math.min(r.w, nat!.w)), h = Math.max(1, Math.min(r.h, nat!.h));
    return { x: Math.max(0, Math.min(r.x, nat!.w - w)), y: Math.max(0, Math.min(r.y, nat!.h - h)), w, h };
  };
  const onDown = (e: RPointerEvent, mode: "move" | "new" | "se") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toImg(e);
    drag.current = { mode, sx: p.x, sy: p.y, start: rect };
    if (mode === "new") setRect({ x: p.x, y: p.y, w: 1, h: 1 });
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || !nat) return;
    const p = toImg(e);
    if (d.mode === "move") setRect(clamp({ ...d.start, x: d.start.x + p.x - d.sx, y: d.start.y + p.y - d.sy }));
    else {
      const ox = d.mode === "se" ? d.start.x : d.sx, oy = d.mode === "se" ? d.start.y : d.sy;
      const r = { x: Math.min(ox, p.x), y: Math.min(oy, p.y), w: Math.abs(p.x - ox), h: Math.abs(p.y - oy) };
      setRect(clamp(applyRatio(r)));
    }
  };

  const crop = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await processImage(file, [{ type: "crop", x: rect.x, y: rect.y, width: rect.w, height: rect.h }], { type: format, quality: 0.92 });
      downloadBlob(r.blob, replaceExtension(file.name.replace(/(\.[^.]+)$/, "-cropped$1"), MIME_EXT[format]));
      report();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div className="space-y-4">
      {!url && <FileDrop accept="image/*,.heic,.heif,.avif" maxSizeMB={50} onFiles={([f]) => void load(f)} />}
      {error && <ErrorBox message={error} />}
      {url && nat && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Aspect ratio" htmlFor="cr-r" className="w-40">
              <Select id="cr-r" value={ratio} onChange={setRatio} options={[{ value: "free", label: "Free" }, { value: "1:1", label: "1:1 square" }, { value: "4:3", label: "4:3" }, { value: "3:2", label: "3:2" }, { value: "16:9", label: "16:9" }, { value: "9:16", label: "9:16 story" }, { value: "4:5", label: "4:5 portrait" }]} />
            </Field>
            {(["x", "y", "w", "h"] as const).map((k) => (
              <Field key={k} label={{ x: "X", y: "Y", w: "Width", h: "Height" }[k]} htmlFor={`cr-${k}`} className="w-24">
                <NumberInput id={`cr-${k}`} value={String(Math.round(rect[k]))} onChange={(v) => setRect(clamp({ ...rect, [k]: Number(v) || 0 }))} min={0} step={1} />
              </Field>
            ))}
          </div>
          <div className="checkerboard border-base relative mx-auto w-fit max-w-full touch-none overflow-hidden rounded-xl border select-none">
            <div ref={boxRef} className="relative" onPointerDown={(e) => onDown(e, "new")} onPointerMove={onMove} onPointerUp={() => (drag.current = null)}>
              <img src={url} alt="Image to crop" className="block max-h-[60vh] max-w-full" draggable={false} />
              <div
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                style={{ left: pct(rect.x, nat.w), top: pct(rect.y, nat.h), width: pct(rect.w, nat.w), height: pct(rect.h, nat.h) }}
                onPointerDown={(e) => onDown(e, "move")}
              >
                <span className="absolute -right-2 -bottom-2 h-4 w-4 cursor-se-resize rounded-full border-2 border-white bg-brand-600" onPointerDown={(e) => onDown(e, "se")} />
              </div>
            </div>
          </div>
          <p className="text-muted text-center text-xs">Drag to draw a new area, drag inside to move, or drag the corner handle to resize. Selection: {Math.round(rect.w)}×{Math.round(rect.h)} px</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Output format" htmlFor="cr-f" className="w-40">
              <Select id="cr-f" value={format} onChange={setFormat} options={[{ value: "image/png", label: "PNG" }, { value: "image/jpeg", label: "JPEG" }, { value: "image/webp", label: "WebP" }]} />
            </Field>
            <DownloadButton label={busy ? "Cropping…" : "Crop & download"} onClick={() => void crop()} disabled={busy} />
            <button type="button" className="btn btn-ghost" onClick={() => (setUrl(null), setFile(null))}>Choose another image</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Color picker ----------

function ColorPicker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<C.RGBA[]>([]);
  const [hover, setHover] = useState<C.RGBA | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const load = async (f: File) => {
    try {
      const bmp = await decodeImage(f);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = canvasRef.current!;
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext("2d", { willReadFrequently: true })!.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      setLoaded(true);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const sample = (e: React.MouseEvent<HTMLCanvasElement>): C.RGBA => {
    const c = canvasRef.current!;
    const b = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - b.left) / b.width) * c.width);
    const y = Math.floor(((e.clientY - b.top) / b.height) * c.height);
    const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: Math.round((d[3] / 255) * 100) / 100 };
  };
  const dominant = useMemo(() => {
    if (!loaded || !canvasRef.current) return [];
    const c = canvasRef.current;
    const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
    const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
    const step = Math.max(4, Math.floor(d.length / 4 / 40000) * 4);
    for (let i = 0; i < d.length; i += step) {
      if (d[i + 3] < 128) continue;
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bk.n++;
      bk.r += d[i];
      bk.g += d[i + 1];
      bk.b += d[i + 2];
      buckets.set(key, bk);
    }
    return [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 8).map((b) => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), a: 1 }));
  }, [loaded]);
  const last = picked[0];
  return (
    <div className="space-y-4">
      {!loaded && <FileDrop accept="image/*,.heic,.heif,.avif" maxSizeMB={50} onFiles={([f]) => void load(f)} />}
      {error && <ErrorBox message={error} />}
      <div className={loaded ? "grid gap-4 lg:grid-cols-[1fr_280px]" : "hidden"}>
        <div className="checkerboard border-base overflow-hidden rounded-xl border">
          <canvas
            ref={canvasRef}
            className="block h-auto w-full cursor-crosshair"
            onMouseMove={(e) => setHover(sample(e))}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => (setPicked((p) => [sample(e), ...p].slice(0, 12)), report())}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="border-base h-12 w-12 rounded-xl border" style={{ background: hover ? C.formatRgb(hover) : "transparent" }} />
            <span className="text-muted font-mono text-sm">{hover ? C.rgbToHex(hover) : "Hover the image"}</span>
          </div>
          {last ? (
            <KeyValueList items={[{ k: "HEX", v: C.rgbToHex(last), copy: C.rgbToHex(last) }, { k: "RGB", v: C.formatRgb(last), copy: C.formatRgb(last) }, { k: "HSL", v: C.formatHsl(last), copy: C.formatHsl(last) }]} />
          ) : (
            <Notice>Click anywhere on the image to pick a color.</Notice>
          )}
          {picked.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((p, i) => <button key={i} type="button" title={C.rgbToHex(p)} className="border-base h-7 w-7 rounded-md border" style={{ background: C.formatRgb(p) }} onClick={() => navigator.clipboard?.writeText(C.rgbToHex(p))} />)}
            </div>
          )}
          {dominant.length > 0 && (
            <Panel title="Dominant colors">
              <div className="grid grid-cols-4 gap-1.5">
                {dominant.map((c, i) => (
                  <button key={i} type="button" className="h-10 rounded-md text-[10px] font-mono" title={`Copy ${C.rgbToHex(c)}`} style={{ background: C.rgbToHex(c), color: C.relativeLuminance(c) < 0.4 ? "#fff" : "#000" }} onClick={() => navigator.clipboard?.writeText(C.rgbToHex(c))}>
                    {C.rgbToHex(c)}
                  </button>
                ))}
              </div>
            </Panel>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setLoaded(false), setPicked([]))}>Choose another image</button>
        </div>
      </div>
    </div>
  );
}

// ---------- DPI checker ----------

function DpiChecker() {
  const [info, setInfo] = useState<{ name: string; kind: string; dpi: ReturnType<typeof readDpi>; dims: { width: number; height: number } | null; bytes: Uint8Array; size: number } | null>(null);
  const [newDpi, setNewDpi] = useState("300");
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const load = async (f: File) => {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const kind = sniffImage(bytes);
      let dims = readDimensions(bytes);
      if (!dims) {
        try {
          const b = await decodeImage(f);
          dims = { width: b.width, height: b.height };
          b.close();
        } catch {
          dims = null;
        }
      }
      setInfo({ name: f.name, kind, dpi: readDpi(bytes), dims, bytes, size: f.size });
      setError(null);
      report();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const printSize = (dpi: number) => (info?.dims ? `${(info.dims.width / dpi).toFixed(2)} × ${(info.dims.height / dpi).toFixed(2)} in (${((info.dims.width / dpi) * 2.54).toFixed(1)} × ${((info.dims.height / dpi) * 2.54).toFixed(1)} cm)` : "—");
  return (
    <div className="space-y-4">
      <FileDrop accept="image/*" maxSizeMB={100} onFiles={([f]) => void load(f)} />
      {error && <ErrorBox message={error} />}
      {info && (
        <>
          <KeyValueList
            items={[
              { k: "File", v: `${info.name} (${info.kind.toUpperCase()}, ${formatBytes(info.size)})` },
              { k: "Pixel dimensions", v: info.dims ? `${info.dims.width} × ${info.dims.height} px` : "Unknown" },
              { k: "Stored DPI", v: info.dpi.x ? `${info.dpi.x} × ${info.dpi.y} DPI` : "Not specified" },
              { k: "Source", v: info.dpi.source },
              { k: "Print size at stored DPI", v: info.dpi.x ? printSize(info.dpi.x) : "—" },
            ]}
          />
          {info.dims && (
            <Panel title="Print size at common resolutions">
              <DataTable columns={["DPI", "Print size", "Quality"]} rows={[72, 150, 200, 300, 600].map((d) => [d, printSize(d), d >= 300 ? "Photo quality" : d >= 150 ? "Good for posters" : "Screen only"])} />
            </Panel>
          )}
          {info.kind === "png" && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Set PNG DPI (lossless, pixels unchanged)" htmlFor="dpi-n" className="w-60"><NumberInput id="dpi-n" value={newDpi} onChange={setNewDpi} min={1} max={10000} step={1} /></Field>
              <DownloadButton label="Download with new DPI" onClick={() => downloadBlob(new Blob([setPngDpi(info.bytes, Number(newDpi) || 72) as BlobPart], { type: "image/png" }), info.name.replace(/\.png$/i, "") + `-${newDpi}dpi.png`)} />
            </div>
          )}
          <Notice>DPI is only a print hint stored in the file; it does not change the number of pixels or on-screen sharpness.</Notice>
        </>
      )}
    </div>
  );
}

// ---------- Metadata viewer & EXIF remover ----------

function fmtVal(v: unknown): string {
  if (v instanceof Date) return v.toISOString().replace("T", " ").slice(0, 19);
  if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return `[${(v as Uint8Array).length} bytes]`;
  if (Array.isArray(v)) return v.length > 16 ? `[${v.length} values]` : v.join(", ");
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  if (v && typeof v === "object") return JSON.stringify(v).slice(0, 200);
  return String(v);
}

function MetadataViewer() {
  const [data, setData] = useState<{ name: string; size: number; type: string; dims: string; tags: [string, string][]; gps: { latitude: number; longitude: number } | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  const load = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      const exifr = (await import("exifr")).default;
      const head = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
      const meta = (await exifr.parse(f, { tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: false, interop: true, ifd1: false, mergeOutput: true, translateValues: true, reviveValues: true }).catch(() => null)) as Record<string, unknown> | null;
      const gps = (await exifr.gps(f).catch(() => null)) as { latitude: number; longitude: number } | null;
      let dims = "Unknown";
      try {
        const b = await decodeImage(f);
        dims = `${b.width} × ${b.height} px`;
        b.close();
      } catch {
        /* keep unknown */
      }
      const tags = Object.entries(meta ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, fmtVal(v)] as [string, string]);
      setData({ name: f.name, size: f.size, type: `${sniffImage(head).toUpperCase()} (${f.type || "unknown MIME"})`, dims, tags, gps: gps && Number.isFinite(gps.latitude) ? gps : null });
      report();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <FileDrop accept="image/*,.heic,.heif,.avif,.tif,.tiff" maxSizeMB={100} onFiles={([f]) => void load(f)} disabled={busy} />
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <KeyValueList items={[{ k: "File name", v: data.name }, { k: "Format", v: data.type }, { k: "Dimensions", v: data.dims }, { k: "File size", v: formatBytes(data.size) }]} />
          {data.gps && (
            <Notice tone="warn">
              📍 This photo contains GPS coordinates: {data.gps.latitude.toFixed(6)}, {data.gps.longitude.toFixed(6)}.{" "}
              <a className="underline" href={`https://www.openstreetmap.org/?mlat=${data.gps.latitude}&mlon=${data.gps.longitude}#map=15/${data.gps.latitude}/${data.gps.longitude}`} target="_blank" rel="noopener noreferrer nofollow">View on map</a>. Remove it with the EXIF Remover before sharing.
            </Notice>
          )}
          {data.tags.length ? (
            <Panel title={`${data.tags.length} metadata fields`} actions={<button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadText(JSON.stringify(Object.fromEntries(data.tags), null, 2), "metadata.json", "application/json")}>Export JSON</button>}>
              <DataTable columns={["Tag", "Value"]} rows={data.tags} maxHeight={520} />
            </Panel>
          ) : (
            <Notice tone="success">No EXIF, IPTC or XMP metadata was found in this file.</Notice>
          )}
        </>
      )}
    </div>
  );
}

function ExifRemover() {
  const [items, setItems] = useState<{ name: string; before: number; after: number; removed: string[]; blob: Blob; lossless: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const handle = async (files: File[]) => {
    setError(null);
    for (const f of files) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const kind = sniffImage(bytes);
        let out: Uint8Array | Blob;
        let removed: string[];
        let lossless = true;
        if (kind === "jpeg") ({ output: out, removed } = stripJpegMetadata(bytes, true));
        else if (kind === "png") ({ output: out, removed } = stripPngMetadata(bytes));
        else {
          const r = await processImage(f, [], { type: kind === "webp" ? "image/webp" : "image/jpeg", quality: 0.95 });
          out = r.blob;
          removed = ["All metadata (image re-encoded)"];
          lossless = false;
        }
        const blob = out instanceof Blob ? out : new Blob([out as BlobPart], { type: f.type || "image/jpeg" });
        const name = lossless ? f.name.replace(/(\.[^.]+)$/, "-clean$1") : replaceExtension(f.name.replace(/(\.[^.]+)$/, "-clean$1"), kind === "webp" ? "webp" : "jpg");
        setItems((p) => [...p, { name, before: f.size, after: blob.size, removed, blob, lossless }]);
        report();
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
    }
  };
  return (
    <div className="space-y-4">
      <FileDrop accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" multiple maxSizeMB={100} onFiles={(f) => void handle(f)} />
      {error && <ErrorBox message={error} />}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="surface flex flex-wrap items-center gap-3 rounded-xl p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{it.name}</p>
                <p className="text-muted text-xs">
                  {formatBytes(it.before)} → {formatBytes(it.after)} · {it.removed.length ? `Removed: ${it.removed.join(", ")}` : "No metadata found"} · {it.lossless ? "lossless (pixels untouched)" : "re-encoded"}
                </p>
              </div>
              <DownloadButton label="Download" onClick={() => downloadBlob(it.blob, it.name)} />
            </li>
          ))}
        </ul>
      )}
      <Notice>JPEG and PNG files are cleaned losslessly by removing metadata blocks (EXIF, GPS, XMP, comments) while keeping the color profile. Other formats are re-encoded, which also strips metadata.</Notice>
    </div>
  );
}

// ---------- Base64 ----------

function ImageToBase64() {
  const [res, setRes] = useState<{ name: string; mime: string; b64: string; size: number; dims: string } | null>(null);
  const [format, setFormat] = useState<"uri" | "raw" | "css" | "html" | "md">("uri");
  const report = useReportUse();
  const load = async (f: File) => {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const d = readDimensions(bytes);
    setRes({ name: f.name, mime: f.type || "image/png", b64: bytesToBase64(bytes), size: f.size, dims: d ? `${d.width}×${d.height}` : "" });
    report();
  };
  const uri = res ? `data:${res.mime};base64,${res.b64}` : "";
  const out = !res ? "" : format === "raw" ? res.b64 : format === "css" ? `background-image: url("${uri}");` : format === "html" ? `<img src="${uri}" alt="" width="${res.dims.split("×")[0] || ""}" height="${res.dims.split("×")[1] || ""}">` : format === "md" ? `![image](${uri})` : uri;
  return (
    <div className="space-y-4">
      <FileDrop accept="image/*" maxSizeMB={10} onFiles={([f]) => void load(f)} />
      {res && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <img src={uri} alt="Preview" className="checkerboard border-base max-h-24 rounded-lg border" />
            <div className="text-sm">
              <p className="font-semibold">{res.name}</p>
              <p className="text-muted">{res.dims} · {formatBytes(res.size)} → {formatBytes(uri.length)} as Base64 (+{Math.round((uri.length / res.size - 1) * 100)}%)</p>
            </div>
          </div>
          <Segmented ariaLabel="Output format" value={format} onChange={setFormat} options={[{ value: "uri", label: "Data URI" }, { value: "raw", label: "Base64 only" }, { value: "html", label: "<img>" }, { value: "css", label: "CSS" }, { value: "md", label: "Markdown" }]} />
          <Panel title="Output" actions={<CopyButton text={out} />}>
            <textarea className="field" rows={8} readOnly value={out.length > 300_000 ? out.slice(0, 300_000) + "… (truncated preview — Copy gets everything)" : out} />
          </Panel>
          {res.size > 20_000 && <Notice tone="warn">Inlining images over ~20 KB usually hurts page performance: Base64 is 33% larger and cannot be cached separately.</Notice>}
        </>
      )}
    </div>
  );
}

// ---------- ICO & favicons ----------

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

function PngToIco() {
  const [sizes, setSizes] = useState<number[]>([16, 32, 48]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  const make = async (f: File) => {
    if (!sizes.length) {
      setError("Select at least one size.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const bmp = await decodeImage(f);
      const entries = [];
      for (const s of [...sizes].sort((a, b) => a - b)) entries.push({ width: s, height: s, png: await bitmapToPng(bmp, s) });
      bmp.close();
      downloadBlob(new Blob([buildIco(entries) as BlobPart], { type: "image/x-icon" }), replaceExtension(f.name, "ico"));
      report();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl p-4">
        <span className="label">Sizes to include</span>
        <div className="flex flex-wrap gap-4">
          {ICO_SIZES.map((s) => (
            <Checkbox key={s} checked={sizes.includes(s)} onChange={(v) => setSizes((p) => (v ? [...p, s] : p.filter((x) => x !== s)))} label={`${s}×${s}`} />
          ))}
        </div>
        <p className="text-muted mt-2 text-xs">Non-square images are centred on a transparent square. Use a square image of at least 256×256 for the sharpest result.</p>
      </div>
      <FileDrop accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg" maxSizeMB={20} onFiles={([f]) => void make(f)} disabled={busy} label={busy ? "Building icon…" : undefined} />
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function FaviconGenerator() {
  const [name, setName] = useState("My Website");
  const [bg, setBg] = useState("#ffffff");
  const [transparent, setTransparent] = useState(true);
  const [result, setResult] = useState<{ preview: string; zip: Blob } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const report = useReportUse();
  const html = `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;
  const make = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      const bmp = await decodeImage(f, { svgWidth: 512 });
      const bgc = transparent ? undefined : bg;
      const png = async (s: number, solid?: string) => bitmapToPng(bmp, s, "contain", solid ?? bgc);
      const files: Record<string, Uint8Array> = {
        "favicon.ico": buildIco([{ width: 16, height: 16, png: await png(16) }, { width: 32, height: 32, png: await png(32) }, { width: 48, height: 48, png: await png(48) }]),
        "favicon-16x16.png": await png(16),
        "favicon-32x32.png": await png(32),
        "apple-touch-icon.png": await png(180, bg),
        "android-chrome-192x192.png": await png(192),
        "android-chrome-512x512.png": await png(512),
      };
      const manifest = { name, short_name: name.slice(0, 12), icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }], theme_color: bg, background_color: bg, display: "standalone" };
      files["site.webmanifest"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
      files["favicon-snippet.html"] = new TextEncoder().encode(html + "\n");
      bmp.close();
      const { zipSync } = await import("fflate");
      const zip = new Blob([zipSync(files) as BlobPart], { type: "application/zip" });
      if (result) URL.revokeObjectURL(result.preview);
      setResult({ preview: URL.createObjectURL(new Blob([files["android-chrome-192x192.png"] as BlobPart], { type: "image/png" })), zip });
      report();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="surface grid gap-4 rounded-2xl p-4 sm:grid-cols-3">
        <Field label="App / site name" htmlFor="fv-n"><input id="fv-n" className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Background / theme color" htmlFor="fv-bg"><input id="fv-bg" type="color" className="border-base h-10 w-20 rounded-lg border" value={bg} onChange={(e) => setBg(e.target.value)} /></Field>
        <div className="flex items-end pb-2"><Checkbox checked={transparent} onChange={setTransparent} label="Keep transparency (except Apple icon)" /></div>
      </div>
      <FileDrop accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg,.png,.jpg,.webp" maxSizeMB={20} onFiles={([f]) => void make(f)} disabled={busy} label={busy ? "Generating…" : "Upload your logo (square, 512×512 or SVG recommended)"} />
      {error && <ErrorBox message={error} />}
      {result && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <img src={result.preview} alt="Generated icon" className="checkerboard border-base h-20 w-20 rounded-xl border" />
            <DownloadButton label="Download favicon package (ZIP)" onClick={() => downloadBlob(result.zip, "favicons.zip")} />
          </div>
          <Panel title="Add this to your <head>" actions={<CopyButton text={html} />}>
            <pre className="font-mono text-xs whitespace-pre-wrap">{html}</pre>
          </Panel>
          <p className="text-muted text-xs">Package contains favicon.ico (16/32/48), PNG favicons, apple-touch-icon (180), Android icons (192/512) and site.webmanifest.</p>
        </>
      )}
    </div>
  );
}

const tools: Record<string, ComponentType> = {
  "jpg-to-png": () => <Converter accept="image/jpeg,.jpg,.jpeg,.jfif" to="image/png" />,
  "png-to-jpg": () => <Converter accept="image/png,.png" to="image/jpeg" lossy />,
  "webp-to-png": () => <Converter accept="image/webp,.webp" to="image/png" />,
  "png-to-webp": () => <Converter accept="image/png,.png" to="image/webp" lossy />,
  "avif-to-jpg": () => <Converter accept="image/avif,.avif" to="image/jpeg" lossy />,
  "jpg-to-avif": () => <Converter accept="image/jpeg,.jpg,.jpeg" to="image/avif" lossy hint="AVIF encoding runs as WebAssembly on your device and can take a few seconds per photo." />,
  "heic-to-jpg": () => <Converter accept="image/heic,image/heif,.heic,.heif" to="image/jpeg" lossy />,
  "heic-to-png": () => <Converter accept="image/heic,image/heif,.heic,.heif" to="image/png" />,
  "svg-to-png": () => <Converter accept="image/svg+xml,.svg" to="image/png" svg />,
  "png-to-ico": PngToIco,
  "favicon-generator": FaviconGenerator,
  "image-compressor": Compressor,
  "image-resizer": Resizer,
  "image-cropper": Cropper,
  "image-rotator": Rotator,
  "image-flipper": Flipper,
  "image-grayscale": Grayscale,
  "image-blur": Blur,
  "image-brightness": Brightness,
  "image-contrast": Contrast,
  "image-color-picker": ColorPicker,
  "image-dpi-checker": DpiChecker,
  "image-metadata-viewer": MetadataViewer,
  "exif-remover": ExifRemover,
  "image-to-base64": ImageToBase64,
};

export default tools;
