/** Unit, number-system and date/time conversions. */
import { CalcError } from "./finance";

// ---------- Temperature ----------

export type TempUnit = "C" | "F" | "K" | "R";

export function convertTemperature(value: number, from: TempUnit): Record<TempUnit, number> {
  if (!Number.isFinite(value)) throw new CalcError("Enter a temperature.");
  let c: number;
  switch (from) {
    case "C": c = value; break;
    case "F": c = ((value - 32) * 5) / 9; break;
    case "K": c = value - 273.15; break;
    case "R": c = ((value - 491.67) * 5) / 9; break;
  }
  if (c < -273.15 - 1e-9) throw new CalcError("That is below absolute zero (−273.15 °C), which is physically impossible.");
  return { C: c, F: (c * 9) / 5 + 32, K: c + 273.15, R: ((c + 273.15) * 9) / 5 };
}

// ---------- Data storage ----------

export const DATA_UNITS = [
  { id: "bit", label: "Bits (b)", bytes: 1 / 8 },
  { id: "B", label: "Bytes (B)", bytes: 1 },
  { id: "KB", label: "Kilobytes (KB, 1000)", bytes: 1e3 },
  { id: "MB", label: "Megabytes (MB)", bytes: 1e6 },
  { id: "GB", label: "Gigabytes (GB)", bytes: 1e9 },
  { id: "TB", label: "Terabytes (TB)", bytes: 1e12 },
  { id: "PB", label: "Petabytes (PB)", bytes: 1e15 },
  { id: "KiB", label: "Kibibytes (KiB, 1024)", bytes: 1024 },
  { id: "MiB", label: "Mebibytes (MiB)", bytes: 1024 ** 2 },
  { id: "GiB", label: "Gibibytes (GiB)", bytes: 1024 ** 3 },
  { id: "TiB", label: "Tebibytes (TiB)", bytes: 1024 ** 4 },
  { id: "PiB", label: "Pebibytes (PiB)", bytes: 1024 ** 5 },
  { id: "Kb", label: "Kilobits (Kb)", bytes: 1e3 / 8 },
  { id: "Mb", label: "Megabits (Mb)", bytes: 1e6 / 8 },
  { id: "Gb", label: "Gigabits (Gb)", bytes: 1e9 / 8 },
] as const;

export function convertData(value: number, fromId: string) {
  const from = DATA_UNITS.find((u) => u.id === fromId);
  if (!from) throw new CalcError("Unknown unit.");
  if (!Number.isFinite(value) || value < 0) throw new CalcError("Enter a size of zero or more.");
  const bytes = value * from.bytes;
  return DATA_UNITS.map((u) => ({ id: u.id, label: u.label, value: bytes / u.bytes }));
}

export function humanBytes(bytes: number, binary = false): string {
  const base = binary ? 1024 : 1000;
  const units = binary ? ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] : ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let v = bytes;
  while (Math.abs(v) >= base && i < units.length - 1) {
    v /= base;
    i++;
  }
  return `${i === 0 ? v : v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

// ---------- CSS units ----------

export type CssUnit = "px" | "rem" | "em" | "pt" | "pc" | "in" | "cm" | "mm" | "vw" | "vh" | "%";

export function convertCssUnit(
  value: number,
  from: CssUnit,
  ctx: { rootFontSize: number; parentFontSize: number; viewportWidth: number; viewportHeight: number; containerSize: number },
): Record<CssUnit, number> {
  if (!Number.isFinite(value)) throw new CalcError("Enter a number.");
  for (const [k, v] of Object.entries(ctx)) if (!(v > 0)) throw new CalcError(`${k} must be greater than zero.`);
  const toPx: Record<CssUnit, number> = {
    px: 1,
    rem: ctx.rootFontSize,
    em: ctx.parentFontSize,
    pt: 96 / 72,
    pc: 16,
    in: 96,
    cm: 96 / 2.54,
    mm: 96 / 25.4,
    vw: ctx.viewportWidth / 100,
    vh: ctx.viewportHeight / 100,
    "%": ctx.containerSize / 100,
  };
  const px = value * toPx[from];
  return Object.fromEntries(Object.entries(toPx).map(([u, f]) => [u, px / f])) as Record<CssUnit, number>;
}

export function pxToRem(px: number, base = 16): number {
  if (!(base > 0)) throw new CalcError("Base font size must be greater than zero.");
  return px / base;
}

export function remToPx(rem: number, base = 16): number {
  if (!(base > 0)) throw new CalcError("Base font size must be greater than zero.");
  return rem * base;
}

/** Trims floating point noise: 0.30000000000000004 -> "0.3". */
export function fmtNum(v: number, maxDecimals = 6): string {
  if (!Number.isFinite(v)) return "—";
  return Number(v.toFixed(maxDecimals)).toString();
}

// ---------- Number bases ----------

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export function parseInBase(input: string, base: number): bigint {
  if (!Number.isInteger(base) || base < 2 || base > 36) throw new CalcError("Base must be between 2 and 36.");
  let s = input.trim().toLowerCase().replace(/[_\s]/g, "");
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (base === 16) s = s.replace(/^0x/, "");
  if (base === 2) s = s.replace(/^0b/, "");
  if (base === 8) s = s.replace(/^0o/, "");
  if (!s) throw new CalcError("Enter a number.");
  let result = 0n;
  const b = BigInt(base);
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) throw new CalcError(`"${ch}" is not a valid digit in base ${base}.`);
    result = result * b + BigInt(d);
  }
  return negative ? -result : result;
}

export function formatInBase(value: bigint, base: number): string {
  if (base < 2 || base > 36) throw new CalcError("Base must be between 2 and 36.");
  return value.toString(base);
}

export function convertBase(input: string, fromBase: number) {
  const v = parseInBase(input, fromBase);
  return { binary: v.toString(2), octal: v.toString(8), decimal: v.toString(10), hex: v.toString(16).toUpperCase(), value: v };
}

export function groupDigits(s: string, size: number, sep = " "): string {
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const out = body.replace(new RegExp(`\\B(?=(.{${size}})+(?!.))`, "g"), sep);
  return neg ? `-${out}` : out;
}

export type BinaryOp = "+" | "-" | "*" | "/" | "%" | "AND" | "OR" | "XOR" | "<<" | ">>";

export function binaryCalc(a: string, b: string, op: BinaryOp) {
  const x = parseInBase(a, 2);
  const y = parseInBase(b, 2);
  let r: bigint;
  switch (op) {
    case "+": r = x + y; break;
    case "-": r = x - y; break;
    case "*": r = x * y; break;
    case "/":
      if (y === 0n) throw new CalcError("Division by zero.");
      r = x / y;
      break;
    case "%":
      if (y === 0n) throw new CalcError("Division by zero.");
      r = x % y;
      break;
    case "AND": r = x & y; break;
    case "OR": r = x | y; break;
    case "XOR": r = x ^ y; break;
    case "<<":
      if (y > 4096n) throw new CalcError("Shift amount is too large.");
      r = x << y;
      break;
    case ">>": r = x >> y; break;
  }
  return { binary: r.toString(2), decimal: r.toString(10), hex: r.toString(16).toUpperCase(), octal: r.toString(8) };
}

// ---------- Roman numerals ----------

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new CalcError("Standard Roman numerals cover whole numbers from 1 to 3999.");
  let out = "";
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

export function fromRoman(input: string): number {
  const s = input.trim().toUpperCase();
  if (!/^[MDCLXVI]+$/.test(s)) throw new CalcError("Roman numerals may only use the letters I, V, X, L, C, D and M.");
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN.find(([, sym]) => sym === s[i])![0];
    const next = i + 1 < s.length ? ROMAN.find(([, sym]) => sym === s[i + 1])![0] : 0;
    total += v < next ? -v : v;
  }
  if (toRoman(total) !== s) throw new CalcError(`"${input}" is not a valid standard Roman numeral. Did you mean ${toRoman(total)}?`);
  return total;
}

// ---------- Aspect ratio ----------

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

export function aspectRatio(width: number, height: number) {
  if (!(width > 0) || !(height > 0)) throw new CalcError("Width and height must be greater than zero.");
  const g = gcd(width, height);
  return { ratio: `${Math.round(width) / g}:${Math.round(height) / g}`, decimal: width / height };
}

export function scaleToRatio(rw: number, rh: number, known: { width?: number; height?: number }) {
  if (!(rw > 0) || !(rh > 0)) throw new CalcError("Ratio values must be greater than zero.");
  if (known.width && known.width > 0) return { width: known.width, height: (known.width * rh) / rw };
  if (known.height && known.height > 0) return { width: (known.height * rw) / rh, height: known.height };
  throw new CalcError("Enter a width or a height to scale.");
}

// ---------- Dates ----------

export function parseDateInput(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new CalcError("Enter a date in YYYY-MM-DD format.");
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) throw new CalcError(`${s} is not a real calendar date.`);
  return d;
}

function addMonthsClamped(d: Date, months: number): Date {
  const y = d.getFullYear(), m = d.getMonth() + months;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last));
}

/** Calendar difference in years, months and days (a <= b). Month-end dates clamp (Jan 31 + 1 month = Feb 28/29). */
export function calendarDiff(a: Date, b: Date) {
  let sign = 1;
  if (a > b) {
    [a, b] = [b, a];
    sign = -1;
  }
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (addMonthsClamped(start, months) > end) months--;
  const anchor = addMonthsClamped(start, months);
  const dayMs = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((dayMs(end) - dayMs(anchor)) / 86400000);
  const totalDays = Math.round((dayMs(end) - dayMs(start)) / 86400000);
  return { years: Math.floor(months / 12), months: months % 12, days, totalDays, totalWeeks: totalDays / 7, sign };
}

export function age(birth: Date, on: Date = new Date()) {
  if (birth > on) throw new CalcError("Date of birth is in the future.");
  const diff = calendarDiff(birth, on);
  let next = new Date(on.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < new Date(on.getFullYear(), on.getMonth(), on.getDate())) next = new Date(on.getFullYear() + 1, birth.getMonth(), birth.getDate());
  const daysToBirthday = calendarDiff(new Date(on.getFullYear(), on.getMonth(), on.getDate()), next).totalDays;
  return { ...diff, totalMonths: diff.years * 12 + diff.months, daysToBirthday, weekdayBorn: birth.toLocaleDateString("en-US", { weekday: "long" }) };
}

export function businessDaysBetween(a: Date, b: Date): number {
  let start = a, end = b;
  if (start > end) [start, end] = [end, start];
  let count = 0;
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (d < end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function parseTimeOfDay(s: string): number {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new CalcError("Enter a time as HH:MM or HH:MM:SS.");
  const [h, mi, se] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (h > 23 || mi > 59 || se > 59) throw new CalcError(`${s} is not a valid time.`);
  return h * 3600 + mi * 60 + se;
}

export function timeDuration(start: string, end: string, overnight = true) {
  const a = parseTimeOfDay(start);
  let b = parseTimeOfDay(end);
  if (b < a) {
    if (!overnight) throw new CalcError("End time is before start time.");
    b += 86400;
  }
  const secs = b - a;
  return { seconds: secs, hours: Math.floor(secs / 3600), minutes: Math.floor((secs % 3600) / 60), secs: secs % 60, decimalHours: secs / 3600 };
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.abs(Math.round(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ---------- Password entropy ----------

export function passwordEntropy(pw: string) {
  if (!pw) return { bits: 0, poolSize: 0, length: 0, strength: "None", crackTime: "instant", warnings: [] as string[] };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9\s]/.test(pw) && /[\x20-\x7e]/.test(pw.replace(/[A-Za-z0-9]/g, ""))) pool += 33;
  if (/\s/.test(pw)) pool += 1;
  if (/[^\x00-\x7f]/.test(pw)) pool += 100;
  const length = Array.from(pw).length;
  let bits = length * Math.log2(pool);
  const warnings: string[] = [];
  if (/(.)\1{2,}/.test(pw)) {
    warnings.push("Repeated characters (e.g. 'aaa') make passwords easier to guess.");
    bits *= 0.85;
  }
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|wert|asdf|zxcv)/i.test(pw)) {
    warnings.push("Contains a common sequence such as '1234' or 'qwerty'.");
    bits *= 0.8;
  }
  if (/^(password|letmein|welcome|admin|qwerty|iloveyou|monkey|dragon|football|baseball)/i.test(pw)) {
    warnings.push("Starts with one of the most common passwords.");
    bits = Math.min(bits, 10);
  }
  if (length < 12) warnings.push("Use at least 12 characters; 16 or more is better.");
  const strength = bits < 28 ? "Very weak" : bits < 36 ? "Weak" : bits < 60 ? "Reasonable" : bits < 80 ? "Strong" : "Very strong";
  // Offline attack at 10 billion guesses per second; average case = half the space.
  const seconds = 2 ** bits / 2 / 1e10;
  return { bits, poolSize: pool, length, strength, crackTime: humanDuration(seconds), warnings };
}

export function humanDuration(seconds: number): string {
  if (seconds < 1) return "less than a second";
  const units: [string, number][] = [["century", 3153600000], ["year", 31536000], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]];
  for (const [name, s] of units) {
    if (seconds >= s) {
      const v = seconds / s;
      if (name === "century" && v > 1e6) return "millions of centuries or more";
      const n = Math.floor(v);
      return `${n.toLocaleString("en-US")} ${name === "century" ? (n === 1 ? "century" : "centuries") : n === 1 ? name : name + "s"}`;
    }
  }
  return "less than a second";
}
