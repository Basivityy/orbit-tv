"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import * as G from "../logic/generators";
import * as C from "../logic/color";
import {
  Checkbox, CopyButton, DownloadButton, ErrorBox, Field, FileDrop, KeyValueList, Notice, NumberInput, Panel, Range, Segmented, Select,
  downloadBlob, downloadText, useReportUse,
} from "../ui/kit";

// ---------- QR codes ----------

type Ecc = "L" | "M" | "Q" | "H";

function QrPreview({ payload, filename }: { payload: string; filename: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(320);
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [ecc, setEcc] = useState<Ecc>("M");
  const [margin, setMargin] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!payload || !canvasRef.current) return;
      try {
        const QR = await import("qrcode");
        await QR.toCanvas(canvasRef.current, payload, { width: size, margin, errorCorrectionLevel: ecc, color: { dark: fg, light: bg } });
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(/too big|amount of data/i.test((e as Error).message) ? "Too much data for a QR code. Shorten the content or lower the error correction level." : (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, size, fg, bg, ecc, margin]);

  const contrast = C.contrastRatio(C.parseHex(fg), C.parseHex(bg));

  const downloadSvg = async () => {
    const QR = await import("qrcode");
    const svg = await QR.toString(payload, { type: "svg", margin, errorCorrectionLevel: ecc, color: { dark: fg, light: bg } });
    downloadText(svg, `${filename}.svg`, "image/svg+xml");
    report();
  };
  const downloadPng = () => {
    canvasRef.current?.toBlob((b) => b && downloadBlob(b, `${filename}.png`), "image/png");
    report();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
      <div className="order-2 space-y-4 lg:order-1">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Foreground" htmlFor="qfg"><input id="qfg" type="color" className="border-base h-10 w-full rounded-lg border" value={fg} onChange={(e) => setFg(e.target.value)} /></Field>
          <Field label="Background" htmlFor="qbg"><input id="qbg" type="color" className="border-base h-10 w-full rounded-lg border" value={bg} onChange={(e) => setBg(e.target.value)} /></Field>
          <Field label="Error correction" htmlFor="qecc">
            <Select id="qecc" value={ecc} onChange={setEcc} options={[{ value: "L", label: "Low (7%)" }, { value: "M", label: "Medium (15%)" }, { value: "Q", label: "Quartile (25%)" }, { value: "H", label: "High (30%)" }]} />
          </Field>
          <Field label="Quiet zone" htmlFor="qm"><NumberInput id="qm" value={String(margin)} onChange={(v) => setMargin(Math.max(0, Math.min(10, Number(v) || 0)))} min={0} max={10} step={1} /></Field>
        </div>
        <Range label="Size" value={size} min={128} max={1024} step={32} onChange={setSize} display={`${size}px`} />
        {contrast < 3 && <Notice tone="warn">Low contrast ({contrast}:1). Many scanners need dark modules on a light background with strong contrast.</Notice>}
      </div>
      <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
        <div className="surface flex items-center justify-center rounded-2xl p-3">
          <canvas ref={canvasRef} className="h-auto max-w-[280px]" style={{ width: Math.min(size, 280) }} aria-label="QR code preview" role="img" />
        </div>
        {error ? <ErrorBox message={error} /> : (
          <div className="flex gap-2">
            <DownloadButton label="PNG" onClick={downloadPng} disabled={!payload} />
            <DownloadButton label="SVG" primary={false} onClick={() => void downloadSvg()} disabled={!payload} />
          </div>
        )}
      </div>
    </div>
  );
}

function QrGenerator() {
  const [text, setText] = useState("https://example.com");
  return (
    <div className="space-y-5">
      <Field label="URL or text" htmlFor="qrt" hint={`${new TextEncoder().encode(text).length} bytes · QR codes hold up to ~2,900 bytes`}>
        <textarea id="qrt" className="field !font-sans" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      {text.trim() ? <QrPreview payload={text} filename="qr-code" /> : <Notice>Enter a URL or some text to generate a QR code.</Notice>}
    </div>
  );
}

function usePayload(build: () => string) {
  return useMemo(() => {
    try {
      return { payload: build(), error: null as string | null };
    } catch (e) {
      return { payload: "", error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build]);
}

function WifiQr() {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [hidden, setHidden] = useState(false);
  const { payload, error } = usePayload(useMemo(() => () => G.wifiPayload({ ssid, password, security, hidden }), [ssid, password, security, hidden]));
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Network name (SSID)" htmlFor="wf-s"><input id="wf-s" className="field" value={ssid} onChange={(e) => setSsid(e.target.value)} autoComplete="off" /></Field>
        <Field label="Security" htmlFor="wf-sec"><Select id="wf-sec" value={security} onChange={setSecurity} options={[{ value: "WPA", label: "WPA/WPA2/WPA3" }, { value: "WEP", label: "WEP (legacy)" }, { value: "nopass", label: "No password (open)" }]} /></Field>
        {security !== "nopass" && <Field label="Password" htmlFor="wf-p"><input id="wf-p" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" /></Field>}
        <div className="flex items-end pb-2"><Checkbox checked={hidden} onChange={setHidden} label="Hidden network" /></div>
      </div>
      {ssid && error && <ErrorBox message={error} />}
      {payload ? <QrPreview payload={payload} filename={`wifi-${ssid.replace(/\W+/g, "-") || "network"}`} /> : <Notice>Enter your network details. Nothing is sent to a server — the code is generated on your device.</Notice>}
    </div>
  );
}

function EmailQr() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const { payload, error } = usePayload(useMemo(() => () => G.emailPayload({ to, subject, body }), [to, subject, body]));
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email address" htmlFor="eq-to"><input id="eq-to" type="email" className="field" value={to} onChange={(e) => setTo(e.target.value)} placeholder="hello@example.com" /></Field>
        <Field label="Subject (optional)" htmlFor="eq-s"><input id="eq-s" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      </div>
      <Field label="Message (optional)" htmlFor="eq-b"><textarea id="eq-b" className="field !font-sans" rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      {to && error && <ErrorBox message={error} />}
      {payload ? <QrPreview payload={payload} filename="email-qr" /> : <Notice>Enter an email address to create the code.</Notice>}
    </div>
  );
}

function PhoneQr() {
  const [phone, setPhone] = useState("");
  const { payload, error } = usePayload(useMemo(() => () => G.phonePayload(phone), [phone]));
  return (
    <div className="space-y-5">
      <Field label="Phone number" htmlFor="pq" hint="Use international format, e.g. +1 555 123 4567"><input id="pq" type="tel" className="field max-w-sm" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" /></Field>
      {phone && error && <ErrorBox message={error} />}
      {payload ? <QrPreview payload={payload} filename="phone-qr" /> : <Notice>Enter a phone number to create the code.</Notice>}
    </div>
  );
}

function SmsQr() {
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const { payload, error } = usePayload(useMemo(() => () => G.smsPayload(phone, msg), [phone, msg]));
  return (
    <div className="space-y-5">
      <Field label="Phone number" htmlFor="sq-p"><input id="sq-p" type="tel" className="field max-w-sm" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" /></Field>
      <Field label="Pre-filled message (optional)" htmlFor="sq-m" hint={`${msg.length} characters`}><textarea id="sq-m" className="field !font-sans" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
      {phone && error && <ErrorBox message={error} />}
      {payload ? <QrPreview payload={payload} filename="sms-qr" /> : <Notice>Enter a phone number to create the code.</Notice>}
    </div>
  );
}

function VCardQr() {
  const [v, setV] = useState<G.VCardInput>({ firstName: "", lastName: "", organization: "", title: "", phone: "", mobile: "", email: "", website: "", street: "", city: "", region: "", postcode: "", country: "" });
  const { payload, error } = usePayload(useMemo(() => () => G.vcardPayload(v), [v]));
  const f = (k: keyof G.VCardInput, label: string, type = "text") => (
    <Field key={k} label={label} htmlFor={`vc-${k}`}><input id={`vc-${k}`} type={type} className="field" value={v[k] ?? ""} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} /></Field>
  );
  const touched = Object.values(v).some(Boolean);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {f("firstName", "First name")}{f("lastName", "Last name")}{f("organization", "Company")}{f("title", "Job title")}
        {f("phone", "Work phone", "tel")}{f("mobile", "Mobile", "tel")}{f("email", "Email", "email")}{f("website", "Website", "url")}
        {f("street", "Street")}{f("city", "City")}{f("region", "State / region")}{f("postcode", "ZIP / postal code")}{f("country", "Country")}
      </div>
      {touched && error && <ErrorBox message={error} />}
      {payload && (
        <>
          <QrPreview payload={payload} filename="contact-qr" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadText(payload, "contact.vcf", "text/vcard")}>Download .vcf file</button>
        </>
      )}
    </div>
  );
}

function QrReader() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const report = useReportUse();

  const decodeImageData = async (data: ImageData) => {
    const jsQR = (await import("jsqr")).default;
    return jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  };

  const readFile = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      const text = await decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (!text) throw new Error("No QR code found. Try a sharper, well-lit image where the code fills more of the frame.");
      setResult(text);
      report();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const startCamera = async () => {
    setError(null);
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not available in this browser or requires HTTPS.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const tick = async () => {
        if (!streamRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const text = await decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
          if (text) {
            setResult(text);
            report();
            stop();
            return;
          }
        }
        requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch (e) {
      setError((e as Error).name === "NotAllowedError" ? "Camera permission was denied. You can still upload a photo of the code." : (e as Error).message);
      stop();
    }
  };

  useEffect(() => stop, []);
  const isUrl = result && /^https?:\/\//i.test(result);

  return (
    <div className="space-y-4">
      <FileDrop accept="image/*" maxSizeMB={20} onFiles={([f]) => void readFile(f)} label="Upload an image of a QR code" />
      <div className="flex items-center gap-3">
        <span className="text-muted text-sm">or</span>
        {!scanning ? (
          <button type="button" className="btn btn-secondary" onClick={() => void startCamera()}>Scan with camera</button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={stop}>Stop camera</button>
        )}
      </div>
      <video ref={videoRef} className={`w-full max-w-md rounded-2xl ${scanning ? "" : "hidden"}`} playsInline muted />
      {error && <ErrorBox message={error} />}
      {result && (
        <Panel title="Decoded content" actions={<CopyButton text={result} />}>
          <p className="font-mono text-sm break-all">{result}</p>
          {isUrl && (
            <p className="mt-3 text-sm">
              <a href={result} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-600 underline">Open link</a>{" "}
              <span className="text-muted">— check the address carefully before visiting; QR codes can point to phishing sites.</span>
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}

// ---------- Barcode ----------

const BARCODE_FORMATS = [
  { value: "CODE128", label: "Code 128 (any text)", sample: "TOOLORBIT-128" },
  { value: "EAN13", label: "EAN-13 (12–13 digits)", sample: "590123412345" },
  { value: "UPC", label: "UPC-A (11–12 digits)", sample: "03600029145" },
  { value: "EAN8", label: "EAN-8 (7–8 digits)", sample: "9638507" },
  { value: "CODE39", label: "Code 39 (A–Z, 0–9)", sample: "CODE39 TEST" },
  { value: "ITF14", label: "ITF-14 (13–14 digits)", sample: "1540014128876" },
  { value: "codabar", label: "Codabar", sample: "A40156B" },
  { value: "MSI", label: "MSI", sample: "1234567" },
] as const;

function BarcodeGenerator() {
  const [format, setFormat] = useState<string>("CODE128");
  const [value, setValue] = useState("TOOLORBIT-128");
  const [showText, setShowText] = useState(true);
  const [height, setHeight] = useState(100);
  const [width, setWidth] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const report = useReportUse();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const JsBarcode = (await import("jsbarcode")).default;
      if (cancelled || !svgRef.current) return;
      try {
        let valid = true;
        JsBarcode(svgRef.current, value, { format, displayValue: showText, height, width, margin: 10, valid: (v: boolean) => (valid = v) });
        setError(valid ? null : `“${value}” is not valid for ${format}. Check the length and allowed characters (the check digit is computed automatically).`);
      } catch (e) {
        setError((e as Error).message || "Invalid input for this barcode format.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [format, value, showText, height, width]);
  const svgString = () => new XMLSerializer().serializeToString(svgRef.current!);
  const downloadPng = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width * 2;
      c.height = img.height * 2;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b && downloadBlob(b, "barcode.png"), "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString());
    report();
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Format" htmlFor="bc-f">
          <Select id="bc-f" value={format} onChange={(f) => (setFormat(f), setValue(BARCODE_FORMATS.find((x) => x.value === f)!.sample))} options={BARCODE_FORMATS.map(({ value, label }) => ({ value, label }))} />
        </Field>
        <Field label="Value" htmlFor="bc-v"><input id="bc-v" className="field font-mono" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Range label="Bar height" value={height} min={30} max={200} onChange={setHeight} display={`${height}px`} />
        <Range label="Bar width" value={width} min={1} max={4} onChange={setWidth} />
        <div className="flex items-end"><Checkbox checked={showText} onChange={setShowText} label="Show human-readable text" /></div>
      </div>
      {error && <ErrorBox message={error} />}
      <div className={`flex justify-center overflow-x-auto rounded-2xl bg-white p-4 ${error ? "opacity-30" : ""}`}>
        <svg ref={svgRef} role="img" aria-label="Barcode preview" />
      </div>
      <div className="flex gap-2">
        <DownloadButton label="PNG" onClick={downloadPng} disabled={!!error} />
        <DownloadButton label="SVG" primary={false} onClick={() => downloadText(svgString(), "barcode.svg", "image/svg+xml")} disabled={!!error} />
      </div>
    </div>
  );
}

// ---------- Passwords & randomness ----------

function PasswordGenerator() {
  const [o, setO] = useState<G.PasswordOptions>({ length: 20, lower: true, upper: true, digits: true, symbols: true, excludeSimilar: false, excludeAmbiguous: false });
  const [count, setCount] = useState(1);
  const [list, setList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const gen = () => {
    try {
      setList(Array.from({ length: count }, () => G.generatePassword(o)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setList([]);
    }
  };
  useEffect(gen, [o, count]); // eslint-disable-line react-hooks/exhaustive-deps
  const bits = G.passwordPoolBits(o);
  return (
    <div className="space-y-4">
      <div className="surface flex items-center gap-2 rounded-2xl p-4">
        <code className="min-w-0 flex-1 font-mono text-lg break-all sm:text-xl" aria-live="polite">{list[0] ?? "—"}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => (gen(), report())} aria-label="Generate new password"><RefreshCw className="h-4 w-4" aria-hidden /></button>
        <CopyButton text={list[0] ?? ""} />
      </div>
      <p className="text-muted text-sm">Strength: <strong className="text-[var(--text)]">{bits.toFixed(0)} bits of entropy</strong> {bits >= 80 ? "— excellent" : bits >= 60 ? "— strong" : bits >= 40 ? "— fair" : "— weak"}</p>
      <Range label="Length" value={o.length} min={4} max={128} onChange={(v) => setO({ ...o, length: v })} display={`${o.length} characters`} />
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Checkbox checked={o.lower} onChange={(v) => setO({ ...o, lower: v })} label="Lowercase (a-z)" />
        <Checkbox checked={o.upper} onChange={(v) => setO({ ...o, upper: v })} label="Uppercase (A-Z)" />
        <Checkbox checked={o.digits} onChange={(v) => setO({ ...o, digits: v })} label="Digits (0-9)" />
        <Checkbox checked={o.symbols} onChange={(v) => setO({ ...o, symbols: v })} label="Symbols (!@#…)" />
        <Checkbox checked={o.excludeSimilar} onChange={(v) => setO({ ...o, excludeSimilar: v })} label="Exclude look-alikes (l 1 I O 0)" />
        <Checkbox checked={!!o.excludeAmbiguous} onChange={(v) => setO({ ...o, excludeAmbiguous: v })} label="Exclude brackets & quotes" />
      </div>
      <Field label="Generate several" htmlFor="pg-c" className="w-32">
        <NumberInput id="pg-c" value={String(count)} onChange={(v) => setCount(Math.max(1, Math.min(50, Number(v) || 1)))} min={1} max={50} step={1} />
      </Field>
      {error && <ErrorBox message={error} />}
      {count > 1 && list.length > 0 && (
        <Panel title={`${list.length} passwords`} actions={<CopyButton text={list.join("\n")} label="Copy all" />}>
          <textarea className="field" rows={Math.min(10, list.length)} readOnly value={list.join("\n")} />
        </Panel>
      )}
      <p className="text-muted text-xs">Generated with crypto.getRandomValues() in your browser. Passwords are never transmitted or stored.</p>
    </div>
  );
}

function PassphraseGenerator() {
  const [words, setWords] = useState<string[] | null>(null);
  const [o, setO] = useState({ count: 5, separator: "-", capitalize: true, addNumber: true });
  const [phrase, setPhrase] = useState("");
  const report = useReportUse();
  useEffect(() => {
    void import("diceware-wordlist-en-eff").then((m) => setWords(Object.values(m.default as Record<string, string>)));
  }, []);
  const gen = () => {
    if (words) setPhrase(G.generatePassphrase(words, o));
  };
  useEffect(gen, [words, o]); // eslint-disable-line react-hooks/exhaustive-deps
  const bits = words ? o.count * Math.log2(words.length) : 0;
  return (
    <div className="space-y-4">
      <div className="surface flex items-center gap-2 rounded-2xl p-4">
        <code className="min-w-0 flex-1 font-mono text-lg break-all sm:text-xl">{phrase || "Loading word list…"}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => (gen(), report())} aria-label="Generate new passphrase"><RefreshCw className="h-4 w-4" aria-hidden /></button>
        <CopyButton text={phrase} />
      </div>
      <p className="text-muted text-sm">Entropy: <strong className="text-[var(--text)]">≈{bits.toFixed(0)} bits</strong> from {words?.length.toLocaleString("en-US") ?? "7,776"} EFF words (number and capitals add a little more).</p>
      <Range label="Words" value={o.count} min={3} max={12} onChange={(v) => setO({ ...o, count: v })} />
      <div className="flex flex-wrap items-end gap-5">
        <Field label="Separator" htmlFor="pp-sep" className="w-40">
          <Select id="pp-sep" value={o.separator} onChange={(v) => setO({ ...o, separator: v })} options={[{ value: "-", label: "Hyphen -" }, { value: " ", label: "Space" }, { value: ".", label: "Dot ." }, { value: "_", label: "Underscore _" }, { value: "", label: "None" }]} />
        </Field>
        <Checkbox checked={o.capitalize} onChange={(v) => setO({ ...o, capitalize: v })} label="Capitalize words" />
        <Checkbox checked={o.addNumber} onChange={(v) => setO({ ...o, addNumber: v })} label="Add a digit" />
      </div>
    </div>
  );
}

function RandomNumber() {
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [count, setCount] = useState("1");
  const [unique, setUnique] = useState(false);
  const [sort, setSort] = useState(false);
  const [mode, setMode] = useState<"int" | "dec">("int");
  const [decimals, setDecimals] = useState("2");
  const [out, setOut] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const gen = () => {
    try {
      let r: number[];
      if (mode === "int") r = G.randomIntegers(Number(min), Number(max), Number(count), unique);
      else {
        const n = Number(count);
        if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error("Count must be between 1 and 10,000.");
        r = Array.from({ length: n }, () => G.randomDecimal(Number(min), Number(max), Math.min(10, Math.max(0, Number(decimals)))));
      }
      setOut(sort ? [...r].sort((a, b) => a - b) : r);
      setError(null);
      report();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const text = out.join(out.length > 20 ? "\n" : ", ");
  return (
    <div className="space-y-4">
      <Segmented ariaLabel="Number type" value={mode} onChange={setMode} options={[{ value: "int", label: "Whole numbers" }, { value: "dec", label: "Decimals" }]} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Minimum" htmlFor="rn-min" className="w-32"><NumberInput id="rn-min" value={min} onChange={setMin} /></Field>
        <Field label="Maximum" htmlFor="rn-max" className="w-32"><NumberInput id="rn-max" value={max} onChange={setMax} /></Field>
        <Field label="How many" htmlFor="rn-c" className="w-28"><NumberInput id="rn-c" value={count} onChange={setCount} min={1} max={10000} step={1} /></Field>
        {mode === "dec" && <Field label="Decimals" htmlFor="rn-d" className="w-24"><NumberInput id="rn-d" value={decimals} onChange={setDecimals} min={0} max={10} step={1} /></Field>}
        {mode === "int" && <div className="pb-2"><Checkbox checked={unique} onChange={setUnique} label="No duplicates" /></div>}
        <div className="pb-2"><Checkbox checked={sort} onChange={setSort} label="Sort" /></div>
        <button type="button" className="btn btn-primary" onClick={gen}>Generate</button>
      </div>
      {error && <ErrorBox message={error} />}
      {out.length === 1 && <div className="surface rounded-2xl py-8 text-center font-mono text-6xl font-bold">{out[0]}</div>}
      {out.length > 1 && (
        <Panel title={`${out.length} numbers`} actions={<CopyButton text={text} />}>
          <textarea className="field" readOnly rows={Math.min(10, Math.ceil(out.length / 10) + 1)} value={text} />
        </Panel>
      )}
    </div>
  );
}

function RandomPicker() {
  const [items, setItems] = useState("Alice\nBob\nCharlie\nDiana\nEthan");
  const [count, setCount] = useState("1");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const report = useReportUse();
  const list = items.split("\n").map((s) => s.trim()).filter(Boolean);
  const pick = () => {
    try {
      const result = G.pickRandom(list, Number(count), true);
      setError(null);
      setRolling(true);
      let i = 0;
      const t = setInterval(() => {
        setPicked([list[G.secureRandomInt(list.length)]]);
        if (++i > 12) {
          clearInterval(t);
          setPicked(result);
          setRolling(false);
        }
      }, 60);
      report();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <Field label={`Items (one per line) — ${list.length} entries`} htmlFor="rp"><textarea id="rp" className="field !font-sans" rows={8} value={items} onChange={(e) => setItems(e.target.value)} /></Field>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Pick how many" htmlFor="rp-c" className="w-32"><NumberInput id="rp-c" value={count} onChange={setCount} min={1} step={1} /></Field>
        <button type="button" className="btn btn-primary" onClick={pick} disabled={rolling}>{rolling ? "Picking…" : "Pick at random"}</button>
      </div>
      {error && <ErrorBox message={error} />}
      {picked.length > 0 && (
        <div className={`surface rounded-2xl p-6 text-center ${rolling ? "opacity-70" : "animate-pop"}`}>
          <ul className="space-y-1 text-2xl font-bold">
            {picked.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function RandomColor() {
  const [colors, setColors] = useState<C.RGBA[]>([]);
  const [scheme, setScheme] = useState<"random" | "analogous" | "complementary" | "triadic" | "monochrome">("random");
  const report = useReportUse();
  const gen = () => {
    const rnd = () => G.secureRandomInt(1_000_000) / 1_000_000;
    const base = C.randomColor(rnd);
    setColors(scheme === "random" ? Array.from({ length: 5 }, () => C.randomColor(rnd)) : C.palette(base, scheme));
  };
  useEffect(gen, [scheme]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Palette type" htmlFor="rc-s" className="w-56">
          <Select id="rc-s" value={scheme} onChange={setScheme} options={[{ value: "random", label: "Fully random" }, { value: "analogous", label: "Analogous" }, { value: "complementary", label: "Complementary" }, { value: "triadic", label: "Triadic" }, { value: "monochrome", label: "Monochrome" }]} />
        </Field>
        <button type="button" className="btn btn-primary" onClick={() => (gen(), report())}><RefreshCw className="h-4 w-4" aria-hidden /> Generate</button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {colors.map((c, i) => {
          const hex = C.rgbToHex(c);
          const dark = C.relativeLuminance(c) < 0.4;
          return (
            <div key={i} className="border-base overflow-hidden rounded-2xl border">
              <div className="flex h-28 items-end p-2" style={{ background: hex }}>
                <span className={`font-mono text-sm font-bold ${dark ? "text-white" : "text-black"}`}>{hex.toUpperCase()}</span>
              </div>
              <div className="bg-surface flex flex-col gap-1 p-2 text-xs">
                <span className="text-muted font-mono">{C.formatRgb(c)}</span>
                <CopyButton text={hex} label="HEX" />
              </div>
            </div>
          );
        })}
      </div>
      <CopyButton text={colors.map((c) => C.rgbToHex(c)).join(", ")} label="Copy palette" />
    </div>
  );
}

// ---------- CSS generators ----------

function CssOutput({ css, preview }: { css: string; preview: React.CSSProperties }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="checkerboard border-base flex min-h-56 items-center justify-center rounded-2xl border p-8">
        <div className="h-36 w-full max-w-64 bg-white dark:bg-slate-200" style={preview} />
      </div>
      <Panel title="CSS" actions={<CopyButton text={css} />}>
        <pre className="font-mono text-sm break-all whitespace-pre-wrap">{css}</pre>
      </Panel>
    </div>
  );
}

function GradientGenerator() {
  const [type, setType] = useState<"linear" | "radial" | "conic">("linear");
  const [angle, setAngle] = useState(135);
  const [stops, setStops] = useState<G.GradientStop[]>([{ color: "#6366f1", position: 0 }, { color: "#ec4899", position: 100 }]);
  const css = G.cssGradient(type, angle, stops);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented ariaLabel="Gradient type" value={type} onChange={setType} options={[{ value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }, { value: "conic", label: "Conic" }]} />
        {type !== "radial" && <div className="w-56"><Range label="Angle" value={angle} min={0} max={360} onChange={setAngle} display={`${angle}°`} /></div>}
      </div>
      <div className="space-y-2">
        {stops.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <input type="color" aria-label={`Stop ${i + 1} color`} className="border-base h-9 w-12 rounded-lg border" value={s.color} onChange={(e) => setStops(stops.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
            <div className="flex-1"><Range label={`Stop ${i + 1} position`} value={s.position} min={0} max={100} onChange={(v) => setStops(stops.map((x, j) => (j === i ? { ...x, position: v } : x)))} display={`${s.position}%`} /></div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={stops.length <= 2} onClick={() => setStops(stops.filter((_, j) => j !== i))} aria-label="Remove stop"><Trash2 className="h-4 w-4" aria-hidden /></button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" disabled={stops.length >= 8} onClick={() => setStops([...stops, { color: "#22d3ee", position: 50 }])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add color stop</button>
      </div>
      <CssOutput css={`background: ${css};`} preview={{ background: css, borderRadius: 16 }} />
    </div>
  );
}

function ShadowGenerator() {
  const [layers, setLayers] = useState<G.ShadowLayer[]>([{ x: 0, y: 10, blur: 30, spread: -5, color: "#0f172a", opacity: 0.25, inset: false }]);
  const [active, setActive] = useState(0);
  const l = layers[active];
  const set = (patch: Partial<G.ShadowLayer>) => setLayers(layers.map((x, i) => (i === active ? { ...x, ...patch } : x)));
  const css = G.cssBoxShadow(layers);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {layers.map((_, i) => (
          <button key={i} type="button" className={`chip ${i === active ? "!bg-brand-600 !text-white" : ""}`} onClick={() => setActive(i)}>Layer {i + 1}</button>
        ))}
        <button type="button" className="chip" disabled={layers.length >= 5} onClick={() => (setLayers([...layers, { x: 0, y: 2, blur: 6, spread: 0, color: "#000000", opacity: 0.12, inset: false }]), setActive(layers.length))}>+ Add layer</button>
        {layers.length > 1 && <button type="button" className="chip" onClick={() => (setLayers(layers.filter((_, i) => i !== active)), setActive(0))}>Remove layer</button>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Range label="Horizontal offset" value={l.x} min={-100} max={100} onChange={(v) => set({ x: v })} display={`${l.x}px`} />
        <Range label="Vertical offset" value={l.y} min={-100} max={100} onChange={(v) => set({ y: v })} display={`${l.y}px`} />
        <Range label="Blur" value={l.blur} min={0} max={150} onChange={(v) => set({ blur: v })} display={`${l.blur}px`} />
        <Range label="Spread" value={l.spread} min={-60} max={60} onChange={(v) => set({ spread: v })} display={`${l.spread}px`} />
        <Range label="Opacity" value={Math.round(l.opacity * 100)} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} display={`${Math.round(l.opacity * 100)}%`} />
        <div className="flex items-center gap-4">
          <input type="color" aria-label="Shadow color" className="border-base h-9 w-12 rounded-lg border" value={l.color} onChange={(e) => set({ color: e.target.value })} />
          <Checkbox checked={l.inset} onChange={(v) => set({ inset: v })} label="Inset" />
        </div>
      </div>
      <CssOutput css={`box-shadow: ${css};`} preview={{ boxShadow: css, borderRadius: 16 }} />
    </div>
  );
}

function BorderRadiusGenerator() {
  const [r, setR] = useState({ tl: 24, tr: 24, br: 24, bl: 24 });
  const [linked, setLinked] = useState(true);
  const [unit, setUnit] = useState<"px" | "%" | "rem">("px");
  const css = G.cssBorderRadius(r, unit);
  const max = unit === "%" ? 50 : unit === "rem" ? 10 : 200;
  const set = (k: keyof typeof r, v: number) => setR(linked ? { tl: v, tr: v, br: v, bl: v } : { ...r, [k]: v });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Segmented ariaLabel="Unit" value={unit} onChange={(u) => (setUnit(u), setR({ tl: u === "%" ? 20 : u === "rem" ? 1 : 24, tr: u === "%" ? 20 : u === "rem" ? 1 : 24, br: u === "%" ? 20 : u === "rem" ? 1 : 24, bl: u === "%" ? 20 : u === "rem" ? 1 : 24 }))} options={[{ value: "px", label: "px" }, { value: "%", label: "%" }, { value: "rem", label: "rem" }]} />
        <Checkbox checked={linked} onChange={setLinked} label="Same for all corners" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["tl", "tr", "bl", "br"] as const).map((k) => (
          <Range key={k} label={{ tl: "Top left", tr: "Top right", bl: "Bottom left", br: "Bottom right" }[k]} value={r[k]} min={0} max={max} step={unit === "rem" ? 0.25 : 1} onChange={(v) => set(k, v)} display={`${r[k]}${unit}`} />
        ))}
      </div>
      <CssOutput css={`border-radius: ${css};`} preview={{ borderRadius: css, background: "linear-gradient(135deg,#6366f1,#22d3ee)" }} />
    </div>
  );
}

// ---------- Marketing / SEO ----------

function UtmBuilder() {
  const [p, setP] = useState({ url: "https://example.com/landing", source: "newsletter", medium: "email", campaign: "spring_sale", term: "", content: "", id: "" });
  const res = useMemo(() => {
    try {
      return { url: G.buildUtmUrl(p.url, p), e: null as string | null };
    } catch (e) {
      return { url: "", e: (e as Error).message };
    }
  }, [p]);
  const f = (k: keyof typeof p, label: string, hint?: string) => (
    <Field key={k} label={label} htmlFor={`utm-${k}`} hint={hint}><input id={`utm-${k}`} className="field" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></Field>
  );
  return (
    <div className="space-y-4">
      {f("url", "Website URL")}
      <div className="grid gap-3 sm:grid-cols-3">
        {f("source", "Campaign source *", "e.g. google, newsletter")}
        {f("medium", "Campaign medium *", "e.g. cpc, email, social")}
        {f("campaign", "Campaign name *", "e.g. spring_sale")}
        {f("term", "Campaign term", "Paid keywords")}
        {f("content", "Campaign content", "Differentiate ads/links")}
        {f("id", "Campaign ID")}
      </div>
      {res.e ? <ErrorBox message={res.e} /> : (
        <Panel title="Tagged URL" actions={<CopyButton text={res.url} />}>
          <p className="font-mono text-sm break-all">{res.url}</p>
        </Panel>
      )}
      <p className="text-muted text-xs">Tip: use lowercase and underscores consistently — analytics tools treat “Email” and “email” as different mediums.</p>
    </div>
  );
}

function RobotsGenerator() {
  const [rules, setRules] = useState<G.RobotsRule[]>([{ userAgent: "*", allow: [], disallow: ["/admin/", "/cart/"] }]);
  const [sitemap, setSitemap] = useState("https://example.com/sitemap.xml");
  const [blockAi, setBlockAi] = useState(false);
  const allRules = blockAi ? [...rules, ...["GPTBot", "CCBot", "Google-Extended", "ClaudeBot", "PerplexityBot"].map((ua) => ({ userAgent: ua, allow: [], disallow: ["/"] }))] : rules;
  const txt = G.buildRobotsTxt(allRules, [sitemap]);
  const upd = (i: number, patch: Partial<G.RobotsRule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-4">
      {rules.map((r, i) => (
        <Panel key={i} title={`Rule group ${i + 1}`} actions={rules.length > 1 ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRules(rules.filter((_, j) => j !== i))}>Remove</button> : undefined}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="User-agent" htmlFor={`ua-${i}`}><input id={`ua-${i}`} className="field font-mono" value={r.userAgent} onChange={(e) => upd(i, { userAgent: e.target.value })} /></Field>
            <Field label="Disallow (one path per line)" htmlFor={`dis-${i}`}><textarea id={`dis-${i}`} className="field" rows={3} value={r.disallow.join("\n")} onChange={(e) => upd(i, { disallow: e.target.value.split("\n") })} /></Field>
            <Field label="Allow (one path per line)" htmlFor={`al-${i}`}><textarea id={`al-${i}`} className="field" rows={3} value={r.allow.join("\n")} onChange={(e) => upd(i, { allow: e.target.value.split("\n").filter((x) => x.trim()) })} /></Field>
          </div>
        </Panel>
      ))}
      <div className="flex flex-wrap items-end gap-4">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRules([...rules, { userAgent: "Googlebot", allow: [], disallow: [] }])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add rule group</button>
        <Checkbox checked={blockAi} onChange={setBlockAi} label="Block common AI training crawlers" />
      </div>
      <Field label="Sitemap URL" htmlFor="rb-sm"><input id="rb-sm" className="field" value={sitemap} onChange={(e) => setSitemap(e.target.value)} /></Field>
      <Panel title="robots.txt" actions={<><CopyButton text={txt} /><button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadText(txt, "robots.txt")}>Download</button></>}>
        <pre className="font-mono text-sm whitespace-pre-wrap">{txt}</pre>
      </Panel>
      <Notice>robots.txt is a request, not access control. Never rely on it to hide private pages — use authentication or a noindex header instead.</Notice>
    </div>
  );
}

function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left dark:border-slate-700 dark:bg-slate-900">
      <p className="truncate text-xs text-slate-600 dark:text-slate-400">{url || "https://example.com"}</p>
      <p className="truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">{title || "Page title"}</p>
      <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{description || "Meta description appears here."}</p>
    </div>
  );
}

function MetaTagGenerator() {
  const [m, setM] = useState<G.MetaTagInput>({ title: "", description: "", keywords: "", author: "", canonical: "", robotsIndex: true, robotsFollow: true, viewport: true, charset: true, themeColor: "", language: "" });
  const tags = G.buildMetaTags(m);
  const tips = G.metaLengthAdvice(m.title, m.description);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Title (${m.title.length}/60)`} htmlFor="mt-t"><input id="mt-t" className="field" value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} /></Field>
        <Field label="Canonical URL" htmlFor="mt-c"><input id="mt-c" className="field" value={m.canonical} onChange={(e) => setM({ ...m, canonical: e.target.value })} placeholder="https://example.com/page" /></Field>
      </div>
      <Field label={`Description (${m.description.length}/160)`} htmlFor="mt-d"><textarea id="mt-d" className="field !font-sans" rows={3} value={m.description} onChange={(e) => setM({ ...m, description: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Author" htmlFor="mt-a"><input id="mt-a" className="field" value={m.author} onChange={(e) => setM({ ...m, author: e.target.value })} /></Field>
        <Field label="Theme color" htmlFor="mt-tc"><input id="mt-tc" className="field" value={m.themeColor} onChange={(e) => setM({ ...m, themeColor: e.target.value })} placeholder="#4f46e5" /></Field>
        <Field label="Keywords (ignored by Google)" htmlFor="mt-k"><input id="mt-k" className="field" value={m.keywords} onChange={(e) => setM({ ...m, keywords: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-5">
        <Checkbox checked={m.robotsIndex} onChange={(v) => setM({ ...m, robotsIndex: v })} label="Allow indexing" />
        <Checkbox checked={m.robotsFollow} onChange={(v) => setM({ ...m, robotsFollow: v })} label="Follow links" />
        <Checkbox checked={m.charset} onChange={(v) => setM({ ...m, charset: v })} label="UTF-8 charset" />
        <Checkbox checked={m.viewport} onChange={(v) => setM({ ...m, viewport: v })} label="Mobile viewport" />
      </div>
      {tips.map((t) => <Notice key={t} tone="warn">{t}</Notice>)}
      <div>
        <span className="label">Google search preview (approximate)</span>
        <SerpPreview title={m.title} description={m.description} url={m.canonical ?? ""} />
      </div>
      <Panel title="HTML" actions={<CopyButton text={tags} />}>
        <pre className="font-mono text-xs break-all whitespace-pre-wrap">{tags}</pre>
      </Panel>
    </div>
  );
}

function OpenGraphGenerator() {
  const [o, setO] = useState<G.OgInput>({ title: "", description: "", url: "", image: "", imageAlt: "", siteName: "", type: "website", locale: "en_US", twitterCard: "summary_large_image", twitterSite: "" });
  const tags = G.buildOpenGraph(o);
  const f = (k: keyof G.OgInput, label: string, ph?: string) => (
    <Field key={k} label={label} htmlFor={`og-${k}`}><input id={`og-${k}`} className="field" value={String(o[k] ?? "")} placeholder={ph} onChange={(e) => setO({ ...o, [k]: e.target.value })} /></Field>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {f("title", "Title")}{f("url", "Page URL", "https://example.com/page")}{f("image", "Image URL (1200×630 recommended)", "https://example.com/og.png")}{f("imageAlt", "Image alt text")}{f("siteName", "Site name")}{f("twitterSite", "X/Twitter @username", "@yourbrand")}
        <Field label="Type" htmlFor="og-type"><Select id="og-type" value={o.type} onChange={(v) => setO({ ...o, type: v })} options={["website", "article", "product", "profile", "video.other"].map((v) => ({ value: v, label: v }))} /></Field>
        <Field label="Twitter card" htmlFor="og-tc"><Select id="og-tc" value={o.twitterCard} onChange={(v) => setO({ ...o, twitterCard: v })} options={[{ value: "summary_large_image", label: "Large image" }, { value: "summary", label: "Summary" }]} /></Field>
      </div>
      <Field label="Description" htmlFor="og-d"><textarea id="og-d" className="field !font-sans" rows={2} value={o.description} onChange={(e) => setO({ ...o, description: e.target.value })} /></Field>
      <div>
        <span className="label">Share preview (approximate)</span>
        <div className="border-base max-w-lg overflow-hidden rounded-2xl border">
          <div className="bg-surface-2 flex aspect-[1200/630] items-center justify-center overflow-hidden">
            {o.image ? <img src={o.image} alt={o.imageAlt || ""} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-muted text-sm">Image preview</span>}
          </div>
          <div className="bg-surface p-3">
            <p className="text-muted text-xs uppercase">{(() => { try { return new URL(o.url).hostname; } catch { return "example.com"; } })()}</p>
            <p className="truncate font-semibold">{o.title || "Title"}</p>
            <p className="text-muted line-clamp-2 text-sm">{o.description || "Description"}</p>
          </div>
        </div>
      </div>
      <Panel title="HTML" actions={<CopyButton text={tags} />}>
        <pre className="font-mono text-xs break-all whitespace-pre-wrap">{tags}</pre>
      </Panel>
      <KeyValueList items={[{ k: "Image size", v: "1200×630 px, under 5 MB, JPG or PNG" }, { k: "Title length", v: `${o.title.length} chars (keep under ~60)` }]} />
    </div>
  );
}

const tools: Record<string, ComponentType> = {
  "qr-code-generator": QrGenerator,
  "wifi-qr-generator": WifiQr,
  "email-qr-generator": EmailQr,
  "phone-qr-generator": PhoneQr,
  "sms-qr-generator": SmsQr,
  "vcard-qr-generator": VCardQr,
  "qr-code-reader": QrReader,
  "barcode-generator": BarcodeGenerator,
  "password-generator": PasswordGenerator,
  "passphrase-generator": PassphraseGenerator,
  "random-number-generator": RandomNumber,
  "random-picker": RandomPicker,
  "random-color-generator": RandomColor,
  "gradient-generator": GradientGenerator,
  "css-shadow-generator": ShadowGenerator,
  "css-border-radius-generator": BorderRadiusGenerator,
  "utm-link-builder": UtmBuilder,
  "robots-txt-generator": RobotsGenerator,
  "meta-tag-generator": MetaTagGenerator,
  "open-graph-generator": OpenGraphGenerator,
};

export default tools;
