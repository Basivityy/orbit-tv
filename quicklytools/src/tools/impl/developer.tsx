"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import cronstrue from "cronstrue";
import { createTwoFilesPatch, diffLines } from "diff";
import * as D from "../logic/developer";
import { TextTransformTool } from "../ui/TextTransformTool";
import { ColorConverter, HexToRgb, RgbToHsl } from "../ui/ColorTools";
import {
  Checkbox, CopyButton, DataTable, DownloadButton, ErrorBox, Field, FileDrop, KeyValueList, Notice, NumberInput, Panel, Segmented, Select,
  downloadBlob, downloadText, formatBytes, useReportUse,
} from "../ui/kit";

const sampleJson = '{"name":"QuicklyTools","version":1,"tags":["fast","private"],"owner":{"id":42,"active":true},"score":9.5}';

const JsonFormatter = () => (
  <TextTransformTool
    options={[
      { type: "select", name: "indent", label: "Indentation", default: "2", options: [{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }, { value: "tab", label: "Tabs" }] },
      { type: "checkbox", name: "sort", label: "Sort keys A→Z", default: false },
    ]}
    transform={(t, o) => D.formatJson(t, o.indent === "tab" ? "tab" : Number(o.indent), Boolean(o.sort))}
    sample={sampleJson}
    download={{ filename: "formatted.json", mime: "application/json" }}
    fileAccept=".json,application/json,text/plain"
    placeholder='Paste JSON, e.g. {"a":1}'
  />
);

const JsonMinifier = () => (
  <TextTransformTool
    transform={(t) => {
      const out = D.minifyJson(t);
      const r = D.sizeReport(t, out);
      return { output: out, info: `${formatBytes(r.before)} → ${formatBytes(r.after)} (${r.percent.toFixed(1)}% smaller)` };
    }}
    sample={JSON.stringify(JSON.parse(sampleJson), null, 2)}
    download={{ filename: "minified.json", mime: "application/json" }}
    fileAccept=".json,application/json"
  />
);

function JsonValidator() {
  const [text, setText] = useState("");
  const report = useReportUse();
  const res = useMemo(() => (text.trim() ? D.validateJson(text) : null), [text]);
  const lines = text.split("\n");
  return (
    <div className="space-y-4">
      <Field label="JSON to validate" htmlFor="jv">
        <textarea id="jv" className="field" rows={14} spellCheck={false} value={text} onChange={(e) => (setText(e.target.value), report())} placeholder="Paste JSON here" />
      </Field>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setText('{"valid": true, "items": [1, 2, 3]}')}>Valid sample</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setText('{\n  "name": "test",\n  "items": [1, 2, 3,]\n}')}>Invalid sample</button>
      </div>
      {res && res.valid && <Notice tone="success">✓ {res.summary}</Notice>}
      {res && !res.valid && (
        <div className="space-y-2">
          <ErrorBox message={res.error.line ? `Line ${res.error.line}, column ${res.error.column}: ${res.error.message}` : res.error.message} />
          {res.error.line && (
            <pre className="bg-surface-2 overflow-x-auto rounded-xl p-3 font-mono text-xs">
              {lines.slice(Math.max(0, res.error.line - 3), res.error.line + 2).map((l, i) => {
                const n = Math.max(0, res.error.line! - 3) + i + 1;
                return (
                  <div key={n} className={n === res.error.line ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100" : ""}>
                    <span className="text-muted mr-3 inline-block w-8 text-right select-none">{n}</span>
                    {l}
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const JsonToCsv = () => (
  <TextTransformTool
    options={[
      { type: "select", name: "delim", label: "Delimiter", default: ",", options: [{ value: ",", label: "Comma" }, { value: ";", label: "Semicolon" }, { value: "\t", label: "Tab" }] },
      { type: "checkbox", name: "flat", label: "Flatten nested objects (a.b)", default: true },
    ]}
    transform={(t, o) => D.jsonToCsv(t, { delimiter: String(o.delim), flattenNested: Boolean(o.flat) })}
    sample='[{"id":1,"name":"Ada","address":{"city":"London"}},{"id":2,"name":"Linus","address":{"city":"Helsinki"},"tags":["kernel"]}]'
    download={{ filename: "data.csv", mime: "text/csv;charset=utf-8" }}
    fileAccept=".json,application/json"
    inputLabel="JSON (array of objects)"
    outputLabel="CSV"
  />
);

const CsvToJson = () => (
  <TextTransformTool
    options={[
      { type: "checkbox", name: "header", label: "First row is header", default: true },
      { type: "checkbox", name: "types", label: "Convert numbers & booleans", default: true },
      { type: "select", name: "delim", label: "Delimiter", default: "", options: [{ value: "", label: "Auto-detect" }, { value: ",", label: "Comma" }, { value: ";", label: "Semicolon" }, { value: "\t", label: "Tab" }, { value: "|", label: "Pipe" }] },
    ]}
    transform={(t, o) => D.csvToJson(t, { header: Boolean(o.header), dynamicTyping: Boolean(o.types), delimiter: String(o.delim) })}
    sample={'id,name,active,score\n1,Ada,true,9.5\n2,"Smith, John",false,7'}
    download={{ filename: "data.json", mime: "application/json" }}
    fileAccept=".csv,.tsv,text/csv,text/plain"
    inputLabel="CSV"
    outputLabel="JSON"
  />
);

const CsvDedupe = () => (
  <TextTransformTool
    options={[
      { type: "checkbox", name: "header", label: "First row is header", default: true },
      { type: "text", name: "cols", label: "Compare only these columns (optional)", default: "", placeholder: "e.g. email or 2,3" },
      { type: "checkbox", name: "cs", label: "Case sensitive", default: false },
      { type: "checkbox", name: "trim", label: "Ignore surrounding spaces", default: true },
    ]}
    transform={(t, o) => {
      const r = D.csvRemoveDuplicates(t, { hasHeader: Boolean(o.header), columns: String(o.cols), caseSensitive: Boolean(o.cs), trim: Boolean(o.trim) });
      return { output: r.output, info: `${r.removed} duplicate row(s) removed from ${r.total}.` };
    }}
    sample={"email,name\nada@example.com,Ada\nADA@example.com,Ada L.\nlinus@example.com,Linus\nada@example.com,Ada"}
    download={{ filename: "deduplicated.csv", mime: "text/csv;charset=utf-8" }}
    fileAccept=".csv,.tsv,text/csv,text/plain"
  />
);

const XmlFormatter = () => (
  <TextTransformTool
    options={[{ type: "select", name: "indent", label: "Indentation", default: "2", options: [{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }] }]}
    transform={(t, o) => D.formatXml(t, Number(o.indent))}
    sample={'<?xml version="1.0"?><catalog><book id="b1"><title>XML Basics</title><price currency="USD">29.99</price></book><!-- note --><book id="b2"><title>Advanced</title></book></catalog>'}
    download={{ filename: "formatted.xml", mime: "application/xml" }}
    fileAccept=".xml,.svg,.rss,application/xml,text/xml"
  />
);

const HtmlFormatter = () => (
  <TextTransformTool
    options={[
      { type: "select", name: "indent", label: "Indentation", default: "2", options: [{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }] },
      { type: "number", name: "wrap", label: "Wrap line length (0 = off)", default: 0, min: 0, max: 400 },
    ]}
    transform={async (t, o) => {
      const { html } = await import("js-beautify");
      return html(t, { indent_size: Number(o.indent), wrap_line_length: Number(o.wrap) || 0, indent_inner_html: true, extra_liners: [], end_with_newline: true });
    }}
    sample={'<!doctype html><html><head><title>Demo</title><style>body{margin:0}</style></head><body><div class="card"><h1>Hello</h1><p>Paragraph with <b>bold</b> text.</p><ul><li>One</li><li>Two</li></ul></div><script>console.log("hi")</script></body></html>'}
    download={{ filename: "formatted.html", mime: "text/html" }}
    fileAccept=".html,.htm,text/html"
  />
);

const CssMinifier = () => (
  <TextTransformTool
    options={[{ type: "checkbox", name: "restructure", label: "Advanced optimizations (merge rules)", default: true }]}
    transform={async (t, o) => {
      const { minify } = await import("csso");
      let out: string;
      try {
        out = minify(t, { restructure: Boolean(o.restructure), comments: "exclamation" }).css;
      } catch (e) {
        throw new Error(`CSS parse error: ${(e as Error).message}`);
      }
      const r = D.sizeReport(t, out);
      return { output: out, info: `${formatBytes(r.before)} → ${formatBytes(r.after)} (${r.percent.toFixed(1)}% smaller)` };
    }}
    sample={"/* Buttons */\n.btn {\n  color: #ffffff;\n  padding: 10px 20px 10px 20px;\n  margin: 0px;\n}\n.btn:hover { color: #fff; }\n"}
    download={{ filename: "styles.min.css", mime: "text/css" }}
    fileAccept=".css,text/css"
  />
);

const JsMinifier = () => (
  <TextTransformTool
    live={false}
    actionLabel="Minify JavaScript"
    options={[
      { type: "checkbox", name: "mangle", label: "Shorten variable names", default: true },
      { type: "checkbox", name: "drop", label: "Remove console.* calls", default: false },
      { type: "select", name: "ecma", label: "Output ECMAScript", default: "2020", options: [{ value: "2015", label: "ES2015" }, { value: "2020", label: "ES2020" }] },
    ]}
    transform={async (t, o) => {
      const { minify } = await import("terser");
      let res;
      try {
        res = await minify(t, { mangle: Boolean(o.mangle), compress: { drop_console: Boolean(o.drop) }, ecma: Number(o.ecma) as 2015 | 2020, format: { comments: /^!/ } });
      } catch (e) {
        const err = e as { message: string; line?: number; col?: number };
        throw new Error(err.line ? `Syntax error at line ${err.line}, column ${err.col}: ${err.message}` : err.message);
      }
      const out = res.code ?? "";
      const r = D.sizeReport(t, out);
      return { output: out, info: `${formatBytes(r.before)} → ${formatBytes(r.after)} (${r.percent.toFixed(1)}% smaller)` };
    }}
    sample={"// Greets a user\nfunction greetUser(userName) {\n  const greetingMessage = 'Hello, ' + userName + '!';\n  console.log(greetingMessage);\n  return greetingMessage;\n}\ngreetUser('World');\n"}
    download={{ filename: "script.min.js", mime: "text/javascript" }}
    fileAccept=".js,.mjs,.cjs,text/javascript"
  />
);

function Base64Encoder() {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [fileOut, setFileOut] = useState<{ name: string; b64: string; type: string } | null>(null);
  const [dataUri, setDataUri] = useState(false);
  const report = useReportUse();
  return (
    <div className="space-y-4">
      <Segmented ariaLabel="Input type" value={mode} onChange={setMode} options={[{ value: "text", label: "Text" }, { value: "file", label: "File" }]} />
      {mode === "text" ? (
        <TextTransformTool
          options={[
            { type: "checkbox", name: "url", label: "URL-safe (Base64URL)", default: false },
            { type: "checkbox", name: "wrap", label: "Wrap at 76 characters (MIME)", default: false },
          ]}
          transform={(t, o) => D.base64Encode(t, { urlSafe: Boolean(o.url), lineLength: o.wrap ? 76 : 0 })}
          sample="Hello, World! Ünïcödé ✓"
          outputLabel="Base64"
        />
      ) : (
        <div className="space-y-3">
          <FileDrop
            accept=""
            maxSizeMB={25}
            onFiles={async ([f]) => {
              const bytes = new Uint8Array(await f.arrayBuffer());
              setFileOut({ name: f.name, b64: D.bytesToBase64(bytes), type: f.type || "application/octet-stream" });
              report();
            }}
          />
          {fileOut && (
            <Panel
              title={`${fileOut.name} · ${formatBytes(fileOut.b64.length)} of Base64`}
              actions={
                <>
                  <Checkbox checked={dataUri} onChange={setDataUri} label="Data URI" />
                  <CopyButton text={dataUri ? `data:${fileOut.type};base64,${fileOut.b64}` : fileOut.b64} />
                </>
              }
            >
              <textarea className="field" rows={8} readOnly value={(dataUri ? `data:${fileOut.type};base64,` : "") + fileOut.b64.slice(0, 200_000) + (fileOut.b64.length > 200_000 ? "… (truncated in preview — use Copy)" : "")} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Base64Decoder() {
  const [input, setInput] = useState("");
  const report = useReportUse();
  const res = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const bytes = D.base64ToBytes(input);
      let text: string | null = null;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        text = null;
      }
      return { bytes, text, error: null as string | null };
    } catch (e) {
      return { bytes: null, text: null, error: (e as Error).message };
    }
  }, [input]);
  const mime = input.match(/^data:([^;,]+)/)?.[1] ?? "application/octet-stream";
  return (
    <div className="space-y-4">
      <Field label="Base64 or data URI" htmlFor="b64d">
        <textarea id="b64d" className="field" rows={8} value={input} spellCheck={false} onChange={(e) => (setInput(e.target.value), report())} placeholder="SGVsbG8sIFdvcmxkIQ==" />
      </Field>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInput("SGVsbG8sIFdvcmxkISDDnG7Dr2PDtmTDqSDinJM=")}>Sample</button>
      {res?.error && <ErrorBox message={res.error} />}
      {res?.bytes && (
        <Panel
          title={`Decoded ${formatBytes(res.bytes.length)}`}
          actions={
            <>
              {res.text !== null && <CopyButton text={res.text} />}
              <DownloadButton primary={false} label="Download file" onClick={() => downloadBlob(new Blob([res.bytes as BlobPart], { type: mime }), "decoded" + (mime.includes("png") ? ".png" : mime.includes("jpeg") ? ".jpg" : mime.includes("pdf") ? ".pdf" : ".bin"))} />
            </>
          }
        >
          {res.text !== null ? (
            <textarea className="field" rows={8} readOnly value={res.text} />
          ) : (
            <Notice tone="warn">The decoded data is binary (not UTF-8 text). Use “Download file” to save it.</Notice>
          )}
        </Panel>
      )}
    </div>
  );
}

const UrlEncoder = () => (
  <TextTransformTool
    options={[{ type: "select", name: "mode", label: "Encode as", default: "component", options: [{ value: "component", label: "Component (encodeURIComponent)" }, { value: "uri", label: "Full URL (encodeURI)" }, { value: "form", label: "Form data (spaces as +)" }] }]}
    transform={(t, o) => D.urlEncode(t, o.mode as "component")}
    sample="https://example.com/search?q=café & crème&lang=en"
  />
);

function UrlDecoder() {
  const [parsed, setParsed] = useState<D.ParsedUrl | null>(null);
  return (
    <div className="space-y-4">
      <TextTransformTool
        options={[{ type: "checkbox", name: "plus", label: "Treat + as space", default: true }]}
        transform={(t, o) => {
          const out = D.urlDecode(t, Boolean(o.plus));
          setParsed(D.parseUrlParams(out.trim()));
          return out;
        }}
        sample="https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dcaf%C3%A9%20%26%20cr%C3%A8me%26lang%3Den"
      />
      {parsed && parsed.params.length > 0 && (
        <Panel title="Query parameters">
          <DataTable columns={["Parameter", "Value"]} rows={parsed.params} />
        </Panel>
      )}
    </div>
  );
}

function JwtDecoder() {
  const [token, setToken] = useState("");
  const report = useReportUse();
  const res = useMemo(() => {
    if (!token.trim()) return null;
    try {
      return { jwt: D.decodeJwt(token), error: null };
    } catch (e) {
      return { jwt: null, error: (e as Error).message };
    }
  }, [token]);
  const sample =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.k8T8Y3H0nK0wQe0w2b7y0qQ0P3dXhW5S6Yc9s9vJ1zE";
  return (
    <div className="space-y-4">
      <Field label="JSON Web Token" htmlFor="jwt" hint="Decoding happens in your browser. The signature is shown but not verified.">
        <textarea id="jwt" className="field" rows={5} spellCheck={false} value={token} onChange={(e) => (setToken(e.target.value), report())} placeholder="eyJhbGciOi…" />
      </Field>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setToken(sample)}>Sample token</button>
      {res?.error && <ErrorBox message={res.error} />}
      {res?.jwt && (
        <div className="space-y-4">
          {res.jwt.expired === true && <Notice tone="warn">This token has expired (exp is in the past).</Notice>}
          {res.jwt.expired === false && <Notice tone="success">The token is not expired.</Notice>}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Header" actions={<CopyButton text={JSON.stringify(res.jwt.header, null, 2)} />}>
              <pre className="overflow-auto font-mono text-xs">{JSON.stringify(res.jwt.header, null, 2)}</pre>
            </Panel>
            <Panel title="Payload" actions={<CopyButton text={JSON.stringify(res.jwt.payload, null, 2)} />}>
              <pre className="overflow-auto font-mono text-xs">{JSON.stringify(res.jwt.payload, null, 2)}</pre>
            </Panel>
          </div>
          {res.jwt.claims.length > 0 && <KeyValueList items={res.jwt.claims.map((c) => ({ k: c.name, v: c.value }))} />}
        </div>
      )}
    </div>
  );
}

function UuidGenerator() {
  const [version, setVersion] = useState<"v4" | "v7">("v4");
  const [count, setCount] = useState("5");
  const [upper, setUpper] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [list, setList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const report = useReportUse();
  const generate = () => {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      setError("Count must be between 1 and 1000.");
      return;
    }
    setError(null);
    setList(
      Array.from({ length: n }, () => {
        let u = version === "v4" ? D.uuidV4() : D.uuidV7();
        if (!hyphens) u = u.replace(/-/g, "");
        return upper ? u.toUpperCase() : u;
      }),
    );
    report();
  };
  useEffect(generate, []); // eslint-disable-line react-hooks/exhaustive-deps
  const text = list.join("\n");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Version" htmlFor="uv" className="w-56">
          <Select id="uv" value={version} onChange={setVersion} options={[{ value: "v4", label: "Version 4 (random)" }, { value: "v7", label: "Version 7 (time-ordered)" }]} />
        </Field>
        <Field label="How many" htmlFor="uc" className="w-28">
          <NumberInput id="uc" value={count} onChange={setCount} min={1} max={1000} step={1} />
        </Field>
        <div className="flex gap-4 pb-2">
          <Checkbox checked={upper} onChange={setUpper} label="Uppercase" />
          <Checkbox checked={hyphens} onChange={setHyphens} label="Hyphens" />
        </div>
        <button type="button" className="btn btn-primary" onClick={generate}>Generate</button>
      </div>
      {error && <ErrorBox message={error} />}
      <Panel title={`${list.length} UUID${list.length === 1 ? "" : "s"}`} actions={<><CopyButton text={text} label="Copy all" /><button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadText(text, "uuids.txt")}>Download</button></>}>
        <textarea className="field" rows={Math.min(12, Math.max(3, list.length))} readOnly value={text} />
      </Panel>
    </div>
  );
}

function HashTool({ algorithm }: { algorithm: "SHA-256" | "MD5" }) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [fileHash, setFileHash] = useState<{ name: string; size: number; hash: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState("");
  const report = useReportUse();

  const hashText = async (t: string, o: Record<string, unknown>): Promise<string> => {
    let h: string;
    if (algorithm === "MD5") {
      const SparkMD5 = (await import("spark-md5")).default;
      h = SparkMD5.ArrayBuffer.hash(new TextEncoder().encode(t).buffer as ArrayBuffer);
    } else if (o.hmac) {
      h = await D.hmacSha256(String(o.key), t);
    } else {
      h = await D.shaDigest("SHA-256", t);
    }
    return o.upper ? h.toUpperCase() : h;
  };

  const hashFile = async (f: File) => {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      let hash: string;
      if (algorithm === "MD5") {
        const SparkMD5 = (await import("spark-md5")).default;
        const spark = new SparkMD5.ArrayBuffer();
        const chunk = 4 * 1024 * 1024;
        for (let off = 0; off < f.size; off += chunk) {
          spark.append(await f.slice(off, off + chunk).arrayBuffer());
          setProgress(Math.min(100, ((off + chunk) / f.size) * 100));
        }
        hash = spark.end();
      } else {
        if (f.size > 500 * 1024 * 1024) throw new Error("SHA-256 file hashing is limited to 500 MB in the browser.");
        hash = D.toHex(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()));
        setProgress(100);
      }
      setFileHash({ name: f.name, size: f.size, hash });
      report();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Segmented ariaLabel="Input type" value={mode} onChange={setMode} options={[{ value: "text", label: "Text" }, { value: "file", label: "File" }]} />
      {mode === "text" ? (
        <TextTransformTool
          options={[
            { type: "checkbox", name: "upper", label: "Uppercase", default: false },
            ...(algorithm === "SHA-256"
              ? ([
                  { type: "checkbox", name: "hmac", label: "HMAC mode", default: false },
                  { type: "text", name: "key", label: "HMAC secret key", default: "", placeholder: "Only used in HMAC mode" },
                ] as const)
              : []),
          ]}
          transform={hashText}
          sample="The quick brown fox jumps over the lazy dog"
          outputLabel={`${algorithm} hash (hex)`}
          rows={6}
          allowEmpty
        />
      ) : (
        <div className="space-y-3">
          <FileDrop accept="" maxSizeMB={algorithm === "MD5" ? 2048 : 500} onFiles={([f]) => void hashFile(f)} disabled={busy} />
          {busy && (
            <div className="bg-surface-2 h-2 rounded-full">
              <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {error && <ErrorBox message={error} />}
          {fileHash && (
            <>
              <KeyValueList items={[{ k: "File", v: `${fileHash.name} (${formatBytes(fileHash.size)})` }, { k: algorithm, v: fileHash.hash, copy: fileHash.hash }]} />
              <Field label="Compare with an expected checksum" htmlFor="hcmp">
                <input id="hcmp" className="field font-mono" value={compare} onChange={(e) => setCompare(e.target.value)} placeholder="Paste checksum" />
              </Field>
              {compare.trim() &&
                (compare.trim().toLowerCase() === fileHash.hash ? <Notice tone="success">✓ Checksums match.</Notice> : <ErrorBox message="Checksums do NOT match." />)}
            </>
          )}
        </div>
      )}
      {algorithm === "MD5" && <Notice tone="warn">MD5 is fine for checksums and cache keys but is broken for security. Use SHA-256 or a password hash such as Argon2 for passwords.</Notice>}
    </div>
  );
}

function RegexTester() {
  const [pattern, setPattern] = useState("\\b(\\w+)@(\\w+)\\.com\\b");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("Contact ada@example.com or linus@kernel.com — not bob@site.org.");
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      return { ...D.runRegex(pattern, flags, text), error: null as string | null };
    } catch (e) {
      return { matches: [], truncated: false, error: (e as Error).message };
    }
  }, [pattern, flags, text]);

  const highlighted = useMemo(() => {
    if (res.error || res.matches.length === 0) return [text];
    const out: React.ReactNode[] = [];
    let last = 0;
    res.matches.forEach((m, i) => {
      if (m.match.length === 0) return;
      out.push(text.slice(last, m.index));
      out.push(<mark key={i} className="rounded bg-amber-200 px-0.5 text-amber-950 dark:bg-amber-500/40 dark:text-amber-50">{m.match}</mark>);
      last = m.index + m.match.length;
    });
    out.push(text.slice(last));
    return out;
  }, [res, text]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Field label="Pattern" htmlFor="rx" className="min-w-64 flex-1">
          <div className="flex items-center gap-1 font-mono">
            <span className="text-muted">/</span>
            <input id="rx" className="field font-mono" value={pattern} onChange={(e) => (setPattern(e.target.value), report())} spellCheck={false} />
            <span className="text-muted">/</span>
          </div>
        </Field>
        <Field label="Flags" htmlFor="rxf" className="w-28">
          <input id="rxf" className="field font-mono" value={flags} onChange={(e) => setFlags(e.target.value)} spellCheck={false} />
        </Field>
      </div>
      <Field label="Test string" htmlFor="rxt">
        <textarea id="rxt" className="field" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      {res.error && <ErrorBox message={res.error} />}
      {!res.error && (
        <>
          <Panel title={`${res.matches.length}${res.truncated ? "+" : ""} match${res.matches.length === 1 ? "" : "es"}`}>
            <pre className="font-mono text-sm break-words whitespace-pre-wrap">{highlighted}</pre>
          </Panel>
          {res.matches.length > 0 && (
            <DataTable
              columns={["#", "Index", "Match", ...res.matches[0].groups.map((_, i) => `Group ${i + 1}`)]}
              rows={res.matches.slice(0, 200).map((m, i) => [i + 1, m.index, m.match, ...m.groups.map((g) => g ?? "—")])}
            />
          )}
        </>
      )}
      <details className="bg-surface-2 rounded-xl px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Quick reference</summary>
        <div className="text-muted mt-2 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
          <span>\d digit · \w word char · \s whitespace</span>
          <span>. any char · ^ start · $ end</span>
          <span>* 0+ · + 1+ · ? 0 or 1 · {"{n,m}"} range</span>
          <span>(…) group · (?&lt;name&gt;…) named · (?:…) non-capturing</span>
          <span>[abc] set · [^abc] negated · a|b alternation</span>
          <span>flags: g global · i ignore case · m multiline · s dotAll · u unicode</span>
        </div>
      </details>
    </div>
  );
}

function TimestampConverter() {
  const [now, setNow] = useState(() => Date.now());
  const [ts, setTs] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [dateStr, setDateStr] = useState("");
  const report = useReportUse();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const parsed = useMemo(() => {
    try {
      return { ...D.parseTimestamp(ts), error: null as string | null };
    } catch (e) {
      return { date: null, unit: null, error: (e as Error).message };
    }
  }, [ts]);
  const fromDate = useMemo(() => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [dateStr]);
  return (
    <div className="space-y-5">
      <Panel title="Current Unix time">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-2xl font-semibold tabular-nums">{Math.floor(now / 1000)}</span>
          <CopyButton text={String(Math.floor(now / 1000))} />
          <span className="text-muted font-mono text-sm">{now} ms</span>
        </div>
      </Panel>
      <Panel title="Timestamp → date">
        <Field label="Unix timestamp (seconds, milliseconds or microseconds — detected automatically)" htmlFor="tsin">
          <input id="tsin" className="field font-mono" value={ts} onChange={(e) => (setTs(e.target.value), report())} inputMode="numeric" />
        </Field>
        <div className="mt-3">
          {parsed.error ? (
            <ErrorBox message={parsed.error} />
          ) : (
            parsed.date && (
              <KeyValueList
                items={[
                  { k: "Detected unit", v: parsed.unit },
                  { k: "UTC (ISO 8601)", v: parsed.date.toISOString(), copy: parsed.date.toISOString() },
                  { k: "Your local time", v: parsed.date.toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" }) },
                  { k: "RFC 2822", v: parsed.date.toUTCString() },
                  { k: "Relative", v: D.relativeTime(parsed.date, new Date(now)) },
                ]}
              />
            )
          )}
        </div>
      </Panel>
      <Panel title="Date → timestamp">
        <Field label="Date and time (your local time zone)" htmlFor="dtin">
          <input id="dtin" type="datetime-local" step={1} className="field max-w-xs" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
        </Field>
        {fromDate && (
          <div className="mt-3">
            <KeyValueList
              items={[
                { k: "Seconds", v: Math.floor(fromDate.getTime() / 1000), copy: String(Math.floor(fromDate.getTime() / 1000)) },
                { k: "Milliseconds", v: fromDate.getTime(), copy: String(fromDate.getTime()) },
                { k: "UTC", v: fromDate.toISOString() },
              ]}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

function CronExplainer() {
  const [expr, setExpr] = useState("*/15 9-17 * * 1-5");
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      D.parseCron(expr);
      const text = cronstrue.toString(expr.trim(), { use24HourTimeFormat: false, verbose: true });
      return { text, runs: D.nextCronRuns(expr, 8), error: null as string | null };
    } catch (e) {
      const msg = typeof e === "string" ? e : (e as Error).message;
      return { text: "", runs: [] as Date[], error: msg };
    }
  }, [expr]);
  const presets = [
    ["Every minute", "* * * * *"], ["Every 5 minutes", "*/5 * * * *"], ["Hourly", "0 * * * *"], ["Daily at midnight", "0 0 * * *"],
    ["Weekdays 9:00", "0 9 * * 1-5"], ["Every Sunday 3:30", "30 3 * * 0"], ["1st of month", "0 0 1 * *"],
  ];
  return (
    <div className="space-y-4">
      <Field label="Cron expression (minute hour day-of-month month day-of-week)" htmlFor="cron">
        <input id="cron" className="field font-mono text-lg" value={expr} spellCheck={false} onChange={(e) => (setExpr(e.target.value), report())} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {presets.map(([l, v]) => (
          <button key={v} type="button" className="chip hover:text-brand-600" onClick={() => setExpr(v)}>
            {l}
          </button>
        ))}
      </div>
      {res.error ? (
        <ErrorBox message={res.error} />
      ) : (
        <>
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-lg font-semibold text-brand-900 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-100">{res.text}</div>
          <Panel title="Next runs (your local time zone)">
            <ol className="space-y-1 font-mono text-sm">
              {res.runs.map((d) => (
                <li key={d.getTime()}>{d.toLocaleString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</li>
              ))}
            </ol>
          </Panel>
        </>
      )}
    </div>
  );
}

function MarkdownPreview() {
  const [md, setMd] = useState("# Hello Markdown\n\nWrite **bold**, *italic* and `code`.\n\n- Lists\n- [Links](https://example.com)\n\n| Table | Works |\n|---|---|\n| yes | ✓ |\n\n```js\nconsole.log('code blocks');\n```\n\n> Blockquotes too.");
  const [html, setHtml] = useState("");
  const report = useReportUse();
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const [{ marked }, DOMPurify] = await Promise.all([import("marked"), import("dompurify")]);
      const raw = await marked.parse(md, { gfm: true, breaks: false });
      if (!cancelled) setHtml(DOMPurify.default.sanitize(raw));
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [md]);
  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Markdown" htmlFor="md">
          <textarea id="md" className="field min-h-[420px]" value={md} onChange={(e) => (setMd(e.target.value), report())} />
        </Field>
        <div>
          <span className="label">Preview</span>
          <div className="prose-content surface min-h-[420px] overflow-auto rounded-xl px-5 py-3" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={html} label="Copy HTML" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadText(md, "document.md", "text/markdown")}>Download .md</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadText(`<!doctype html><meta charset="utf-8"><title>Document</title>\n${html}`, "document.html", "text/html")}>Download .html</button>
      </div>
    </div>
  );
}

const EntityEncoder = () => (
  <TextTransformTool
    options={[{ type: "select", name: "mode", label: "Encode", default: "minimal", options: [{ value: "minimal", label: "Only & < > \" '" }, { value: "basic", label: "All characters with named entities" }, { value: "non-ascii", label: "All non-ASCII characters" }] }]}
    transform={(t, o) => (o.mode === "minimal" ? D.htmlEntityEncodeMinimal(t) : D.htmlEntityEncode(t, o.mode as "basic"))}
    sample={'<a href="/?a=1&b=2">Café © 2026 — “quotes”</a>'}
  />
);

const EntityDecoder = () => <TextTransformTool transform={(t) => D.htmlEntityDecode(t)} sample="&lt;p&gt;Caf&eacute; &copy; 2026 &mdash; &#8220;quotes&#8221; &amp; &#x1F600;&lt;/p&gt;" />;

const JsonToYaml = () => (
  <TextTransformTool
    options={[{ type: "select", name: "indent", label: "Indentation", default: "2", options: [{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }] }]}
    transform={(t, o) => D.jsonToYaml(t, Number(o.indent))}
    sample={sampleJson}
    download={{ filename: "data.yaml", mime: "application/yaml" }}
    fileAccept=".json,application/json"
    inputLabel="JSON"
    outputLabel="YAML"
  />
);

const YamlToJson = () => (
  <TextTransformTool
    options={[{ type: "select", name: "indent", label: "Indentation", default: "2", options: [{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }, { value: "0", label: "Minified" }] }]}
    transform={(t, o) => D.yamlToJson(t, Number(o.indent))}
    sample={"name: QuicklyTools\nversion: 1\ntags:\n  - fast\n  - private\nowner:\n  id: 42\n  active: true\n"}
    download={{ filename: "data.json", mime: "application/json" }}
    fileAccept=".yaml,.yml,text/yaml"
    inputLabel="YAML"
    outputLabel="JSON"
  />
);

function DiffChecker() {
  const [a, setA] = useState("function greet(name) {\n  console.log('Hello ' + name);\n}\n");
  const [b, setB] = useState("function greet(name, greeting = 'Hello') {\n  console.log(`${greeting} ${name}`);\n}\n");
  const [ignoreWs, setIgnoreWs] = useState(false);
  const report = useReportUse();
  const parts = useMemo(() => diffLines(a, b, { ignoreWhitespace: ignoreWs }), [a, b, ignoreWs]);
  const rows = useMemo(() => {
    const out: { type: "add" | "del" | "same"; l?: number; r?: number; text: string }[] = [];
    let l = 1, r = 1;
    for (const p of parts) {
      const lines = p.value.replace(/\n$/, "").split("\n");
      for (const text of lines) {
        if (p.added) out.push({ type: "add", r: r++, text });
        else if (p.removed) out.push({ type: "del", l: l++, text });
        else out.push({ type: "same", l: l++, r: r++, text });
      }
    }
    return out;
  }, [parts]);
  const added = rows.filter((r) => r.type === "add").length;
  const removed = rows.filter((r) => r.type === "del").length;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Original" htmlFor="da">
          <textarea id="da" className="field" rows={10} value={a} spellCheck={false} onChange={(e) => setA(e.target.value)} />
        </Field>
        <Field label="Modified" htmlFor="db">
          <textarea id="db" className="field" rows={10} value={b} spellCheck={false} onChange={(e) => (setB(e.target.value), report())} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox checked={ignoreWs} onChange={setIgnoreWs} label="Ignore whitespace" />
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-emerald-600">+{added}</span>
          <span className="font-semibold text-red-600">−{removed}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadText(createTwoFilesPatch("original", "modified", a, b), "changes.patch", "text/x-diff")}>Download .patch</button>
        </div>
      </div>
      <div className="border-base max-h-[520px] overflow-auto rounded-xl border font-mono text-xs">
        {rows.map((row, i) => (
          <div key={i} className={`flex ${row.type === "add" ? "bg-emerald-50 dark:bg-emerald-950/40" : row.type === "del" ? "bg-red-50 dark:bg-red-950/40" : ""}`}>
            <span className="text-muted w-10 shrink-0 border-r border-[var(--border)] px-2 text-right select-none">{row.l ?? ""}</span>
            <span className="text-muted w-10 shrink-0 border-r border-[var(--border)] px-2 text-right select-none">{row.r ?? ""}</span>
            <span className={`w-5 shrink-0 text-center select-none ${row.type === "add" ? "text-emerald-600" : row.type === "del" ? "text-red-600" : ""}`}>{row.type === "add" ? "+" : row.type === "del" ? "−" : ""}</span>
            <span className="px-1 whitespace-pre">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const tools: Record<string, ComponentType> = {
  "json-formatter": JsonFormatter,
  "json-validator": JsonValidator,
  "json-minifier": JsonMinifier,
  "json-to-csv": JsonToCsv,
  "csv-to-json": CsvToJson,
  "csv-duplicate-remover": CsvDedupe,
  "xml-formatter": XmlFormatter,
  "html-formatter": HtmlFormatter,
  "css-minifier": CssMinifier,
  "javascript-minifier": JsMinifier,
  "base64-encoder": Base64Encoder,
  "base64-decoder": Base64Decoder,
  "url-encoder": UrlEncoder,
  "url-decoder": UrlDecoder,
  "jwt-decoder": JwtDecoder,
  "uuid-generator": UuidGenerator,
  "sha256-generator": () => <HashTool algorithm="SHA-256" />,
  "md5-generator": () => <HashTool algorithm="MD5" />,
  "regex-tester": RegexTester,
  "unix-timestamp-converter": TimestampConverter,
  "cron-expression-explainer": CronExplainer,
  "markdown-preview": MarkdownPreview,
  "html-entity-encoder": EntityEncoder,
  "html-entity-decoder": EntityDecoder,
  "json-to-yaml": JsonToYaml,
  "yaml-to-json": YamlToJson,
  "diff-checker": DiffChecker,
  "color-converter": ColorConverter,
  "hex-to-rgb": HexToRgb,
  "rgb-to-hsl": RgbToHsl,
};

export default tools;
