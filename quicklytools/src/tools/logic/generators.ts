/** Generators: secure random values, QR payload strings and web snippets. */

/** Uniform integer in [0, max) using rejection sampling (no modulo bias). */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new Error("Invalid range.");
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
  excludeAmbiguous?: boolean;
}

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
};

export function generatePassword(o: PasswordOptions): string {
  if (!Number.isInteger(o.length) || o.length < 4 || o.length > 256) throw new Error("Length must be between 4 and 256.");
  const strip = (s: string) => {
    let r = s;
    if (o.excludeSimilar) r = r.replace(/[il1Lo0O|]/g, "");
    if (o.excludeAmbiguous) r = r.replace(/[{}[\]()/\\'"`~,;:.<>]/g, "");
    return r;
  };
  const groups = (["lower", "upper", "digits", "symbols"] as const).filter((k) => o[k]).map((k) => strip(SETS[k])).filter(Boolean);
  if (groups.length === 0) throw new Error("Select at least one character set.");
  if (o.length < groups.length) throw new Error("Length is too short to include every selected character set.");
  const all = groups.join("");
  // Guarantee one character from each selected group, then fill and shuffle.
  const chars = groups.map((g) => g[secureRandomInt(g.length)]);
  while (chars.length < o.length) chars.push(all[secureRandomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function passwordPoolBits(o: PasswordOptions): number {
  let pool = 0;
  const strip = (s: string) => (o.excludeSimilar ? s.replace(/[il1Lo0O|]/g, "") : s);
  for (const k of ["lower", "upper", "digits", "symbols"] as const) if (o[k]) pool += strip(SETS[k]).length;
  return pool ? o.length * Math.log2(pool) : 0;
}

export function generatePassphrase(
  words: readonly string[],
  o: { count: number; separator: string; capitalize: boolean; addNumber: boolean },
): string {
  if (!Number.isInteger(o.count) || o.count < 3 || o.count > 20) throw new Error("Choose between 3 and 20 words.");
  const picked = Array.from({ length: o.count }, () => {
    const w = words[secureRandomInt(words.length)];
    return o.capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
  if (o.addNumber) {
    const i = secureRandomInt(picked.length);
    picked[i] = picked[i] + String(secureRandomInt(10));
  }
  return picked.join(o.separator);
}

export function randomIntegers(min: number, max: number, count: number, unique: boolean): number[] {
  if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error("Minimum and maximum must be whole numbers.");
  if (min > max) throw new Error("Minimum must not be greater than maximum.");
  if (!Number.isInteger(count) || count < 1 || count > 10000) throw new Error("Count must be between 1 and 10,000.");
  const span = max - min + 1;
  if (span > 2 ** 32) throw new Error("The range is too large (maximum span is 4,294,967,296).");
  if (unique && count > span) throw new Error(`Only ${span} unique numbers exist in this range.`);
  if (unique) {
    const seen = new Set<number>();
    const out: number[] = [];
    while (out.length < count) {
      const v = min + secureRandomInt(span);
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
    return out;
  }
  return Array.from({ length: count }, () => min + secureRandomInt(span));
}

export function randomDecimal(min: number, max: number, decimals: number): number {
  if (!(max > min)) throw new Error("Maximum must be greater than minimum.");
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const r = (buf[0] * 2 ** 21 + (buf[1] >>> 11)) / 2 ** 53;
  return Number((min + r * (max - min)).toFixed(decimals));
}

export function pickRandom<T>(items: T[], count: number, unique = true): T[] {
  if (items.length === 0) throw new Error("Add at least one item to pick from.");
  if (!Number.isInteger(count) || count < 1) throw new Error("Pick at least one item.");
  if (unique && count > items.length) throw new Error(`You can pick at most ${items.length} unique item(s).`);
  if (!unique) return Array.from({ length: count }, () => items[secureRandomInt(items.length)]);
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count; i++) out.push(pool.splice(secureRandomInt(pool.length), 1)[0]);
  return out;
}

// ---------- QR payloads ----------

/** Escapes \ ; , : " in WIFI: fields per the de-facto ZXing spec. */
const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

export function wifiPayload(o: { ssid: string; password: string; security: "WPA" | "WEP" | "nopass"; hidden: boolean }): string {
  if (!o.ssid) throw new Error("Network name (SSID) is required.");
  if (o.security !== "nopass" && !o.password) throw new Error("Enter the Wi-Fi password, or choose 'No password'.");
  if (o.security === "WPA" && o.password.length < 8) throw new Error("WPA/WPA2 passwords are at least 8 characters long.");
  let s = `WIFI:T:${o.security};S:${wifiEscape(o.ssid)};`;
  if (o.security !== "nopass") s += `P:${wifiEscape(o.password)};`;
  if (o.hidden) s += "H:true;";
  return s + ";";
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export function emailPayload(o: { to: string; subject?: string; body?: string; cc?: string }): string {
  if (!isEmail(o.to)) throw new Error("Enter a valid email address.");
  const params = new URLSearchParams();
  if (o.cc) params.set("cc", o.cc);
  if (o.subject) params.set("subject", o.subject);
  if (o.body) params.set("body", o.body);
  const q = params.toString().replace(/\+/g, "%20");
  return `mailto:${o.to.trim()}${q ? `?${q}` : ""}`;
}

export function normalizePhone(s: string): string {
  const n = s.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d{3,17}$/.test(n)) throw new Error("Enter a phone number with digits and an optional leading +.");
  return n;
}

export const phonePayload = (phone: string) => `tel:${normalizePhone(phone)}`;

export function smsPayload(phone: string, message: string): string {
  const n = normalizePhone(phone);
  return message ? `SMSTO:${n}:${message}` : `SMSTO:${n}`;
}

const vEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export interface VCardInput {
  firstName: string;
  lastName: string;
  organization?: string;
  title?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  street?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
  note?: string;
}

export function vcardPayload(v: VCardInput): string {
  if (!v.firstName && !v.lastName && !v.organization) throw new Error("Enter at least a name or an organization.");
  if (v.email && !isEmail(v.email)) throw new Error("The email address is not valid.");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${vEscape(v.lastName)};${vEscape(v.firstName)};;;`, `FN:${vEscape([v.firstName, v.lastName].filter(Boolean).join(" ") || v.organization || "")}`];
  if (v.organization) lines.push(`ORG:${vEscape(v.organization)}`);
  if (v.title) lines.push(`TITLE:${vEscape(v.title)}`);
  if (v.phone) lines.push(`TEL;TYPE=WORK,VOICE:${normalizePhone(v.phone)}`);
  if (v.mobile) lines.push(`TEL;TYPE=CELL:${normalizePhone(v.mobile)}`);
  if (v.email) lines.push(`EMAIL;TYPE=INTERNET:${v.email.trim()}`);
  if (v.website) lines.push(`URL:${v.website.trim()}`);
  if (v.street || v.city || v.region || v.postcode || v.country) {
    lines.push(`ADR;TYPE=WORK:;;${[v.street, v.city, v.region, v.postcode, v.country].map((x) => vEscape(x ?? "")).join(";")}`);
  }
  if (v.note) lines.push(`NOTE:${vEscape(v.note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// ---------- Web snippets ----------

export function buildUtmUrl(base: string, p: { source: string; medium: string; campaign: string; term?: string; content?: string; id?: string }): string {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    throw new Error("Enter a full website URL including https://");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http and https URLs can be tagged.");
  if (!p.source || !p.medium || !p.campaign) throw new Error("utm_source, utm_medium and utm_campaign are required by most analytics tools.");
  const set = (k: string, v?: string) => {
    if (v && v.trim()) url.searchParams.set(k, v.trim());
  };
  set("utm_source", p.source);
  set("utm_medium", p.medium);
  set("utm_campaign", p.campaign);
  set("utm_term", p.term);
  set("utm_content", p.content);
  set("utm_id", p.id);
  return url.toString();
}

export interface RobotsRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export function buildRobotsTxt(rules: RobotsRule[], sitemaps: string[], host?: string): string {
  const out: string[] = [];
  for (const r of rules) {
    out.push(`User-agent: ${r.userAgent.trim() || "*"}`);
    for (const a of r.allow) if (a.trim()) out.push(`Allow: ${normalizePath(a)}`);
    for (const d of r.disallow) out.push(`Disallow: ${d.trim() === "" ? "" : normalizePath(d)}`);
    if (r.allow.length === 0 && r.disallow.length === 0) out.push("Disallow:");
    if (r.crawlDelay && r.crawlDelay > 0) out.push(`Crawl-delay: ${r.crawlDelay}`);
    out.push("");
  }
  for (const s of sitemaps) if (s.trim()) out.push(`Sitemap: ${s.trim()}`);
  if (host) out.push(`Host: ${host}`);
  return out.join("\n").trim() + "\n";
}

function normalizePath(p: string): string {
  const t = p.trim();
  return t.startsWith("/") || t.startsWith("*") ? t : `/${t}`;
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface MetaTagInput {
  title: string;
  description: string;
  keywords?: string;
  author?: string;
  canonical?: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  viewport: boolean;
  charset: boolean;
  themeColor?: string;
  language?: string;
}

export function buildMetaTags(m: MetaTagInput): string {
  const out: string[] = [];
  if (m.charset) out.push('<meta charset="utf-8">');
  if (m.viewport) out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  if (m.title) out.push(`<title>${attr(m.title)}</title>`);
  if (m.description) out.push(`<meta name="description" content="${attr(m.description)}">`);
  if (m.keywords) out.push(`<meta name="keywords" content="${attr(m.keywords)}">`);
  if (m.author) out.push(`<meta name="author" content="${attr(m.author)}">`);
  out.push(`<meta name="robots" content="${m.robotsIndex ? "index" : "noindex"}, ${m.robotsFollow ? "follow" : "nofollow"}">`);
  if (m.canonical) out.push(`<link rel="canonical" href="${attr(m.canonical)}">`);
  if (m.themeColor) out.push(`<meta name="theme-color" content="${attr(m.themeColor)}">`);
  if (m.language) out.push(`<meta http-equiv="content-language" content="${attr(m.language)}">`);
  return out.join("\n");
}

export function metaLengthAdvice(title: string, description: string): string[] {
  const tips: string[] = [];
  if (title.length > 60) tips.push(`Title is ${title.length} characters; Google usually truncates after about 60.`);
  if (title.length > 0 && title.length < 15) tips.push("Title is very short; describe the page more specifically.");
  if (description.length > 160) tips.push(`Description is ${description.length} characters; aim for 120–160.`);
  if (description.length > 0 && description.length < 70) tips.push("Description is short; 120–160 characters gives search engines more to show.");
  return tips;
}

export interface OgInput {
  title: string;
  description: string;
  url: string;
  image?: string;
  imageAlt?: string;
  siteName?: string;
  type: string;
  locale?: string;
  twitterCard: "summary" | "summary_large_image";
  twitterSite?: string;
}

export function buildOpenGraph(o: OgInput): string {
  const out: string[] = [];
  const p = (prop: string, v?: string) => v && out.push(`<meta property="${prop}" content="${attr(v)}">`);
  const n = (name: string, v?: string) => v && out.push(`<meta name="${name}" content="${attr(v)}">`);
  p("og:type", o.type);
  p("og:title", o.title);
  p("og:description", o.description);
  p("og:url", o.url);
  p("og:site_name", o.siteName);
  p("og:locale", o.locale);
  p("og:image", o.image);
  p("og:image:alt", o.imageAlt);
  n("twitter:card", o.twitterCard);
  n("twitter:title", o.title);
  n("twitter:description", o.description);
  n("twitter:image", o.image);
  n("twitter:site", o.twitterSite);
  return out.join("\n");
}

export interface GradientStop {
  color: string;
  position: number;
}

export function cssGradient(type: "linear" | "radial" | "conic", angle: number, stops: GradientStop[], shape: "circle" | "ellipse" = "circle"): string {
  if (stops.length < 2) throw new Error("A gradient needs at least two color stops.");
  const s = [...stops].sort((a, b) => a.position - b.position).map((x) => `${x.color} ${Math.round(x.position)}%`).join(", ");
  if (type === "linear") return `linear-gradient(${Math.round(angle)}deg, ${s})`;
  if (type === "radial") return `radial-gradient(${shape}, ${s})`;
  return `conic-gradient(from ${Math.round(angle)}deg, ${s})`;
}

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset: boolean;
}

export function hexWithOpacity(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(opacity * 100) / 100})`;
}

export function cssBoxShadow(layers: ShadowLayer[]): string {
  if (layers.length === 0) return "none";
  return layers.map((l) => `${l.inset ? "inset " : ""}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${hexWithOpacity(l.color, l.opacity)}`).join(", ");
}

export function cssBorderRadius(r: { tl: number; tr: number; br: number; bl: number }, unit: "px" | "%" | "rem" = "px"): string {
  const v = [r.tl, r.tr, r.br, r.bl].map((x) => `${x}${x === 0 ? "" : unit}`);
  if (v.every((x) => x === v[0])) return v[0];
  if (v[0] === v[2] && v[1] === v[3]) return `${v[0]} ${v[1]}`;
  if (v[1] === v[3]) return `${v[0]} ${v[1]} ${v[2]}`;
  return v.join(" ");
}
