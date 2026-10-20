"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Loader2, X } from "lucide-react";
import { processImage, type OpsSpec } from "../imaging/client";
import type { OutputSpec } from "../imaging/pipeline";
import { replaceExtension } from "../logic/imageformat";
import { ErrorBox, FileDrop, downloadBlob, formatBytes, useReportUse } from "./kit";

export interface ImageJob {
  ops: OpsSpec;
  output: OutputSpec;
  ext: string;
  svgWidth?: number;
}

interface Item {
  id: number;
  file: File;
  status: "pending" | "working" | "done" | "error";
  result?: { blob: Blob; url: string; width: number; height: number; name: string };
  error?: string;
}

export interface ImageBatchProps {
  accept: string;
  /** Builds the job from current options. Throw to show a validation error. */
  job: () => ImageJob;
  options?: ReactNode;
  maxSizeMB?: number;
  multiple?: boolean;
  actionLabel?: string;
  /** Hide size savings (useful when output is expected to be larger). */
  hint?: string;
  /** Rerun automatically whenever this key changes (e.g. option changes). */
  autoKey?: string;
}

let nextId = 1;

export function ImageBatch({ accept, job, options, maxSizeMB = 50, multiple = true, actionLabel = "Convert", hint, autoKey }: ImageBatchProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => () => itemsRef.current.forEach((i) => i.result && URL.revokeObjectURL(i.result.url)), []);

  const run = async (list: Item[]) => {
    let j: ImageJob;
    try {
      j = job();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    // Sequential processing keeps memory bounded for large batches.
    for (const it of list) {
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status: "working", error: undefined } : p)));
      try {
        const r = await processImage(it.file, j.ops, j.output, { svgWidth: j.svgWidth });
        const url = URL.createObjectURL(r.blob);
        setItems((prev) =>
          prev.map((p) => {
            if (p.id !== it.id) return p;
            if (p.result) URL.revokeObjectURL(p.result.url);
            return { ...p, status: "done", result: { blob: r.blob, url, width: r.width, height: r.height, name: replaceExtension(it.file.name, j.ext) } };
          }),
        );
        report();
      } catch (e) {
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status: "error", error: (e as Error).message } : p)));
      }
    }
    setBusy(false);
  };

  useEffect(() => {
    if (autoKey !== undefined && itemsRef.current.length && !busy) void run(itemsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  const add = (files: File[]) => {
    const newItems = files.map((file) => ({ id: nextId++, file, status: "pending" as const }));
    const next = multiple ? [...items, ...newItems] : newItems;
    if (!multiple) items.forEach((i) => i.result && URL.revokeObjectURL(i.result.url));
    setItems(next);
    void run(newItems);
  };

  const remove = (id: number) =>
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it?.result) URL.revokeObjectURL(it.result.url);
      return prev.filter((p) => p.id !== id);
    });

  const done = items.filter((i) => i.status === "done");

  const downloadZip = async () => {
    const { zipSync } = await import("fflate");
    const files: Record<string, Uint8Array> = {};
    const used = new Set<string>();
    for (const it of done) {
      let name = it.result!.name;
      for (let n = 2; used.has(name); n++) name = it.result!.name.replace(/(\.[^.]+)$/, `-${n}$1`);
      used.add(name);
      files[name] = new Uint8Array(await it.result!.blob.arrayBuffer());
    }
    downloadBlob(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: "application/zip" }), "images.zip");
  };

  return (
    <div className="space-y-4">
      {options && <div className="surface rounded-2xl p-4">{options}</div>}
      <FileDrop accept={accept} multiple={multiple} maxSizeMB={maxSizeMB} onFiles={add} disabled={busy} hint={hint} />
      {error && <ErrorBox message={error} />}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted text-sm">
              {done.length}/{items.length} processed
            </p>
            <div className="flex gap-2">
              {autoKey === undefined && (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(items)}>
                  {actionLabel} again with current settings
                </button>
              )}
              {done.length > 1 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void downloadZip()}>
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download all (ZIP)
                </button>
              )}
            </div>
          </div>
          <ul className="space-y-2">
            {items.map((it) => {
              const delta = it.result ? ((it.result.blob.size - it.file.size) / it.file.size) * 100 : 0;
              return (
                <li key={it.id} className="surface flex items-center gap-3 rounded-xl p-2.5 animate-fade-in">
                  <div className="checkerboard border-base flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                    {it.result ? <img src={it.result.url} alt="" className="max-h-full max-w-full object-contain" /> : it.status === "working" ? <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-hidden /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{it.result?.name ?? it.file.name}</p>
                    {it.status === "error" ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{it.error}</p>
                    ) : it.result ? (
                      <p className="text-muted text-xs tabular-nums">
                        {it.result.width}×{it.result.height} · {formatBytes(it.file.size)} → {formatBytes(it.result.blob.size)}{" "}
                        <span className={delta <= 0 ? "text-emerald-600" : "text-amber-600"}>({delta > 0 ? "+" : ""}{delta.toFixed(0)}%)</span>
                      </p>
                    ) : (
                      <p className="text-muted text-xs">{it.status === "working" ? "Processing…" : "Waiting…"}</p>
                    )}
                  </div>
                  {it.result && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => (downloadBlob(it.result!.blob, it.result!.name), report())}>
                      <Download className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">Download</span>
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${it.file.name}`} onClick={() => remove(it.id)}>
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
