/** Pure developer-tool logic. Heavy libraries are imported lazily by callers where possible. */
import Papa from "papaparse";
import YAML from "yaml";
import { decodeHTML, encodeHTML, encodeNonAsciiHTML } from "entities";

// ---------- JSON ----------

export interface JsonErrorInfo {
  message: string;
  line?: number;
  column?: number;
}

/** Converts a JSON.parse error into a line/column location when possible. */
export function jsonErrorInfo(input: string, err: unknown): JsonErrorInfo {
  const message = err instanceof Error ? err.message : String(err);
  let pos: number | undefined;
  const m = message.match(/position (\d+)/i);
  if (m) pos = Number(m[1]);
  const lc = message.match(/line (\d+) column (\d+)/i);
  if (lc) return { message, line: Number(lc[1]), column: Number(lc[2]) };
  if (pos === undefined) {
    const found = findJsonErrorOffset(input);
    return found === null ? { message } : locate(input, found, message);
  }
  return locate(input, pos, message);
}

function locate(input: string, pos: number, message: string): JsonErrorInfo {
  const before = input.slice(0, pos);
  const line = before.split("\n").length;
  const column = pos - before.lastIndexOf("\n");
  return { message, line, column };
}

/**
 * Locates the offset of the first syntax error with a tiny JSON scanner. Newer V8
 * versions omit the position from some JSON.parse messages (e.g. trailing commas).
 */
export function findJsonErrorOffset(src: string): number | null {
  let i = 0;
  const ws = () => {
    while (i < src.length && " \t\n\r".includes(src[i])) i++;
  };
  const fail = (): never => {
    throw i;
  };
  const value = (): void => {
    ws();
    const c = src[i];
    if (c === "{") {
      i++;
      ws();
      if (src[i] === "}") return void i++;
      for (;;) {
        ws();
        if (src[i] !== '"') fail();
        str();
        ws();
        if (src[i] !== ":") fail();
        i++;
        value();
        ws();
        if (src[i] === ",") i++;
        else if (src[i] === "}") return void i++;
        else fail();
      }
    } else if (c === "[") {
      i++;
      ws();
      if (src[i] === "]") return void i++;
      for (;;) {
        value();
        ws();
        if (src[i] === ",") i++;
        else if (src[i] === "]") return void i++;
        else fail();
      }
    } else if (c === '"') str();
    else if (/[-0-9]/.test(c ?? "")) {
      const m = src.slice(i).match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/);
      if (!m) fail();
      i += m![0].length;
    } else if (src.startsWith("true", i)) i += 4;
    else if (src.startsWith("false", i)) i += 5;
    else if (src.startsWith("null", i)) i += 4;
    else fail();
  };
  const str = () => {
    i++;
    while (i < src.length) {
      const c = src[i];
      if (c === '"') return void i++;
      if (c === "\\") i += 2;
      else if (c < " ") fail();
      else i++;
    }
    fail();
  };
  try {
    value();
    ws();
    return i < src.length ? i : null;
  } catch (e) {
    return typeof e === "number" ? Math.min(e, src.length) : null;
  }
}

export function parseJson(input: string): unknown {
  if (input.trim() === "") throw new Error("Input is empty. Paste some JSON first.");
  try {
    return JSON.parse(input);
  } catch (e) {
    const info = jsonErrorInfo(input, e);
    throw new Error(info.line ? `Invalid JSON at line ${info.line}, column ${info.column}: ${info.message}` : `Invalid JSON: ${info.message}`);
  }
}

export function formatJson(input: string, indent: number | "tab" = 2, sortKeys = false): string {
  const value = parseJson(input);
  return JSON.stringify(sortKeys ? sortDeep(value) : value, null, indent === "tab" ? "\t" : indent);
}

export function minifyJson(input: string): string {
  return JSON.stringify(parseJson(input));
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function validateJson(input: string): { valid: true; summary: string } | { valid: false; error: JsonErrorInfo } {
  if (input.trim() === "") return { valid: false, error: { message: "Input is empty." } };
  try {
    const v = JSON.parse(input);
    const type = Array.isArray(v) ? `array with ${v.length} item(s)` : v === null ? "null" : typeof v === "object" ? `object with ${Object.keys(v).length} key(s)` : typeof v;
    return { valid: true, summary: `Valid JSON: top-level ${type}.` };
  } catch (e) {
    return { valid: false, error: jsonErrorInfo(input, e) };
  }
}

function flatten(obj: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
      else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
    }
  } else {
    out[prefix || "value"] = obj;
  }
  return out;
}

export function jsonToCsv(input: string, opts: { delimiter?: string; flattenNested?: boolean } = {}): string {
  const value = parseJson(input);
  const rows = Array.isArray(value) ? value : [value];
  if (rows.length === 0) throw new Error("The JSON array is empty, so there are no rows to convert.");
  const records = rows.map((r) => (opts.flattenNested === false && r && typeof r === "object" && !Array.isArray(r) ? r : flatten(r)));
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of records) for (const k of Object.keys(r as object)) if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
  const data = records.map((r) =>
    columns.map((c) => {
      const v = (r as Record<string, unknown>)[c];
      if (v === undefined || v === null) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    }),
  );
  return Papa.unparse({ fields: columns, data }, { delimiter: opts.delimiter ?? "," });
}

export function csvToJson(input: string, opts: { header?: boolean; dynamicTyping?: boolean; delimiter?: string } = {}): string {
  if (input.trim() === "") throw new Error("Input is empty. Paste CSV data first.");
  const result = Papa.parse(input.trim(), {
    header: opts.header ?? true,
    dynamicTyping: opts.dynamicTyping ?? true,
    skipEmptyLines: true,
    delimiter: opts.delimiter || "",
  });
  const fatal = result.errors.find((e) => e.type !== "Delimiter");
  if (fatal) throw new Error(`CSV error on row ${(fatal.row ?? 0) + 1}: ${fatal.message}`);
  return JSON.stringify(result.data, null, 2);
}

export function csvRemoveDuplicates(
  input: string,
  opts: { hasHeader?: boolean; columns?: string; caseSensitive?: boolean; trim?: boolean } = {},
): { output: string; removed: number; total: number } {
  if (input.trim() === "") throw new Error("Input is empty. Paste CSV data first.");
  const parsed = Papa.parse<string[]>(input.trim(), { skipEmptyLines: true });
  const rows = parsed.data;
  const hasHeader = opts.hasHeader ?? true;
  const header = hasHeader ? rows[0] : undefined;
  const body = hasHeader ? rows.slice(1) : rows;
  let keyIdx: number[] | null = null;
  if (opts.columns && opts.columns.trim()) {
    keyIdx = opts.columns.split(",").map((c) => {
      const name = c.trim();
      const asNum = Number(name);
      if (Number.isInteger(asNum) && asNum >= 1) return asNum - 1;
      const idx = header ? header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase()) : -1;
      if (idx < 0) throw new Error(`Column "${name}" was not found. Use a header name or a 1-based column number.`);
      return idx;
    });
  }
  const seen = new Set<string>();
  const kept: string[][] = [];
  for (const row of body) {
    let cells = keyIdx ? keyIdx.map((i) => row[i] ?? "") : row;
    if (opts.trim ?? true) cells = cells.map((c) => c.trim());
    if (!(opts.caseSensitive ?? true)) cells = cells.map((c) => c.toLowerCase());
    const key = JSON.stringify(cells);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }
  const output = Papa.unparse(header ? [header, ...kept] : kept);
  return { output, removed: body.length - kept.length, total: body.length };
}

// ---------- YAML ----------

export function jsonToYaml(input: string, indent = 2): string {
  // YAML 1.1 output quotes strings such as "yes", "on" and "no" so older parsers keep them as strings.
  return YAML.stringify(parseJson(input), { indent, version: "1.1" });
}

export function yamlToJson(input: string, indent = 2): string {
  if (input.trim() === "") throw new Error("Input is empty. Paste YAML first.");
  const docs = YAML.parseAllDocuments(input);
  const errors = docs.flatMap((d) => d.errors);
  if (errors.length) throw new Error(`Invalid YAML: ${errors[0].message}`);
  const values = docs.map((d) => d.toJS({ maxAliasCount: 100 }));
  return JSON.stringify(values.length === 1 ? values[0] : values, null, indent);
}

// ---------- XML ----------

/** Dependency-free XML pretty printer. Validates tag balance. */
export function formatXml(input: string, indentSize = 2): string {
  const src = input.trim();
  if (!src) throw new Error("Input is empty. Paste XML first.");
  const tokens = src.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<[^>]+>|[^<]+/g);
  if (!tokens) throw new Error("No XML content found.");
  const pad = " ".repeat(indentSize);
  const out: string[] = [];
  const stack: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (/^<\//.test(tok)) {
      const name = tok.slice(2, -1).trim();
      const open = stack.pop();
      if (open !== name) throw new Error(open ? `Mismatched closing tag </${name}>; expected </${open}>.` : `Unexpected closing tag </${name}>.`);
      out.push(pad.repeat(stack.length) + tok);
    } else if (/^<[^!?]/.test(tok) && !/\/>$/.test(tok)) {
      const nameMatch = tok.match(/^<([^\s/>]+)/);
      if (!nameMatch) throw new Error(`Malformed tag: ${tok.slice(0, 40)}`);
      const name = nameMatch[1];
      // Inline simple text content: <a>text</a>
      const next = tokens[i + 1];
      const after = tokens[i + 2];
      if (next && !next.startsWith("<") && after === `</${name}>`) {
        out.push(pad.repeat(stack.length) + tok + next.trim() + after);
        i += 2;
        continue;
      }
      out.push(pad.repeat(stack.length) + tok);
      stack.push(name);
    } else if (!tok.startsWith("<")) {
      const text = tok.trim();
      if (text) out.push(pad.repeat(stack.length) + text);
    } else {
      out.push(pad.repeat(stack.length) + tok);
    }
  }
  if (stack.length) throw new Error(`Unclosed tag <${stack[stack.length - 1]}>.`);
  return out.join("\n");
}

// ---------- Base64 / URL ----------

export function base64Encode(input: string, opts: { urlSafe?: boolean; lineLength?: number } = {}): string {
  return bytesToBase64(new TextEncoder().encode(input), opts);
}

export function bytesToBase64(bytes: Uint8Array, opts: { urlSafe?: boolean; lineLength?: number } = {}): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  let out = btoa(bin);
  if (opts.urlSafe) out = out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (opts.lineLength && opts.lineLength > 0) out = out.match(new RegExp(`.{1,${opts.lineLength}}`, "g"))?.join("\n") ?? out;
  return out;
}

export function base64ToBytes(input: string): Uint8Array {
  let s = input.replace(/^data:[^,]*,/, "").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (s === "") return new Uint8Array();
  if (/[^A-Za-z0-9+/=]/.test(s)) throw new Error("Input contains characters that are not valid Base64.");
  s = s.replace(/=+$/, "");
  if (s.length % 4 === 1) throw new Error("Base64 input has an invalid length.");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function base64Decode(input: string): string {
  const bytes = base64ToBytes(input);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Decoded data is binary, not UTF-8 text. Use the file download option instead.");
  }
}

export function urlEncode(input: string, mode: "component" | "uri" | "form" = "component"): string {
  if (mode === "uri") return encodeURI(input);
  const enc = encodeURIComponent(input);
  return mode === "form" ? enc.replace(/%20/g, "+") : enc;
}

export function urlDecode(input: string, plusAsSpace = true): string {
  const s = plusAsSpace ? input.replace(/\+/g, " ") : input;
  try {
    return decodeURIComponent(s);
  } catch {
    throw new Error("Input contains an invalid percent-encoded sequence (for example a lone % sign).");
  }
}

export interface ParsedUrl {
  protocol: string;
  host: string;
  pathname: string;
  params: [string, string][];
  hash: string;
}

export function parseUrlParams(input: string): ParsedUrl | null {
  try {
    const u = new URL(input);
    return { protocol: u.protocol, host: u.host, pathname: u.pathname, params: [...u.searchParams.entries()], hash: u.hash };
  } catch {
    return null;
  }
}

// ---------- HTML entities ----------

export function htmlEntityEncode(input: string, mode: "basic" | "non-ascii" = "basic"): string {
  return mode === "non-ascii" ? encodeNonAsciiHTML(input) : encodeHTML(input);
}

export function htmlEntityEncodeMinimal(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function htmlEntityDecode(input: string): string {
  return decodeHTML(input);
}

// ---------- JWT ----------

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  claims: { name: string; value: string }[];
  expired: boolean | null;
}

export function decodeJwt(token: string, now = Date.now()): DecodedJwt {
  const t = token.trim().replace(/^Bearer\s+/i, "");
  const parts = t.split(".");
  if (parts.length !== 3) throw new Error(`A JWT has 3 dot-separated parts; this input has ${parts.length}.`);
  const decodePart = (p: string, label: string) => {
    try {
      return JSON.parse(new TextDecoder().decode(base64ToBytes(p)));
    } catch {
      throw new Error(`The ${label} is not valid Base64URL-encoded JSON.`);
    }
  };
  const header = decodePart(parts[0], "header");
  const payload = decodePart(parts[1], "payload");
  const claims: { name: string; value: string }[] = [];
  const fmt = (v: unknown) => (typeof v === "number" ? `${new Date(v * 1000).toISOString()} (${v})` : String(v));
  for (const k of ["iat", "nbf", "exp"]) if (k in payload) claims.push({ name: k, value: fmt(payload[k]) });
  for (const k of ["iss", "sub", "aud", "jti"]) if (k in payload) claims.push({ name: k, value: Array.isArray(payload[k]) ? payload[k].join(", ") : String(payload[k]) });
  const expired = typeof payload.exp === "number" ? payload.exp * 1000 < now : null;
  return { header, payload, signature: parts[2], claims, expired };
}

// ---------- IDs & hashes ----------

export function uuidV4(): string {
  return crypto.randomUUID();
}

/** RFC 9562 UUIDv7: 48-bit Unix ms timestamp + random bits. Sortable by creation time. */
export function uuidV7(nowMs = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let ts = BigInt(nowMs);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function shaDigest(algorithm: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512", data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest(algorithm, bytes as BufferSource));
}

export async function hmacSha256(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message)));
}

// ---------- Regex ----------

export interface RegexMatch {
  index: number;
  match: string;
  groups: (string | undefined)[];
  named?: Record<string, string | undefined>;
}

export function runRegex(pattern: string, flags: string, text: string, limit = 1000): { matches: RegexMatch[]; truncated: boolean } {
  if (pattern === "") return { matches: [], truncated: false };
  if (/[^dgimsuyv]/.test(flags)) throw new Error(`Unknown flag in "${flags}". Allowed flags: d g i m s u v y.`);
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  } catch (e) {
    throw new Error((e as Error).message);
  }
  const matches: RegexMatch[] = [];
  for (const m of text.matchAll(re)) {
    matches.push({ index: m.index ?? 0, match: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : undefined });
    if (matches.length >= limit) return { matches, truncated: true };
    if (!flags.includes("g")) break;
  }
  return { matches, truncated: false };
}

// ---------- Timestamps ----------

export function parseTimestamp(input: string): { date: Date; unit: "seconds" | "milliseconds" | "microseconds" } {
  const s = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error("Enter a numeric Unix timestamp, e.g. 1700000000.");
  const n = Number(s);
  const abs = Math.abs(n);
  let unit: "seconds" | "milliseconds" | "microseconds" = "seconds";
  let ms = n * 1000;
  if (abs >= 1e14) {
    unit = "microseconds";
    ms = n / 1000;
  } else if (abs >= 1e11) {
    unit = "milliseconds";
    ms = n;
  }
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) throw new Error("Timestamp is out of the supported date range.");
  return { date, unit };
}

export function relativeTime(date: Date, now = new Date()): string {
  const diff = (date.getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [u, s] of units) if (Math.abs(diff) >= s || u === "second") return rtf.format(Math.round(diff / s), u);
  return "";
}

// ---------- Cron ----------

const CRON_RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const CRON_MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

export interface ParsedCron {
  fields: Set<number>[];
  domStar: boolean;
  dowStar: boolean;
  normalized: string;
}

export function parseCron(expr: string): ParsedCron {
  let e = expr.trim().toLowerCase();
  if (CRON_MACROS[e]) e = CRON_MACROS[e];
  const parts = e.split(/\s+/);
  if (parts.length !== 5) throw new Error(`Standard cron has 5 fields (minute hour day month weekday); found ${parts.length}.`);
  const names = [null, null, null, MONTH_NAMES, DAY_NAMES];
  const fields = parts.map((part, idx) => {
    const [lo, hi] = CRON_RANGES[idx];
    const set = new Set<number>();
    for (const item of part.split(",")) {
      const [rangePart, stepPart] = item.split("/");
      const step = stepPart === undefined ? 1 : Number(stepPart);
      if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step "${stepPart}" in field ${idx + 1}.`);
      const toNum = (s: string) => {
        const list = names[idx];
        if (list && list.includes(s)) return list.indexOf(s) + (idx === 3 ? 1 : 0);
        const n = Number(s);
        if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`Value "${s}" is out of range ${lo}-${hi} in field ${idx + 1}.`);
        return n;
      };
      let start: number, end: number;
      if (rangePart === "*") [start, end] = [lo, hi];
      else if (rangePart.includes("-")) {
        const [a, b] = rangePart.split("-");
        [start, end] = [toNum(a), toNum(b)];
        if (start > end) throw new Error(`Range "${rangePart}" is reversed.`);
      } else {
        start = toNum(rangePart);
        end = stepPart === undefined ? start : hi;
      }
      for (let v = start; v <= end; v += step) set.add(idx === 4 && v === 7 ? 0 : v);
    }
    return set;
  });
  return { fields, domStar: parts[2] === "*", dowStar: parts[4] === "*", normalized: parts.join(" ") };
}

/** Next run times in the given time zone offset (local time of the runtime). */
export function nextCronRuns(expr: string, count = 5, from = new Date()): Date[] {
  const { fields, domStar, dowStar } = parseCron(expr);
  const [min, hour, dom, mon, dow] = fields;
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const out: Date[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 600000) {
    if (!mon.has(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    const domOk = dom.has(d.getDate());
    const dowOk = dow.has(d.getDay());
    const dayOk = domStar && dowStar ? true : domStar ? dowOk : dowStar ? domOk : domOk || dowOk;
    if (!dayOk) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hour.has(d.getHours())) {
      d.setHours(d.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!min.has(d.getMinutes())) {
      d.setMinutes(d.getMinutes() + 1, 0, 0);
      continue;
    }
    out.push(new Date(d.getTime()));
    d.setMinutes(d.getMinutes() + 1);
  }
  return out;
}

// ---------- Minifiers (lightweight, dependency-free) ----------

/** Conservative CSS minifier: removes comments/whitespace; keeps strings intact. */
export function minifyCssBasic(css: string): string {
  const strings: string[] = [];
  let out = css.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (m) => {
    strings.push(m);
    return `\u0000${strings.length - 1}\u0000`;
  });
  out = out
    .replace(/\/\*(?!!)[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};:,>~+])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => strings[Number(i)]);
}

export function sizeReport(before: string, after: string) {
  const a = new TextEncoder().encode(before).length;
  const b = new TextEncoder().encode(after).length;
  return { before: a, after: b, saved: a - b, percent: a ? ((a - b) / a) * 100 : 0 };
}
