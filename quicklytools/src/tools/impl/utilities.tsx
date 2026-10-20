"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Pause, Play, RotateCcw, Flag } from "lucide-react";
import * as U from "../logic/convert";
import * as D from "../logic/developer";
import { FormCalculator } from "../ui/FormCalculator";
import { HexToHsl, RgbToHex } from "../ui/ColorTools";
import { BinaryToText, HexToText, TextToHex } from "./text";
import { CopyButton, DataTable, ErrorBox, Field, KeyValueList, Notice, NumberInput, Panel, Segmented, Select, StatGrid, useReportUse } from "../ui/kit";

// ---------- Network ----------

function WhatIsMyIp() {
  const [data, setData] = useState<{ ip: string; version: string; country?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const report = useReportUse();
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ip", { cache: "no-store" });
      if (res.status === 429) throw new Error("Too many requests. Please wait a minute and try again.");
      if (!res.ok) throw new Error(`The IP service returned an error (${res.status}).`);
      setData(await res.json());
      report();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [report]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl p-6 text-center">
        <p className="text-muted text-sm">Your public IP address</p>
        <p className="mt-2 font-mono text-3xl font-bold tracking-tight break-all sm:text-4xl" aria-live="polite">
          {loading ? "Detecting…" : (data?.ip ?? "—")}
        </p>
        {data && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="chip">{data.version}</span>
            {data.country && <span className="chip">Country: {data.country}</span>}
            <CopyButton text={data.ip} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Refresh
            </button>
          </div>
        )}
      </div>
      {error && <ErrorBox message={error} />}
      <Notice>
        This is the address websites see when you connect. If you use a VPN, proxy or iCloud Private Relay, you will see that service&apos;s address. We do not store or log the lookup.
      </Notice>
    </div>
  );
}

const IPV6_URL = process.env.NEXT_PUBLIC_IPV6_TEST_URL || "";

function Ipv6Checker() {
  const [state, setState] = useState<{ v4: string | null; v6: string | null; v6Error: string | null; done: boolean }>({ v4: null, v6: null, v6Error: null, done: false });
  const report = useReportUse();
  const run = useCallback(async () => {
    setState({ v4: null, v6: null, v6Error: null, done: false });
    let v4: string | null = null;
    let v6: string | null = null;
    let v6Error: string | null = null;
    try {
      const r = await fetch("/api/ip", { cache: "no-store" });
      const j = await r.json();
      if (j.version === "IPv6") v6 = j.ip;
      else v4 = j.ip;
    } catch {
      /* ignored */
    }
    if (!v6) {
      if (!IPV6_URL) v6Error = "not-configured";
      else {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 6000);
          const r = await fetch(IPV6_URL, { cache: "no-store", signal: ctrl.signal });
          clearTimeout(t);
          const j = await r.json();
          if (j.version === "IPv6") v6 = j.ip;
          else v6Error = "The IPv6-only test endpoint answered over IPv4, which suggests a misconfigured test host.";
        } catch {
          v6Error = "Could not reach the IPv6-only test host. Your connection most likely has no working IPv6.";
        }
      }
    }
    setState({ v4, v6, v6Error, done: true });
    report();
  }, [report]);
  useEffect(() => {
    void run();
  }, [run]);
  return (
    <div className="space-y-4">
      <StatGrid
        columns={2}
        stats={[
          { label: "IPv6 connectivity", value: !state.done ? "Testing…" : state.v6 ? "✓ Supported" : state.v6Error === "not-configured" ? "Unknown" : "✗ Not detected", primary: true },
          { label: "Address used for this site", value: !state.done ? "…" : (state.v6 ?? state.v4 ?? "—") },
        ]}
      />
      {state.done && state.v6 && <Notice tone="success">Your connection reached us over IPv6 ({state.v6}).</Notice>}
      {state.done && state.v6Error === "not-configured" && (
        <Notice tone="warn">
          Your browser connected over IPv4. A definitive IPv6 test needs a separate IPv6-only host name (an AAAA record without an A record). The site operator has not configured one yet
          (NEXT_PUBLIC_IPV6_TEST_URL), so we can only say that IPv4 was preferred for this connection.
        </Notice>
      )}
      {state.done && state.v6Error && state.v6Error !== "not-configured" && <Notice tone="warn">{state.v6Error}</Notice>}
      <button type="button" className="btn btn-secondary" onClick={() => void run()}>
        Run test again
      </button>
    </div>
  );
}

// ---------- Security ----------

function PasswordEntropy() {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const report = useReportUse();
  const r = useMemo(() => U.passwordEntropy(pw), [pw]);
  const color = r.bits < 36 ? "bg-red-500" : r.bits < 60 ? "bg-amber-500" : r.bits < 80 ? "bg-emerald-500" : "bg-emerald-600";
  return (
    <div className="space-y-4">
      <Field label="Password to analyse" htmlFor="pe" hint="Analysed locally in your browser. Never sent anywhere.">
        <div className="flex gap-2">
          <input id="pe" type={show ? "text" : "password"} className="field font-mono" autoComplete="off" value={pw} onChange={(e) => (setPw(e.target.value), report())} />
          <button type="button" className="btn btn-secondary" onClick={() => setShow((s) => !s)}>{show ? "Hide" : "Show"}</button>
        </div>
      </Field>
      <div className="bg-surface-2 h-2.5 overflow-hidden rounded-full">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, (r.bits / 100) * 100)}%` }} />
      </div>
      <StatGrid
        columns={4}
        stats={[
          { label: "Entropy", value: `${r.bits.toFixed(1)} bits`, primary: true },
          { label: "Strength", value: r.strength },
          { label: "Character pool", value: r.poolSize },
          { label: "Est. offline crack time", value: r.crackTime, hint: "10 billion guesses/second" },
        ]}
      />
      {r.warnings.length > 0 && (
        <ul className="space-y-1 text-sm">
          {r.warnings.map((w) => (
            <li key={w} className="text-amber-700 dark:text-amber-300">⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- CSS units ----------

function CssUnitConverter() {
  const [value, setValue] = useState("24");
  const [from, setFrom] = useState<U.CssUnit>("px");
  const [ctx, setCtx] = useState({ rootFontSize: "16", parentFontSize: "16", viewportWidth: "1440", viewportHeight: "900", containerSize: "1200" });
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      const c = Object.fromEntries(Object.entries(ctx).map(([k, v]) => [k, Number(v)])) as Parameters<typeof U.convertCssUnit>[2];
      return { r: U.convertCssUnit(Number(value), from, c), e: null as string | null };
    } catch (e) {
      return { r: null, e: (e as Error).message };
    }
  }, [value, from, ctx]);
  const units: U.CssUnit[] = ["px", "rem", "em", "pt", "pc", "in", "cm", "mm", "vw", "vh", "%"];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Value" htmlFor="cu" className="w-40">
          <NumberInput id="cu" value={value} onChange={(v) => (setValue(v), report())} />
        </Field>
        <Field label="Unit" htmlFor="cuf" className="w-32">
          <Select id="cuf" value={from} onChange={setFrom} options={units.map((u) => ({ value: u, label: u }))} />
        </Field>
      </div>
      <details className="bg-surface-2 rounded-xl px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">Context (font sizes, viewport, container)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(ctx) as (keyof typeof ctx)[]).map((k) => (
            <Field key={k} label={{ rootFontSize: "Root font (px)", parentFontSize: "Parent font (px)", viewportWidth: "Viewport W (px)", viewportHeight: "Viewport H (px)", containerSize: "Container (px)" }[k]} htmlFor={`ctx-${k}`}>
              <NumberInput id={`ctx-${k}`} value={ctx[k]} onChange={(v) => setCtx((p) => ({ ...p, [k]: v }))} min={1} />
            </Field>
          ))}
        </div>
      </details>
      {res.e && <ErrorBox message={res.e} />}
      {res.r && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {units.map((u) => {
            const text = `${U.fmtNum(res.r![u], 4)}${u}`;
            return (
              <button key={u} type="button" onClick={() => navigator.clipboard?.writeText(text)} title="Click to copy" className={`surface rounded-xl px-3 py-2.5 text-left transition hover:border-brand-400 ${u === from ? "ring-2 ring-brand-500" : ""}`}>
                <span className="text-muted block text-xs">{u}</span>
                <span className="font-mono text-sm font-semibold break-all">{U.fmtNum(res.r![u], 4)}</span>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-muted text-xs">Absolute units follow the CSS spec: 1in = 96px, 1pt = 1/72in. Click a value to copy it.</p>
    </div>
  );
}

function PxRem({ direction }: { direction: "px2rem" | "rem2px" }) {
  const [v, setV] = useState(direction === "px2rem" ? "24" : "1.5");
  const [base, setBase] = useState("16");
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      const n = Number(v);
      if (v.trim() === "" || !Number.isFinite(n)) throw new Error("Enter a number.");
      return { out: direction === "px2rem" ? U.pxToRem(n, Number(base)) : U.remToPx(n, Number(base)), e: null as string | null };
    } catch (e) {
      return { out: null, e: (e as Error).message };
    }
  }, [v, base, direction]);
  const fromU = direction === "px2rem" ? "px" : "rem";
  const toU = direction === "px2rem" ? "rem" : "px";
  const common = direction === "px2rem" ? [10, 12, 14, 16, 18, 20, 24, 32, 40, 48, 64] : [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
  const b = Number(base) > 0 ? Number(base) : 16;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={`Value (${fromU})`} htmlFor="pr" className="w-40">
          <NumberInput id="pr" value={v} onChange={(x) => (setV(x), report())} suffix={fromU} />
        </Field>
        <Field label="Root font size" htmlFor="prb" className="w-40" hint="Browser default is 16px">
          <NumberInput id="prb" value={base} onChange={setBase} suffix="px" min={1} />
        </Field>
      </div>
      {res.e ? <ErrorBox message={res.e} /> : (
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold tabular-nums">{U.fmtNum(res.out!, 4)}{toU}</span>
          <CopyButton text={`${U.fmtNum(res.out!, 4)}${toU}`} />
        </div>
      )}
      <Panel title={`Common values (base ${b}px)`}>
        <DataTable columns={[fromU, toU]} rows={common.map((c) => [`${c}${fromU}`, `${U.fmtNum(direction === "px2rem" ? c / b : c * b, 4)}${toU}`])} maxHeight={320} />
      </Panel>
    </div>
  );
}

// ---------- Number systems ----------

function NumberBaseConverter({ highlight }: { highlight?: "octal" }) {
  const [value, setValue] = useState(highlight === "octal" ? "755" : "255");
  const [base, setBase] = useState(highlight === "octal" ? "8" : "10");
  const [custom, setCustom] = useState("36");
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      const r = U.convertBase(value, Number(base));
      const cb = Number(custom);
      return { r, customOut: cb >= 2 && cb <= 36 ? U.formatInBase(r.value, cb) : null, e: null as string | null };
    } catch (e) {
      return { r: null, customOut: null, e: (e as Error).message };
    }
  }, [value, base, custom]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Number" htmlFor="nb" className="min-w-56 flex-1">
          <input id="nb" className="field font-mono" value={value} onChange={(e) => (setValue(e.target.value), report())} spellCheck={false} />
        </Field>
        <Field label="Input base" htmlFor="nbb" className="w-48">
          <Select id="nbb" value={base} onChange={setBase} options={[{ value: "2", label: "Binary (2)" }, { value: "8", label: "Octal (8)" }, { value: "10", label: "Decimal (10)" }, { value: "16", label: "Hexadecimal (16)" }, ...[3, 4, 5, 6, 7, 9, 12, 20, 32, 36].map((b) => ({ value: String(b), label: `Base ${b}` }))]} />
        </Field>
      </div>
      {res.e && <ErrorBox message={res.e} />}
      {res.r && (
        <KeyValueList
          items={[
            { k: "Binary (2)", v: U.groupDigits(res.r.binary, 4), copy: res.r.binary },
            { k: "Octal (8)", v: res.r.octal, copy: res.r.octal },
            { k: "Decimal (10)", v: U.groupDigits(res.r.decimal, 3, ","), copy: res.r.decimal },
            { k: "Hexadecimal (16)", v: res.r.hex, copy: res.r.hex },
            ...(highlight === "octal" && /^[0-7]{3,4}$/.test(res.r.octal) ? [{ k: "Unix permissions", v: unixPerms(res.r.octal) }] : []),
          ]}
        />
      )}
      {res.r && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Also convert to base" htmlFor="nbc" className="w-36">
            <NumberInput id="nbc" value={custom} onChange={setCustom} min={2} max={36} step={1} />
          </Field>
          <code className="bg-surface-2 rounded-lg px-3 py-2 font-mono text-sm break-all">{res.customOut ?? "Base must be 2–36"}</code>
        </div>
      )}
      <p className="text-muted text-xs">Arbitrary precision: very large integers are converted exactly (BigInt). Fractions are not supported.</p>
    </div>
  );
}

function unixPerms(octal: string): string {
  const digits = octal.slice(-3).split("").map(Number);
  return digits.map((d) => `${d & 4 ? "r" : "-"}${d & 2 ? "w" : "-"}${d & 1 ? "x" : "-"}`).join("") + "  (owner · group · others)";
}

function BinaryCalculator() {
  const [a, setA] = useState("1011");
  const [b, setB] = useState("110");
  const [op, setOp] = useState<U.BinaryOp>("+");
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      return { r: U.binaryCalc(a, b, op), e: null as string | null };
    } catch (e) {
      return { r: null, e: (e as Error).message };
    }
  }, [a, b, op]);
  const ops: U.BinaryOp[] = ["+", "-", "*", "/", "%", "AND", "OR", "XOR", "<<", ">>"];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <Field label="First binary number" htmlFor="ba">
          <input id="ba" className="field font-mono" value={a} onChange={(e) => (setA(e.target.value), report())} />
        </Field>
        <Field label="Operation" htmlFor="bo">
          <Select id="bo" value={op} onChange={setOp} options={ops.map((o) => ({ value: o, label: o }))} />
        </Field>
        <Field label="Second binary number" htmlFor="bb">
          <input id="bb" className="field font-mono" value={b} onChange={(e) => setB(e.target.value)} />
        </Field>
      </div>
      {res.e && <ErrorBox message={res.e} />}
      {res.r && (
        <KeyValueList
          items={[
            { k: "Result (binary)", v: res.r.binary, copy: res.r.binary },
            { k: "Decimal", v: res.r.decimal, copy: res.r.decimal },
            { k: "Hexadecimal", v: res.r.hex },
            { k: "Octal", v: res.r.octal },
            { k: "Inputs (decimal)", v: `${safeDec(a)} ${op} ${safeDec(b)}` },
          ]}
        />
      )}
      <p className="text-muted text-xs">Division is integer division (remainder discarded). Negative numbers use a leading minus sign, not two&apos;s complement.</p>
    </div>
  );
}

function safeDec(s: string) {
  try {
    return U.parseInBase(s, 2).toString();
  } catch {
    return "?";
  }
}

function RomanConverter() {
  const [mode, setMode] = useState<"to" | "from">("to");
  const [v, setV] = useState("2026");
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      if (!v.trim()) return { out: "", e: null as string | null };
      return { out: mode === "to" ? U.toRoman(Number(v)) : String(U.fromRoman(v)), e: null };
    } catch (e) {
      return { out: "", e: (e as Error).message };
    }
  }, [v, mode]);
  return (
    <div className="space-y-4">
      <Segmented ariaLabel="Direction" value={mode} onChange={(m) => (setMode(m), setV(m === "to" ? "2026" : "MMXXVI"))} options={[{ value: "to", label: "Number → Roman" }, { value: "from", label: "Roman → Number" }]} />
      <Field label={mode === "to" ? "Number (1–3999)" : "Roman numeral"} htmlFor="rn">
        <input id="rn" className="field max-w-sm font-mono text-lg" value={v} onChange={(e) => (setV(e.target.value), report())} inputMode={mode === "to" ? "numeric" : "text"} />
      </Field>
      {res.e && <ErrorBox message={res.e} />}
      {res.out && (
        <div className="flex items-center gap-3">
          <span className="font-mono text-4xl font-bold tracking-wide">{res.out}</span>
          <CopyButton text={res.out} />
        </div>
      )}
      <DataTable columns={["Symbol", "Value"]} rows={[["I", 1], ["V", 5], ["X", 10], ["L", 50], ["C", 100], ["D", 500], ["M", 1000]]} maxHeight={300} />
    </div>
  );
}

// ---------- Timers ----------

function beep(times = 3) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.45;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
    }
    setTimeout(() => void ctx.close(), times * 450 + 500);
  } catch {
    /* audio unavailable */
  }
}

function fmtClock(ms: number, withMs = false): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const base = `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
  return withMs ? `${base}.${String(cs).padStart(2, "0")}` : base;
}

/** Drift-free timer: derives elapsed time from timestamps rather than counting ticks. */
function useTicker(running: boolean, interval = 100) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((x) => x + 1), interval);
    return () => clearInterval(t);
  }, [running, interval]);
}

function useTitle(text: string | null) {
  useEffect(() => {
    if (text === null) return;
    const old = document.title;
    document.title = text;
    return () => {
      document.title = old;
    };
  }, [text]);
}

function CountdownTimer() {
  const [h, setH] = useState("0");
  const [m, setM] = useState("5");
  const [s, setS] = useState("0");
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const report = useReportUse();
  const running = endAt !== null;
  useTicker(running, 200);
  const left = running ? Math.max(0, endAt - Date.now()) : (remaining ?? 0);
  useEffect(() => {
    if (running && left <= 0) {
      setEndAt(null);
      setRemaining(0);
      setDone(true);
      beep(4);
      if ("Notification" in window && Notification.permission === "granted") new Notification("Time's up!", { body: "Your countdown has finished." });
    }
  }, [running, left]);
  useTitle(running ? `⏳ ${fmtClock(left)}` : done ? "⏰ Time's up!" : null);
  const total = (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
  const start = () => {
    const ms = remaining && remaining > 0 ? remaining : total;
    if (!(ms > 0)) return;
    setDone(false);
    setEndAt(Date.now() + ms);
    report();
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  };
  const pause = () => {
    if (endAt) setRemaining(Math.max(0, endAt - Date.now()));
    setEndAt(null);
  };
  const reset = () => {
    setEndAt(null);
    setRemaining(null);
    setDone(false);
  };
  const presets = [1, 3, 5, 10, 15, 25, 30, 60];
  return (
    <div className="space-y-5">
      {!running && remaining === null && (
        <div className="flex flex-wrap items-end gap-3">
          {[["Hours", h, setH, 99], ["Minutes", m, setM, 59], ["Seconds", s, setS, 59]].map(([label, val, set, max]) => (
            <Field key={label as string} label={label as string} htmlFor={`cd-${label}`} className="w-24">
              <NumberInput id={`cd-${label}`} value={val as string} onChange={set as (v: string) => void} min={0} max={max as number} step={1} />
            </Field>
          ))}
        </div>
      )}
      {!running && remaining === null && (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} type="button" className="chip hover:text-brand-600" onClick={() => (setH(String(Math.floor(p / 60))), setM(String(p % 60)), setS("0"))}>
              {p} min
            </button>
          ))}
        </div>
      )}
      <div className={`surface rounded-2xl py-10 text-center font-mono text-6xl font-bold tabular-nums sm:text-7xl ${done ? "text-red-600 animate-pulse" : ""}`} aria-live="off">
        {fmtClock(running || remaining !== null ? left : total)}
      </div>
      {done && <Notice tone="warn">Time&apos;s up!</Notice>}
      <div className="flex justify-center gap-2">
        {!running ? (
          <button type="button" className="btn btn-primary" onClick={start} disabled={!(total > 0) && !(remaining && remaining > 0)}>
            <Play className="h-4 w-4" aria-hidden /> {remaining ? "Resume" : "Start"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={pause}>
            <Pause className="h-4 w-4" aria-hidden /> Pause
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </button>
      </div>
      <p className="text-muted text-center text-xs">Keep this tab open. Browsers may delay timers in background tabs, but the end time is calculated from the clock, so it stays accurate.</p>
    </div>
  );
}

function Stopwatch() {
  const [startAt, setStartAt] = useState<number | null>(null);
  const [acc, setAcc] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const report = useReportUse();
  const running = startAt !== null;
  useTicker(running, 47);
  const elapsed = acc + (running ? Date.now() - startAt : 0);
  useTitle(running ? `⏱ ${fmtClock(elapsed)}` : null);
  const lapRows = laps.map((t, i) => [i + 1, fmtClock(t - (laps[i - 1] ?? 0), true), fmtClock(t, true)]).reverse();
  return (
    <div className="space-y-5">
      <div className="surface rounded-2xl py-10 text-center font-mono text-6xl font-bold tabular-nums sm:text-7xl">{fmtClock(elapsed, true)}</div>
      <div className="flex justify-center gap-2">
        {!running ? (
          <button type="button" className="btn btn-primary" onClick={() => (setStartAt(Date.now()), report())}>
            <Play className="h-4 w-4" aria-hidden /> {acc ? "Resume" : "Start"}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => (setAcc(elapsed), setStartAt(null))}>
            <Pause className="h-4 w-4" aria-hidden /> Stop
          </button>
        )}
        <button type="button" className="btn btn-secondary" disabled={!running} onClick={() => setLaps((l) => [...l, elapsed])}>
          <Flag className="h-4 w-4" aria-hidden /> Lap
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => (setStartAt(null), setAcc(0), setLaps([]))}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </button>
      </div>
      {laps.length > 0 && <DataTable columns={["Lap", "Lap time", "Total"]} rows={lapRows} maxHeight={320} />}
    </div>
  );
}

function PomodoroTimer() {
  const [cfg, setCfg] = useState({ work: "25", short: "5", long: "15", every: "4" });
  const [phase, setPhase] = useState<"work" | "short" | "long">("work");
  const [completed, setCompleted] = useState(0);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const report = useReportUse();
  const running = endAt !== null;
  useTicker(running, 250);
  const phaseMs = (p: typeof phase) => Math.max(1, Number(cfg[p === "work" ? "work" : p === "short" ? "short" : "long"]) || 1) * 60000;
  const left = running ? Math.max(0, endAt - Date.now()) : (remaining ?? phaseMs(phase));
  const nextPhase = useRef<() => void>(() => {});
  nextPhase.current = () => {
    beep(3);
    let next: typeof phase = "work";
    let c = completed;
    if (phase === "work") {
      c = completed + 1;
      setCompleted(c);
      next = c % Math.max(1, Number(cfg.every) || 4) === 0 ? "long" : "short";
    }
    setPhase(next);
    setRemaining(null);
    setEndAt(Date.now() + phaseMs(next));
    if ("Notification" in window && Notification.permission === "granted") new Notification(next === "work" ? "Back to focus" : "Take a break", { body: next === "work" ? "Next focus session started." : "Focus session complete." });
  };
  useEffect(() => {
    if (running && left <= 0) nextPhase.current();
  }, [running, left]);
  useTitle(running ? `${phase === "work" ? "🍅" : "☕"} ${fmtClock(left)}` : null);
  const label = { work: "Focus", short: "Short break", long: "Long break" }[phase];
  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <Segmented ariaLabel="Phase" value={phase} onChange={(p) => (setPhase(p), setEndAt(null), setRemaining(null))} options={[{ value: "work", label: "Focus" }, { value: "short", label: "Short break" }, { value: "long", label: "Long break" }]} />
      </div>
      <div className={`rounded-2xl py-10 text-center ${phase === "work" ? "bg-rose-50 dark:bg-rose-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"}`}>
        <p className="text-muted text-sm font-semibold tracking-wide uppercase">{label}</p>
        <p className="font-mono text-6xl font-bold tabular-nums sm:text-7xl">{fmtClock(left)}</p>
        <p className="text-muted mt-2 text-sm">Completed focus sessions: {completed}</p>
      </div>
      <div className="flex justify-center gap-2">
        {!running ? (
          <button type="button" className="btn btn-primary" onClick={() => (setEndAt(Date.now() + (remaining ?? phaseMs(phase))), report(), "Notification" in window && Notification.permission === "default" && void Notification.requestPermission())}>
            <Play className="h-4 w-4" aria-hidden /> Start
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => (setRemaining(left), setEndAt(null))}>
            <Pause className="h-4 w-4" aria-hidden /> Pause
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => (setEndAt(null), setRemaining(null))}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => nextPhase.current()}>Skip</button>
      </div>
      <details className="bg-surface-2 rounded-xl px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">Settings (minutes)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["work", "short", "long", "every"] as const).map((k) => (
            <Field key={k} label={{ work: "Focus", short: "Short break", long: "Long break", every: "Long break every" }[k]} htmlFor={`pm-${k}`}>
              <NumberInput id={`pm-${k}`} value={cfg[k]} onChange={(v) => setCfg((p) => ({ ...p, [k]: v }))} min={1} max={180} step={1} />
            </Field>
          ))}
        </div>
      </details>
    </div>
  );
}

// ---------- Timestamps ----------

const DateToTimestamp = () => (
  <FormCalculator
    fields={[
      { name: "dt", label: "Date and time", type: "datetime-local", default: "2026-01-01T00:00" },
      { name: "tz", label: "Interpret as", type: "select", default: "local", options: [{ value: "local", label: "My local time zone" }, { value: "utc", label: "UTC" }] },
    ]}
    compute={({ s }) => {
      const raw = s("dt");
      if (!raw) throw new Error("Choose a date and time.");
      const d = s("tz") === "utc" ? new Date(raw.length === 16 ? `${raw}:00Z` : `${raw}Z`) : new Date(raw);
      if (Number.isNaN(d.getTime())) throw new Error("That date is not valid.");
      return {
        stats: [
          { label: "Unix timestamp (seconds)", value: String(Math.floor(d.getTime() / 1000)), primary: true },
          { label: "Milliseconds", value: String(d.getTime()) },
          { label: "ISO 8601 (UTC)", value: d.toISOString() },
        ],
      };
    }}
    statColumns={3}
  />
);

function TimestampToDate() {
  const [ts, setTs] = useState("1767225600");
  const [zone, setZone] = useState("UTC");
  const report = useReportUse();
  const zones = useMemo(() => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [...new Set(["UTC", local, "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Asia/Kolkata", "Australia/Sydney"])];
  }, []);
  const res = useMemo(() => {
    try {
      return { ...D.parseTimestamp(ts), e: null as string | null };
    } catch (e) {
      return { date: null, unit: null, e: (e as Error).message };
    }
  }, [ts]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Unix timestamp" htmlFor="t2d" className="min-w-56 flex-1">
          <input id="t2d" className="field font-mono" inputMode="numeric" value={ts} onChange={(e) => (setTs(e.target.value), report())} />
        </Field>
        <Field label="Show in time zone" htmlFor="t2z" className="w-60">
          <Select id="t2z" value={zone} onChange={setZone} options={zones.map((z) => ({ value: z, label: z }))} />
        </Field>
      </div>
      {res.e && <ErrorBox message={res.e} />}
      {res.date && (
        <KeyValueList
          items={[
            { k: "Detected unit", v: res.unit },
            { k: `Date in ${zone}`, v: res.date.toLocaleString("en-US", { timeZone: zone, dateStyle: "full", timeStyle: "long" }) },
            { k: "ISO 8601 (UTC)", v: res.date.toISOString(), copy: res.date.toISOString() },
            { k: "Day of year", v: String(Math.floor((res.date.getTime() - Date.UTC(res.date.getUTCFullYear(), 0, 1)) / 86400000) + 1) + " (UTC)" },
            { k: "Relative", v: D.relativeTime(res.date) },
          ]}
        />
      )}
    </div>
  );
}

const tools: Record<string, ComponentType> = {
  "what-is-my-ip": WhatIsMyIp,
  "ipv6-support-checker": Ipv6Checker,
  "password-entropy-calculator": PasswordEntropy,
  "css-unit-converter": CssUnitConverter,
  "px-to-rem-converter": () => <PxRem direction="px2rem" />,
  "rem-to-px-converter": () => <PxRem direction="rem2px" />,
  "rgb-to-hex-converter": RgbToHex,
  "hex-to-hsl-converter": HexToHsl,
  "binary-to-text": BinaryToText,
  "text-to-hex": TextToHex,
  "hex-to-text": HexToText,
  "octal-converter": () => <NumberBaseConverter highlight="octal" />,
  "binary-calculator": BinaryCalculator,
  "number-base-converter": () => <NumberBaseConverter />,
  "roman-numeral-converter": RomanConverter,
  "countdown-timer": CountdownTimer,
  stopwatch: Stopwatch,
  "pomodoro-timer": PomodoroTimer,
  "date-to-timestamp-converter": DateToTimestamp,
  "timestamp-to-date-converter": TimestampToDate,
};

export default tools;
