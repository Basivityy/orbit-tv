/** Color parsing and conversion. All channels: r,g,b 0-255; h 0-360; s,l,v 0-100; alpha 0-1. */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

export function parseHex(input: string): RGBA {
  let h = input.trim().replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(h) || ![3, 4, 6, 8].includes(h.length)) {
    throw new Error(`"${input}" is not a valid hex color. Use #RGB, #RGBA, #RRGGBB or #RRGGBBAA.`);
  }
  if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? round(n(6) / 255, 3) : 1 };
}

export function rgbToHex({ r, g, b, a }: RGBA, opts: { uppercase?: boolean; includeAlpha?: boolean } = {}): string {
  const hx = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  let out = `#${hx(r)}${hx(g)}${hx(b)}`;
  if (opts.includeAlpha || a < 1) out += a < 1 || opts.includeAlpha ? hx(a * 255) : "";
  return opts.uppercase ? out.toUpperCase() : out;
}

export function rgbToHsl({ r, g, b, a }: RGBA) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h: round(h, 1), s: round(s * 100, 1), l: round(l * 100, 1), a };
}

export function hslToRgb(h: number, s: number, l: number, a = 1): RGBA {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return { r: v, g: v, b: v, a };
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: Math.round(hue(hh + 1 / 3) * 255), g: Math.round(hue(hh) * 255), b: Math.round(hue(hh - 1 / 3) * 255), a };
}

export function rgbToHsv({ r, g, b }: RGBA) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  const { h } = rgbToHsl({ r, g, b, a: 1 });
  return { h, s: round(max === 0 ? 0 : (d / max) * 100, 1), v: round(max * 100, 1) };
}

export function rgbToCmyk({ r, g, b }: RGBA) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: round(((1 - rn - k) / (1 - k)) * 100, 1),
    m: round(((1 - gn - k) / (1 - k)) * 100, 1),
    y: round(((1 - bn - k) / (1 - k)) * 100, 1),
    k: round(k * 100, 1),
  };
}

const NAMED: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", yellow: "#ffff00",
  cyan: "#00ffff", aqua: "#00ffff", magenta: "#ff00ff", fuchsia: "#ff00ff", gray: "#808080", grey: "#808080",
  silver: "#c0c0c0", maroon: "#800000", olive: "#808000", lime: "#00ff00", navy: "#000080", purple: "#800080",
  teal: "#008080", orange: "#ffa500", pink: "#ffc0cb", brown: "#a52a2a", gold: "#ffd700", indigo: "#4b0082",
  violet: "#ee82ee", coral: "#ff7f50", salmon: "#fa8072", tomato: "#ff6347", crimson: "#dc143c", khaki: "#f0e68c",
  transparent: "#00000000",
};

/** Parses hex, rgb()/rgba(), hsl()/hsla() and basic CSS named colors. */
export function parseColor(input: string): RGBA {
  const s = input.trim().toLowerCase();
  if (!s) throw new Error("Enter a color value.");
  if (NAMED[s]) return parseHex(NAMED[s]);
  if (s.startsWith("#") || /^[0-9a-f]{3,8}$/.test(s)) return parseHex(s);
  const fn = s.match(/^(rgba?|hsla?)\(\s*([^)]*)\)$/);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) throw new Error(`Expected 3 or 4 values inside ${fn[1]}().`);
    const alpha = parts[3] !== undefined ? (parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
    if (Number.isNaN(alpha)) throw new Error("Invalid alpha value.");
    if (fn[1].startsWith("rgb")) {
      const ch = parts.slice(0, 3).map((p) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p)));
      if (ch.some((v) => Number.isNaN(v) || v < 0 || v > 255)) throw new Error("RGB channels must be between 0 and 255.");
      return { r: Math.round(ch[0]), g: Math.round(ch[1]), b: Math.round(ch[2]), a: clamp(alpha, 0, 1) };
    }
    const h = parseFloat(parts[0]);
    const sat = parseFloat(parts[1]);
    const l = parseFloat(parts[2]);
    if ([h, sat, l].some(Number.isNaN)) throw new Error("Invalid HSL values.");
    if (sat < 0 || sat > 100 || l < 0 || l > 100) throw new Error("Saturation and lightness must be between 0% and 100%.");
    return hslToRgb(h, sat, l, clamp(alpha, 0, 1));
  }
  throw new Error(`Could not recognise "${input}". Try #1e90ff, rgb(30,144,255) or hsl(210,100%,56%).`);
}

export function formatRgb(c: RGBA): string {
  return c.a < 1 ? `rgba(${c.r}, ${c.g}, ${c.b}, ${round(c.a, 3)})` : `rgb(${c.r}, ${c.g}, ${c.b})`;
}

export function formatHsl(c: RGBA): string {
  const { h, s, l } = rgbToHsl(c);
  return c.a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${round(c.a, 3)})` : `hsl(${h}, ${s}%, ${l}%)`;
}

export function relativeLuminance({ r, g, b }: RGBA): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: RGBA, b: RGBA): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return round((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05), 2);
}

export function allFormats(c: RGBA) {
  const hsl = rgbToHsl(c);
  const hsv = rgbToHsv(c);
  const cmyk = rgbToCmyk(c);
  return {
    hex: rgbToHex(c),
    rgb: formatRgb(c),
    hsl: formatHsl(c),
    hsv: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`,
    cmyk: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
    hslValues: hsl,
    contrastWhite: contrastRatio(c, { r: 255, g: 255, b: 255, a: 1 }),
    contrastBlack: contrastRatio(c, { r: 0, g: 0, b: 0, a: 1 }),
  };
}

export function randomColor(rnd: () => number = Math.random): RGBA {
  return { r: Math.floor(rnd() * 256), g: Math.floor(rnd() * 256), b: Math.floor(rnd() * 256), a: 1 };
}

/** Harmonious palette from a base color. */
export function palette(base: RGBA, scheme: "analogous" | "complementary" | "triadic" | "monochrome"): RGBA[] {
  const { h, s, l } = rgbToHsl(base);
  switch (scheme) {
    case "analogous":
      return [-30, -15, 0, 15, 30].map((d) => hslToRgb(h + d, s, l));
    case "complementary":
      return [hslToRgb(h, s, l), hslToRgb(h + 180, s, l), hslToRgb(h, s, clamp(l + 20, 0, 95)), hslToRgb(h + 180, s, clamp(l - 20, 5, 100))];
    case "triadic":
      return [0, 120, 240].map((d) => hslToRgb(h + d, s, l));
    case "monochrome":
      return [-30, -15, 0, 15, 30].map((d) => hslToRgb(h, s, clamp(l + d, 3, 97)));
  }
}
