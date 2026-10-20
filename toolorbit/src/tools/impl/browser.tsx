"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { parseUserAgent } from "../logic/useragent";
import { CopyButton, ErrorBox, KeyValueList, Notice, Panel, StatGrid, useReportUse } from "../ui/kit";

type Row = { k: string; v: ReactNode; copy?: string };

/** Runs a probe after mount (browser APIs are not available during server rendering). */
function useProbe<T>(probe: () => T | Promise<T>, deps: unknown[] = []): T | null {
  const [v, setV] = useState<T | null>(null);
  const report = useReportUse();
  useEffect(() => {
    let alive = true;
    void Promise.resolve(probe()).then((r) => {
      if (alive) {
        setV(r);
        report();
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

const yes = (b: boolean | undefined | null) => (b ? "✓ Yes" : "✗ No");

function useResize() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    window.addEventListener("resize", f);
    window.visualViewport?.addEventListener("resize", f);
    return () => {
      window.removeEventListener("resize", f);
      window.visualViewport?.removeEventListener("resize", f);
    };
  }, []);
}

interface UAData {
  brands?: { brand: string; version: string }[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (h: string[]) => Promise<Record<string, unknown>>;
}

function BrowserInformation() {
  const info = useProbe(async () => {
    const ua = navigator.userAgent;
    const p = parseUserAgent(ua);
    const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
    let platformVersion = "";
    if (uaData?.getHighEntropyValues) {
      try {
        const h = await uaData.getHighEntropyValues(["platformVersion", "fullVersionList"]);
        platformVersion = String(h.platformVersion ?? "");
      } catch {
        /* not permitted */
      }
    }
    return { p, ua, uaData, platformVersion };
  });
  useResize();
  if (!info) return <Notice>Reading browser information…</Notice>;
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number; saveData?: boolean } };
  const rows: Row[] = [
    { k: "Browser", v: `${info.p.browser} ${info.p.browserVersion}` },
    { k: "Rendering engine", v: info.p.engine },
    { k: "Operating system", v: `${info.p.os} ${info.platformVersion || info.p.osVersion}`.trim() },
    { k: "Device type", v: info.p.device },
    { k: "Screen", v: `${screen.width} × ${screen.height} px` },
    { k: "Viewport", v: `${window.innerWidth} × ${window.innerHeight} px` },
    { k: "Device pixel ratio", v: String(window.devicePixelRatio) },
    { k: "Languages", v: navigator.languages?.join(", ") || navigator.language },
    { k: "Time zone", v: Intl.DateTimeFormat().resolvedOptions().timeZone },
    { k: "CPU threads", v: String(navigator.hardwareConcurrency ?? "Unknown") },
    { k: "Device memory", v: n.deviceMemory ? `≥ ${n.deviceMemory} GB (rounded by browser)` : "Not exposed" },
    { k: "Network (estimate)", v: n.connection?.effectiveType ? `${n.connection.effectiveType}, ~${n.connection.downlink} Mbps${n.connection.saveData ? ", data saver on" : ""}` : "Not exposed" },
    { k: "Cookies enabled", v: yes(navigator.cookieEnabled) },
    { k: "Do Not Track", v: navigator.doNotTrack === "1" ? "On" : "Off / not set" },
    { k: "Global Privacy Control", v: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl ? "On" : "Off / not supported" },
    { k: "Touch points", v: String(navigator.maxTouchPoints) },
    { k: "Color scheme", v: matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light" },
    { k: "Reduced motion", v: matchMedia("(prefers-reduced-motion: reduce)").matches ? "Requested" : "No preference" },
    { k: "Online", v: yes(navigator.onLine) },
    { k: "User agent", v: info.ua, copy: info.ua },
  ];
  return (
    <div className="space-y-4">
      <StatGrid
        columns={4}
        stats={[
          { label: "Browser", value: `${info.p.browser} ${info.p.browserVersion.split(".")[0]}`, primary: true },
          { label: "OS", value: info.p.os },
          { label: "Screen", value: `${screen.width}×${screen.height}` },
          { label: "Language", value: navigator.language },
        ]}
      />
      <KeyValueList items={rows} />
      <CopyButton text={rows.map((r) => `${r.k}: ${typeof r.v === "string" ? r.v : r.copy ?? ""}`).join("\n")} label="Copy report" />
    </div>
  );
}

function UserAgentChecker() {
  const [ua, setUa] = useState("");
  const report = useReportUse();
  useEffect(() => setUa(navigator.userAgent), []);
  const p = useMemo(() => (ua ? parseUserAgent(ua) : null), [ua]);
  return (
    <div className="space-y-4">
      <label className="label" htmlFor="ua">User agent string (yours is pre-filled — paste any other to analyse it)</label>
      <textarea id="ua" className="field" rows={3} value={ua} onChange={(e) => (setUa(e.target.value), report())} />
      <div className="flex gap-2">
        <CopyButton text={ua} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUa(navigator.userAgent)}>Reset to mine</button>
      </div>
      {p && (
        <KeyValueList
          items={[
            { k: "Browser", v: `${p.browser} ${p.browserVersion}` },
            { k: "Engine", v: p.engine },
            { k: "Operating system", v: `${p.os} ${p.osVersion}` },
            { k: "Device type", v: p.device },
          ]}
        />
      )}
      <Notice>Browsers increasingly freeze or reduce the user agent (for example Chrome reports Windows 10 for Windows 11). Treat parsed versions as approximate.</Notice>
    </div>
  );
}

function ScreenResolution() {
  useResize();
  const ok = useProbe(() => true);
  if (!ok) return <Notice>Measuring…</Notice>;
  const dpr = window.devicePixelRatio;
  const s = screen as Screen & { orientation?: { type: string } };
  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl py-8 text-center">
        <p className="text-muted text-sm">Your screen resolution</p>
        <p className="text-5xl font-bold tabular-nums">{screen.width} × {screen.height}</p>
        <p className="text-muted mt-1 text-sm">CSS pixels</p>
      </div>
      <KeyValueList
        items={[
          { k: "Physical pixels (approx.)", v: `${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)}` },
          { k: "Available (minus taskbar/dock)", v: `${screen.availWidth} × ${screen.availHeight}` },
          { k: "Device pixel ratio", v: String(dpr) },
          { k: "Color depth", v: `${screen.colorDepth}-bit` },
          { k: "Orientation", v: s.orientation?.type ?? "Unknown" },
          { k: "Aspect ratio", v: aspect(screen.width, screen.height) },
        ]}
      />
      <Notice>Browsers report screen size in CSS pixels. Operating-system scaling (e.g. 150% on Windows) means the physical panel resolution is larger — approximated above by multiplying with the pixel ratio.</Notice>
    </div>
  );
}

function aspect(w: number, h: number) {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(w, h);
  return `${w / d}:${h / d}`;
}

function ViewportSize() {
  useResize();
  const ok = useProbe(() => true);
  if (!ok) return <Notice>Measuring…</Notice>;
  const vv = window.visualViewport;
  const w = window.innerWidth;
  const bp = w >= 1536 ? "2xl (≥1536)" : w >= 1280 ? "xl (≥1280)" : w >= 1024 ? "lg (≥1024)" : w >= 768 ? "md (≥768)" : w >= 640 ? "sm (≥640)" : "base (<640)";
  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl py-8 text-center">
        <p className="text-muted text-sm">Viewport size — resize the window to see it update</p>
        <p className="text-5xl font-bold tabular-nums">{w} × {window.innerHeight}</p>
      </div>
      <KeyValueList
        items={[
          { k: "Layout viewport (document)", v: `${document.documentElement.clientWidth} × ${document.documentElement.clientHeight} (excludes scrollbar)` },
          { k: "Visual viewport", v: vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)} at ${vv.scale.toFixed(2)}× zoom` : "Not supported" },
          { k: "Window outer size", v: `${window.outerWidth} × ${window.outerHeight}` },
          { k: "Scrollbar width", v: `${window.innerWidth - document.documentElement.clientWidth}px` },
          { k: "Tailwind breakpoint", v: bp },
        ]}
      />
    </div>
  );
}

function DprChecker() {
  useResize();
  const ok = useProbe(() => true);
  if (!ok) return <Notice>Measuring…</Notice>;
  const dpr = window.devicePixelRatio;
  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl py-8 text-center">
        <p className="text-muted text-sm">Device pixel ratio</p>
        <p className="text-6xl font-bold tabular-nums">{dpr}</p>
        <p className="text-muted mt-1 text-sm">{dpr >= 3 ? "Very high density (3×)" : dpr >= 2 ? "High density / Retina (2×)" : dpr > 1 ? "Scaled display" : "Standard density (1×)"}</p>
      </div>
      <KeyValueList
        items={[
          { k: "1 CSS pixel equals", v: `${dpr} × ${dpr} physical pixels` },
          { k: "Serve images at", v: `${Math.ceil(dpr)}× the displayed CSS size for sharpness` },
          { k: "CSS media query", v: `(min-resolution: ${dpr}dppx)` },
        ]}
      />
      <Notice>Browser zoom changes the reported ratio. Zoom to 100% for the native value.</Notice>
    </div>
  );
}

function LanguageChecker() {
  const d = useProbe(() => ({ langs: [...(navigator.languages ?? [navigator.language])], intl: Intl.DateTimeFormat().resolvedOptions() }));
  if (!d) return <Notice>Reading…</Notice>;
  const sample = new Date(2026, 2, 14, 15, 30);
  return (
    <div className="space-y-4">
      <StatGrid columns={2} stats={[{ label: "Primary language", value: d.langs[0], primary: true }, { label: "Locale used for formatting", value: d.intl.locale }]} />
      <Panel title="Preferred languages (in order)">
        <ol className="list-decimal space-y-1 pl-5 font-mono text-sm">
          {d.langs.map((l) => <li key={l}>{l} — {safeDisplayName(l)}</li>)}
        </ol>
      </Panel>
      <KeyValueList
        items={[
          { k: "Date format", v: sample.toLocaleDateString(d.intl.locale) },
          { k: "Time format", v: sample.toLocaleTimeString(d.intl.locale) },
          { k: "Number format", v: (1234567.891).toLocaleString(d.intl.locale) },
          { k: "Calendar / numbering", v: `${d.intl.calendar} / ${d.intl.numberingSystem}` },
          { k: "Accept-Language (likely)", v: d.langs.map((l, i) => (i ? `${l};q=${Math.max(0.1, 1 - i * 0.1).toFixed(1)}` : l)).join(",") },
        ]}
      />
    </div>
  );
}

function safeDisplayName(tag: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

function TimezoneDetector() {
  const [now, setNow] = useState<Date | null>(null);
  const report = useReportUse();
  useEffect(() => {
    setNow(new Date());
    report();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [report]);
  if (!now) return <Notice>Detecting…</Notice>;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const off = -now.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const offStr = `UTC${sign}${String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")}:${String(Math.abs(off) % 60).padStart(2, "0")}`;
  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
  const observesDst = jan !== jul;
  const inDst = observesDst && now.getTimezoneOffset() === Math.min(jan, jul);
  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl py-8 text-center">
        <p className="text-muted text-sm">Your time zone</p>
        <p className="text-4xl font-bold">{tz}</p>
        <p className="mt-2 font-mono text-xl tabular-nums">{now.toLocaleTimeString("en-US")}</p>
      </div>
      <KeyValueList
        items={[
          { k: "UTC offset", v: offStr },
          { k: "Name", v: now.toLocaleDateString("en-US", { timeZoneName: "long" }).split(", ").pop() ?? "" },
          { k: "Daylight saving", v: observesDst ? (inDst ? "Observed — currently in DST" : "Observed — currently standard time") : "Not observed" },
          { k: "UTC time now", v: now.toISOString().replace("T", " ").slice(0, 19) },
        ]}
      />
      <Notice>This is the time zone your device is set to, not your physical location.</Notice>
    </div>
  );
}

function CookiesTest() {
  const r = useProbe(() => {
    const name = `to_cookie_test_${Math.random().toString(36).slice(2)}`;
    document.cookie = `${name}=1; path=/; SameSite=Lax; max-age=60`;
    const works = document.cookie.includes(`${name}=1`);
    document.cookie = `${name}=; path=/; max-age=0`;
    return { flag: navigator.cookieEnabled, works };
  });
  if (!r) return <Notice>Testing…</Notice>;
  return (
    <div className="space-y-4">
      <StatGrid columns={2} stats={[{ label: "First-party cookies", value: r.works ? "✓ Enabled" : "✗ Blocked", primary: true }, { label: "navigator.cookieEnabled", value: String(r.flag) }]} />
      {r.works ? <Notice tone="success">Your browser accepted and returned a test cookie, which was deleted immediately.</Notice> : <Notice tone="warn">A test cookie could not be stored. Sites that need sign-in or carts will not work until you allow cookies for them.</Notice>}
      <Notice>Third-party cookies cannot be reliably tested from a single site; most browsers now restrict them by default.</Notice>
    </div>
  );
}

function storageTest(kind: "localStorage" | "sessionStorage") {
  try {
    const s = window[kind];
    const k = "__to_test__";
    s.setItem(k, "1");
    const ok = s.getItem(k) === "1";
    s.removeItem(k);
    return ok;
  } catch {
    return false;
  }
}

function LocalStorageTest() {
  const r = useProbe(async () => {
    const est = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted().catch(() => null) : null;
    let used = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        used += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
      }
    } catch {
      /* blocked */
    }
    return { local: storageTest("localStorage"), session: storageTest("sessionStorage"), idb: "indexedDB" in window, est, persisted, used };
  });
  if (!r) return <Notice>Testing…</Notice>;
  const mb = (b?: number) => (b === undefined ? "?" : `${(b / 1024 / 1024).toFixed(1)} MB`);
  return (
    <div className="space-y-4">
      <StatGrid columns={3} stats={[{ label: "localStorage", value: r.local ? "✓ Works" : "✗ Blocked", primary: true }, { label: "sessionStorage", value: r.session ? "✓ Works" : "✗ Blocked" }, { label: "IndexedDB", value: r.idb ? "✓ Available" : "✗ Missing" }]} />
      <KeyValueList
        items={[
          { k: "This site's localStorage use", v: `${(r.used / 1024).toFixed(1)} KB (about 5 MB is allowed per site)` },
          { k: "Storage quota (all APIs)", v: r.est ? `${mb(r.est.usage)} used of ${mb(r.est.quota)}` : "Not exposed" },
          { k: "Persistent storage", v: r.persisted === null ? "Unknown" : r.persisted ? "Granted" : "Not granted (may be evicted under pressure)" },
        ]}
      />
      {!r.local && <Notice tone="warn">localStorage is blocked — common in private windows on some browsers or when site data is disabled.</Notice>}
    </div>
  );
}

function JavaScriptTest() {
  const r = useProbe(() => ({
    modules: "noModule" in document.createElement("script"),
    wasm: typeof WebAssembly === "object",
    workers: typeof Worker !== "undefined",
    sw: "serviceWorker" in navigator,
    bigint: typeof BigInt === "function",
    es2022: (() => {
      try {
        return [1, 2].at(-1) === 2 && typeof structuredClone === "function";
      } catch {
        return false;
      }
    })(),
  }));
  return (
    <div className="space-y-4">
      <noscript>
        <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-center text-xl font-bold text-red-800">✗ JavaScript is disabled in your browser.</div>
      </noscript>
      {r && (
        <>
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center text-xl font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">✓ JavaScript is enabled</div>
          <KeyValueList
            items={[
              { k: "ES modules", v: yes(r.modules) },
              { k: "Modern syntax (ES2022)", v: yes(r.es2022) },
              { k: "BigInt", v: yes(r.bigint) },
              { k: "WebAssembly", v: yes(r.wasm) },
              { k: "Web Workers", v: yes(r.workers) },
              { k: "Service Workers", v: yes(r.sw) },
            ]}
          />
        </>
      )}
    </div>
  );
}

function WebGLInfo() {
  const probe = useProbe(() => {
    const c = document.createElement("canvas");
    const gl2 = c.getContext("webgl2") as WebGL2RenderingContext | null;
    const gl = (gl2 ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { r: null };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const out = {
      version: gl.getParameter(gl.VERSION) as string,
      glsl: gl.getParameter(gl.SHADING_LANGUAGE_VERSION) as string,
      vendor: dbg ? (gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string) : (gl.getParameter(gl.VENDOR) as string),
      renderer: dbg ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string) : (gl.getParameter(gl.RENDERER) as string),
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      maxViewport: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array).join(" × "),
      extensions: gl.getSupportedExtensions() ?? [],
      webgl2: !!gl2,
    };
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { r: out };
  });
  if (!probe) return <Notice>Checking…</Notice>;
  const r = probe.r;
  if (r === null) return <ErrorBox message="WebGL is not available. It may be disabled, blocked by a privacy setting, or unsupported by your GPU driver." />;
  return (
    <div className="space-y-4">
      <StatGrid columns={2} stats={[{ label: "WebGL 2", value: yes(r.webgl2), primary: true }, { label: "GPU renderer", value: r.renderer }]} />
      <KeyValueList
        items={[
          { k: "Version", v: r.version },
          { k: "Shading language", v: r.glsl },
          { k: "Vendor", v: r.vendor },
          { k: "Max texture size", v: `${r.maxTexture} px` },
          { k: "Max viewport", v: r.maxViewport },
        ]}
      />
      <Panel title={`${r.extensions.length} extensions`}>
        <p className="font-mono text-xs leading-relaxed break-all">{r.extensions.join(" · ")}</p>
      </Panel>
    </div>
  );
}

function WebGpuChecker() {
  const r = useProbe(async () => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!gpu) return { api: false as const };
    try {
      const adapter = (await gpu.requestAdapter()) as null | { info?: Record<string, string>; features: Set<string>; limits: Record<string, number> };
      if (!adapter) return { api: true as const, adapter: null };
      return {
        api: true as const,
        adapter: {
          vendor: adapter.info?.vendor || "Hidden",
          architecture: adapter.info?.architecture || "Hidden",
          description: adapter.info?.description || "",
          features: [...adapter.features],
          maxBuffer: adapter.limits.maxBufferSize,
          maxTexture: adapter.limits.maxTextureDimension2D,
        },
      };
    } catch (e) {
      return { api: true as const, adapter: null, error: (e as Error).message };
    }
  });
  if (!r) return <Notice>Checking…</Notice>;
  if (!r.api) return <ErrorBox message="WebGPU is not supported by this browser. It is available in recent Chrome/Edge on desktop and Android, Safari 26+, and Firefox 141+ on Windows; other platforms may need a flag." />;
  if (!r.adapter) return <Notice tone="warn">The WebGPU API exists but no GPU adapter is available (blocked GPU, software rendering, or a driver blocklist).</Notice>;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center text-xl font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">✓ WebGPU is supported</div>
      <KeyValueList
        items={[
          { k: "Vendor", v: r.adapter.vendor },
          { k: "Architecture", v: r.adapter.architecture },
          ...(r.adapter.description ? [{ k: "Description", v: r.adapter.description }] : []),
          { k: "Max 2D texture", v: `${r.adapter.maxTexture} px` },
          { k: "Max buffer size", v: `${(r.adapter.maxBuffer / 1024 / 1024).toFixed(0)} MB` },
          { k: "Features", v: r.adapter.features.join(", ") || "None" },
        ]}
      />
    </div>
  );
}

function ClipboardTest() {
  const [text, setText] = useState("Hello from the clipboard test ✓");
  const [read, setRead] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [support, setSupport] = useState<{ write: boolean; read: boolean; secure: boolean } | null>(null);
  const report = useReportUse();
  useEffect(() => setSupport({ write: !!navigator.clipboard?.writeText, read: !!navigator.clipboard?.readText, secure: window.isSecureContext }), []);
  return (
    <div className="space-y-4">
      {support && <StatGrid columns={3} stats={[{ label: "Write API", value: yes(support.write) }, { label: "Read API", value: yes(support.read) }, { label: "Secure context (HTTPS)", value: yes(support.secure) }]} />}
      <label className="label" htmlFor="cbt">Text to copy</label>
      <input id="cbt" className="field" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus({ ok: true, msg: "Copied. Paste somewhere (Ctrl/Cmd+V) to confirm." });
            report();
          } catch (e) {
            setStatus({ ok: false, msg: `Write failed: ${(e as Error).message}` });
          }
        }}>Test copy</button>
        <button type="button" className="btn btn-secondary" onClick={async () => {
          try {
            setRead(await navigator.clipboard.readText());
            setStatus({ ok: true, msg: "Read access works." });
          } catch (e) {
            setStatus({ ok: false, msg: `Read failed or was denied: ${(e as Error).message}` });
          }
        }}>Test paste (read)</button>
      </div>
      {status && (status.ok ? <Notice tone="success">{status.msg}</Notice> : <ErrorBox message={status.msg} />)}
      {read !== null && <Panel title="Clipboard contents"><p className="font-mono text-sm break-all whitespace-pre-wrap">{read || "(empty)"}</p></Panel>}
      <label className="label" htmlFor="cbp">Or paste here to test regular paste</label>
      <textarea id="cbp" className="field" rows={3} placeholder="Ctrl/Cmd + V" />
      <Notice>Reading the clipboard requires your permission and is not supported for text in all browsers (Firefox exposes it only to extensions). Nothing you paste leaves this page.</Notice>
    </div>
  );
}

const KEY_ROWS = [
  ["Escape", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"],
  ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
  ["Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"],
  ["CapsLock", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
  ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"],
  ["ControlLeft", "MetaLeft", "AltLeft", "Space", "AltRight", "MetaRight", "ContextMenu", "ControlRight", "ArrowLeft", "ArrowUp", "ArrowDown", "ArrowRight"],
];
const WIDE: Record<string, string> = { Backspace: "w-20", Tab: "w-16", CapsLock: "w-20", Enter: "w-20", ShiftLeft: "w-24", ShiftRight: "w-24", Space: "w-64" };
const label = (code: string) =>
  code.replace(/^Key|^Digit/, "").replace("Left", " L").replace("Right", " R").replace("Backquote", "`").replace("Minus", "-").replace("Equal", "=").replace("BracketL", "[").replace("BracketR", "]").replace("Backslash", "\\").replace("Semicolon", ";").replace("Quote", "'").replace("Comma", ",").replace("Period", ".").replace("Slash", "/").replace("Arrow", "").replace("Control", "Ctrl").replace("Meta", "⌘/Win").replace("ContextMenu", "Menu").replace("Escape", "Esc");

function KeyboardTester() {
  const [down, setDown] = useState<Set<string>>(new Set());
  const [tested, setTested] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<KeyboardEvent | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const report = useReportUse();
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (["Space", "ArrowUp", "ArrowDown", "Tab", "Backspace", "Quote", "Slash", "F5"].includes(e.code)) e.preventDefault();
      setDown((s) => new Set(s).add(e.code));
      setTested((s) => new Set(s).add(e.code));
      setLast(e);
      setLog((l) => [`${e.code} (key: "${e.key}")${e.repeat ? " repeat" : ""}`, ...l].slice(0, 12));
      report();
    };
    const ku = (e: KeyboardEvent) => setDown((s) => {
      const n = new Set(s);
      n.delete(e.code);
      return n;
    });
    const blur = () => setDown(new Set());
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
    };
  }, [report]);
  return (
    <div className="space-y-4">
      <Notice>Press keys on your keyboard. Keys turn green once they have registered. Some combinations (e.g. Ctrl+W, Alt+Tab, the Fn key) are captured by the OS or browser and cannot be detected by any website.</Notice>
      <div className="surface overflow-x-auto rounded-2xl p-3">
        <div className="inline-flex min-w-max flex-col gap-1.5">
          {KEY_ROWS.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              {row.map((code) => (
                <span key={code} className={`flex h-10 ${WIDE[code] ?? "w-10"} items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${down.has(code) ? "border-brand-600 bg-brand-600 text-white" : tested.has(code) ? "border-emerald-400 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100" : "border-base bg-surface-2"}`}>
                  {label(code)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <StatGrid columns={4} stats={[{ label: "Last key", value: last?.key === " " ? "Space" : (last?.key ?? "—"), primary: true }, { label: "Code", value: last?.code ?? "—" }, { label: "Keys pressed now", value: down.size, hint: "Tests key rollover / ghosting" }, { label: "Unique keys tested", value: tested.size }]} />
      {log.length > 0 && <Panel title="Event log" actions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => (setTested(new Set()), setLog([]))}>Reset</button>}><ul className="font-mono text-xs">{log.map((l, i) => <li key={i}>{l}</li>)}</ul></Panel>}
    </div>
  );
}

function MouseTester() {
  const [counts, setCounts] = useState({ left: 0, middle: 0, right: 0, back: 0, forward: 0, dbl: 0, wheelUp: 0, wheelDown: 0 });
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const [lastClickGap, setLastClickGap] = useState<number | null>(null);
  const [dblIssue, setDblIssue] = useState(0);
  const lastLeft = useRef(0);
  const report = useReportUse();
  const names = ["left", "middle", "right", "back", "forward"] as const;
  return (
    <div className="space-y-4">
      <div
        className="surface flex h-64 cursor-crosshair items-center justify-center rounded-2xl select-none"
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={(e) => {
          e.preventDefault();
          report();
          setPressed((p) => new Set(p).add(e.button));
          const k = names[e.button];
          if (k) setCounts((c) => ({ ...c, [k]: c[k] + 1 }));
          if (e.button === 0) {
            const now = performance.now();
            const gap = now - lastLeft.current;
            if (lastLeft.current && gap < 80) setDblIssue((d) => d + 1);
            setLastClickGap(lastLeft.current ? gap : null);
            lastLeft.current = now;
          }
        }}
        onMouseUp={(e) => setPressed((p) => {
          const n = new Set(p);
          n.delete(e.button);
          return n;
        })}
        onDoubleClick={() => setCounts((c) => ({ ...c, dbl: c.dbl + 1 }))}
        onWheel={(e) => setCounts((c) => (e.deltaY < 0 ? { ...c, wheelUp: c.wheelUp + 1 } : { ...c, wheelDown: c.wheelDown + 1 }))}
        onAuxClick={(e) => e.preventDefault()}
      >
        <div className="flex gap-3">
          {names.map((n, i) => (
            <span key={n} className={`rounded-xl border px-3 py-6 text-xs font-semibold capitalize ${pressed.has(i) ? "border-brand-600 bg-brand-600 text-white" : "border-base"}`}>{n}</span>
          ))}
        </div>
      </div>
      <StatGrid
        columns={4}
        stats={[
          { label: "Left clicks", value: counts.left, primary: true },
          { label: "Right clicks", value: counts.right },
          { label: "Middle clicks", value: counts.middle },
          { label: "Double clicks", value: counts.dbl },
          { label: "Back / forward", value: `${counts.back} / ${counts.forward}` },
          { label: "Wheel up / down", value: `${counts.wheelUp} / ${counts.wheelDown}` },
          { label: "Last click gap", value: lastClickGap === null ? "—" : `${lastClickGap.toFixed(0)} ms` },
          { label: "Suspected double-click faults", value: dblIssue, hint: "Two left clicks < 80 ms apart" },
        ]}
      />
      {dblIssue > 0 && <Notice tone="warn">Two left-button presses arrived less than 80 ms apart without you meaning to double-click? That pattern usually points to a worn switch (“double-click bug”).</Notice>}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => (setCounts({ left: 0, middle: 0, right: 0, back: 0, forward: 0, dbl: 0, wheelUp: 0, wheelDown: 0 }), setDblIssue(0), setLastClickGap(null), (lastLeft.current = 0))}>Reset</button>
    </div>
  );
}

const tools: Record<string, ComponentType> = {
  "browser-information": BrowserInformation,
  "user-agent-checker": UserAgentChecker,
  "screen-resolution-checker": ScreenResolution,
  "viewport-size-checker": ViewportSize,
  "device-pixel-ratio-checker": DprChecker,
  "browser-language-checker": LanguageChecker,
  "timezone-detector": TimezoneDetector,
  "cookies-enabled-test": CookiesTest,
  "local-storage-test": LocalStorageTest,
  "javascript-enabled-test": JavaScriptTest,
  "webgl-information": WebGLInfo,
  "webgpu-support-checker": WebGpuChecker,
  "clipboard-test": ClipboardTest,
  "keyboard-tester": KeyboardTester,
  "mouse-click-tester": MouseTester,
};

export default tools;
