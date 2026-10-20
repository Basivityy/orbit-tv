"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, FileUp } from "lucide-react";
import { Checkbox, ClearButton, CopyButton, DownloadButton, ErrorBox, Field, NumberInput, Select, downloadText, useReportUse } from "./kit";

export type OptionDef =
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[]; default: string }
  | { type: "checkbox"; name: string; label: string; default: boolean }
  | { type: "number"; name: string; label: string; default: number; min?: number; max?: number; step?: number }
  | { type: "text"; name: string; label: string; default: string; placeholder?: string };

export type OptionValues = Record<string, string | number | boolean>;

export type TransformResult = string | { output: string; info?: string };

export interface TextTransformConfig {
  transform: (input: string, opts: OptionValues) => TransformResult | Promise<TransformResult>;
  options?: OptionDef[];
  inputLabel?: string;
  outputLabel?: string;
  placeholder?: string;
  sample?: string;
  /** Run automatically while typing (default). Set false for expensive transforms. */
  live?: boolean;
  actionLabel?: string;
  download?: { filename: string; mime?: string };
  fileAccept?: string;
  /** Allow empty input (e.g. generators). */
  allowEmpty?: boolean;
  rows?: number;
}

const MAX_FILE_MB = 10;

export function TextTransformTool(cfg: TextTransformConfig) {
  const defaults = useMemo(() => Object.fromEntries((cfg.options ?? []).map((o) => [o.name, o.default])) as OptionValues, [cfg.options]);
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<OptionValues>(defaults);
  const [output, setOutput] = useState("");
  const [info, setInfo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const live = cfg.live ?? true;
  const report = useReportUse();
  const runId = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (text: string, o: OptionValues, userAction: boolean) => {
    const id = ++runId.current;
    if (!text && !cfg.allowEmpty) {
      setOutput("");
      setInfo(undefined);
      setError(null);
      return;
    }
    setBusy(true);
    try {
      const res = await cfg.transform(text, o);
      if (id !== runId.current) return;
      const out = typeof res === "string" ? res : res.output;
      setOutput(out);
      setInfo(typeof res === "string" ? undefined : res.info);
      setError(null);
      if (userAction && (text || cfg.allowEmpty)) report();
    } catch (e) {
      if (id !== runId.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setOutput("");
      setInfo(undefined);
    } finally {
      if (id === runId.current) setBusy(false);
    }
  };

  useEffect(() => {
    if (!live) return;
    const delay = input.length > 100_000 ? 400 : 120;
    const t = setTimeout(() => void run(input, opts, dirty), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, opts, live]);

  const setOpt = (name: string, v: string | number | boolean) => {
    setDirty(true);
    setOpts((p) => ({ ...p, [name]: v }));
  };

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_FILE_MB} MB.`);
      return;
    }
    setDirty(true);
    setInput(await f.text());
  };

  return (
    <div className="space-y-4">
      {cfg.options && cfg.options.length > 0 && (
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          {cfg.options.map((o) => {
            const id = `opt-${o.name}`;
            if (o.type === "checkbox") return <Checkbox key={o.name} checked={Boolean(opts[o.name])} onChange={(v) => setOpt(o.name, v)} label={o.label} />;
            if (o.type === "select")
              return (
                <Field key={o.name} label={o.label} htmlFor={id} className="min-w-40">
                  <Select id={id} value={String(opts[o.name])} onChange={(v) => setOpt(o.name, v)} options={o.options} />
                </Field>
              );
            if (o.type === "number")
              return (
                <Field key={o.name} label={o.label} htmlFor={id} className="w-36">
                  <NumberInput id={id} value={String(opts[o.name])} min={o.min} max={o.max} step={o.step ?? 1} onChange={(v) => setOpt(o.name, v === "" ? "" : Number(v))} />
                </Field>
              );
            return (
              <Field key={o.name} label={o.label} htmlFor={id} className="min-w-48 flex-1">
                <input id={id} className="field" value={String(opts[o.name])} placeholder={o.placeholder} onChange={(e) => setOpt(o.name, e.target.value)} />
              </Field>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="tool-input" className="label mb-0">
              {cfg.inputLabel ?? "Input"}
            </label>
            <div className="flex gap-1">
              {cfg.sample && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInput(cfg.sample!)}>
                  Sample
                </button>
              )}
              {cfg.fileAccept && (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                    <FileUp className="h-3.5 w-3.5" aria-hidden /> Open file
                  </button>
                  <input ref={fileRef} type="file" accept={cfg.fileAccept} className="sr-only" onChange={(e) => void loadFile(e.target.files?.[0])} />
                </>
              )}
              {input && <ClearButton onClick={() => setInput("")} />}
            </div>
          </div>
          <textarea
            id="tool-input"
            className="field"
            rows={cfg.rows ?? 12}
            value={input}
            spellCheck={false}
            placeholder={cfg.placeholder ?? "Type or paste text here…"}
            onChange={(e) => {
              setDirty(true);
              setInput(e.target.value);
            }}
          />
          <p className="text-muted mt-1 text-xs tabular-nums">{input.length.toLocaleString("en-US")} characters</p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="tool-output" className="label mb-0">
              {cfg.outputLabel ?? "Output"}
            </label>
            <div className="flex gap-1">
              {output && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Use output as input"
                  onClick={() => {
                    setInput(output);
                  }}
                >
                  <ArrowDownUp className="h-3.5 w-3.5" aria-hidden /> Reuse
                </button>
              )}
              <CopyButton text={output} />
            </div>
          </div>
          <textarea id="tool-output" className="field" rows={cfg.rows ?? 12} value={output} readOnly spellCheck={false} placeholder={busy ? "Working…" : "Result appears here"} />
          {info && !error && <p className="text-muted mt-1 text-xs">{info}</p>}
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap gap-2">
        {!live && (
          <button type="button" className="btn btn-primary" disabled={busy || (!input && !cfg.allowEmpty)} onClick={() => void run(input, opts, true)}>
            {busy ? "Working…" : (cfg.actionLabel ?? "Convert")}
          </button>
        )}
        {cfg.download && output && (
          <DownloadButton primary={live} label={`Download ${cfg.download.filename.split(".").pop()?.toUpperCase()}`} onClick={() => downloadText(output, cfg.download!.filename, cfg.download!.mime)} />
        )}
      </div>
    </div>
  );
}
