/** Pure text-processing functions used by the text tools. No DOM access. */

export const MAX_TEXT_LENGTH = 5_000_000;

export function assertTextSize(text: string): void {
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Input is too large (${text.length.toLocaleString("en-US")} characters). The limit is 5,000,000 characters.`);
  }
}

const segmenterCache = new Map<string, Intl.Segmenter>();
function segmenter(granularity: "grapheme" | "word" | "sentence"): Intl.Segmenter | null {
  if (typeof Intl === "undefined" || !("Segmenter" in Intl)) return null;
  let s = segmenterCache.get(granularity);
  if (!s) {
    s = new Intl.Segmenter("en", { granularity });
    segmenterCache.set(granularity, s);
  }
  return s;
}

/** Splits into user-perceived characters (emoji and combining marks count as one). */
export function graphemes(text: string): string[] {
  const seg = segmenter("grapheme");
  if (!seg) return Array.from(text);
  return Array.from(seg.segment(text), (s) => s.segment);
}

export function countWords(text: string): number {
  const seg = segmenter("word");
  if (seg) {
    let n = 0;
    for (const s of seg.segment(text)) if (s.isWordLike) n++;
    return n;
  }
  const m = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

export function countCharacters(text: string) {
  const chars = graphemes(text).length;
  const noSpaces = graphemes(text.replace(/\s+/gu, "")).length;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const digits = (text.match(/\p{N}/gu) || []).length;
  const spaces = (text.match(/\s/gu) || []).length;
  const punctuation = (text.match(/\p{P}/gu) || []).length;
  const bytes = new TextEncoder().encode(text).length;
  return { chars, noSpaces, letters, digits, spaces, punctuation, bytes, codeUnits: text.length };
}

export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Abbreviations such as "e.g." and decimals like 3.14 should not end a sentence.
  const cleaned = trimmed
    .replace(/\b(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof|sr|jr|st|no|fig|approx)\./gi, (m) => m.replace(/\./g, "§"))
    .replace(/(\d)\.(\d)/g, "$1§$2");
  const parts = cleaned.split(/(?<=[.!?…]+["'”’)\]]*)\s+|\n{2,}/u).filter((p) => /[\p{L}\p{N}]/u.test(p));
  return parts.length;
}

export function countParagraphs(text: string): number {
  return text
    .split(/\r?\n\s*\r?\n/)
    .filter((p) => p.trim().length > 0).length;
}

export function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split(/\r\n|\r|\n/);
}

export function countLines(text: string) {
  const lines = splitLines(text);
  const nonEmpty = lines.filter((l) => l.trim() !== "").length;
  return { total: lines.length, nonEmpty, empty: lines.length - nonEmpty };
}

export function readingTime(text: string, wordsPerMinute = 238, speakingWpm = 150) {
  if (!(wordsPerMinute > 0) || !(speakingWpm > 0)) throw new Error("Words per minute must be greater than zero.");
  const words = countWords(text);
  return {
    words,
    readingMinutes: words / wordsPerMinute,
    speakingMinutes: words / speakingWpm,
  };
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0 sec";
  const totalSeconds = Math.round(minutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h} hr ${m} min`;
  if (m > 0) return s ? `${m} min ${s} sec` : `${m} min`;
  return `${s} sec`;
}

export const toUpperCase = (t: string) => t.toUpperCase();
export const toLowerCase = (t: string) => t.toLowerCase();

const SMALL_WORDS = new Set(
  "a an and as at but by en for from if in into nor of on onto or per so the to up via vs with yet".split(" "),
);

/** Title case following common (AP/Chicago-like) rules: small words stay lowercase except first/last. */
export function toTitleCase(text: string, style: "standard" | "all" = "standard"): string {
  return text
    .split(/(\r?\n)/)
    .map((line) => {
      const tokens = line.split(/(\s+)/);
      const wordIdx = tokens.map((t, i) => (/\S/.test(t) ? i : -1)).filter((i) => i >= 0);
      const first = wordIdx[0];
      const last = wordIdx[wordIdx.length - 1];
      return tokens
        .map((tok, i) => {
          if (!/\S/.test(tok)) return tok;
          // Keep words that already contain inner capitals (iPhone, NASA, McDonald).
          if (/[a-z]/.test(tok) && /[A-Z]/.test(tok.slice(1))) return tok;
          if (/^[A-Z0-9]{2,}$/.test(tok)) return tok;
          const lower = tok.toLowerCase();
          const bare = lower.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
          const prevEndsSentence = i > 0 && /[:.!?]$/.test(tokens[i - 2] ?? "");
          if (style === "standard" && SMALL_WORDS.has(bare) && i !== first && i !== last && !prevEndsSentence) {
            return lower;
          }
          return lower
            .split("-")
            .map((part) => part.replace(/\p{L}/u, (c) => c.toUpperCase()))
            .join("-");
        })
        .join("");
    })
    .join("");
}

export function toSentenceCase(text: string): string {
  return text.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (m) => m.toUpperCase());
}

export function removeDuplicateLines(
  text: string,
  opts: { caseSensitive?: boolean; trim?: boolean; keepEmpty?: boolean } = {},
): { output: string; removed: number } {
  const { caseSensitive = true, trim = true, keepEmpty = false } = opts;
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const line of splitLines(text)) {
    let key = trim ? line.trim() : line;
    if (!caseSensitive) key = key.toLowerCase();
    if (key === "" && keepEmpty) {
      out.push(line);
      continue;
    }
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    out.push(line);
  }
  return { output: out.join("\n"), removed };
}

export function removeEmptyLines(text: string, treatWhitespaceAsEmpty = true): { output: string; removed: number } {
  const lines = splitLines(text);
  const kept = lines.filter((l) => (treatWhitespaceAsEmpty ? l.trim() !== "" : l !== ""));
  return { output: kept.join("\n"), removed: lines.length - kept.length };
}

export type SortMode = "az" | "za" | "natural" | "numeric" | "length" | "length-desc" | "reverse" | "shuffle";

export function sortLines(
  text: string,
  mode: SortMode = "az",
  opts: { caseSensitive?: boolean; random?: () => number } = {},
): string {
  const lines = splitLines(text);
  const collator = new Intl.Collator("en", {
    sensitivity: opts.caseSensitive ? "case" : "base",
    numeric: mode === "natural",
  });
  const num = (s: string) => {
    const m = s.match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY;
  };
  switch (mode) {
    case "az":
    case "natural":
      return [...lines].sort(collator.compare).join("\n");
    case "za":
      return [...lines].sort((a, b) => collator.compare(b, a)).join("\n");
    case "numeric":
      return [...lines].sort((a, b) => num(a) - num(b) || collator.compare(a, b)).join("\n");
    case "length":
      return [...lines].sort((a, b) => a.length - b.length || collator.compare(a, b)).join("\n");
    case "length-desc":
      return [...lines].sort((a, b) => b.length - a.length || collator.compare(a, b)).join("\n");
    case "reverse":
      return [...lines].reverse().join("\n");
    case "shuffle": {
      const rnd = opts.random ?? secureRandom;
      const arr = [...lines];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.join("\n");
    }
  }
}

export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

export function reverseText(text: string, mode: "characters" | "words" | "lines" | "each-word" = "characters"): string {
  switch (mode) {
    case "characters":
      return graphemes(text).reverse().join("");
    case "words":
      return splitLines(text)
        .map((l) => l.split(/(\s+)/).reverse().join(""))
        .join("\n");
    case "lines":
      return splitLines(text).reverse().join("\n");
    case "each-word":
      return text.replace(/\S+/g, (w) => graphemes(w).reverse().join(""));
  }
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findAndReplace(
  text: string,
  find: string,
  replacement: string,
  opts: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean } = {},
): { output: string; count: number } {
  if (find === "") return { output: text, count: 0 };
  let source = opts.regex ? find : escapeRegExp(find);
  if (opts.wholeWord) source = `\\b(?:${source})\\b`;
  let re: RegExp;
  try {
    re = new RegExp(source, `g${opts.caseSensitive ? "" : "i"}u`);
  } catch (e) {
    throw new Error(`Invalid regular expression: ${(e as Error).message}`);
  }
  let count = 0;
  const output = text.replace(re, (...args) => {
    count++;
    if (!opts.regex) return replacement;
    // Support $1..$9 and $& in regex mode.
    const groups = args.slice(1, -2) as string[];
    return replacement.replace(/\$(\d|&)/g, (_, g) => (g === "&" ? args[0] : (groups[Number(g) - 1] ?? "")));
  });
  return { output, count };
}

export function removeExtraSpaces(
  text: string,
  opts: { trimLines?: boolean; collapseBlankLines?: boolean; tabsToSpaces?: boolean } = {},
): string {
  const { trimLines = true, collapseBlankLines = true, tabsToSpaces = true } = opts;
  let out = text.replace(/\r\n?/g, "\n");
  if (tabsToSpaces) out = out.replace(/\t/g, " ");
  out = out.replace(/[   -   　]{2,}/g, " ");
  if (trimLines) out = out.split("\n").map((l) => l.trim()).join("\n");
  if (collapseBlankLines) out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

/** URL slug: lowercase ASCII, accents stripped, words joined by a separator. */
export function slugify(text: string, opts: { separator?: "-" | "_"; maxLength?: number; lowercase?: boolean } = {}): string {
  const { separator = "-", maxLength = 0, lowercase = true } = opts;
  let s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[æÆ]/g, "ae")
    .replace(/[øØ]/g, "o")
    .replace(/[đĐ]/g, "d")
    .replace(/[łŁ]/g, "l")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "");
  if (lowercase) s = s.toLowerCase();
  s = s
    .replace(/[^A-Za-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}{2,}`, "g"), separator)
    .replace(new RegExp(`^\\${separator}|\\${separator}$`, "g"), "");
  if (maxLength > 0 && s.length > maxLength) {
    s = s.slice(0, maxLength);
    const cut = s.lastIndexOf(separator);
    if (cut > maxLength * 0.6) s = s.slice(0, cut);
    s = s.replace(new RegExp(`\\${separator}$`), "");
  }
  return s;
}

const LOREM_WORDS = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua " +
  "enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in " +
  "reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa " +
  "qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt lacus nulla gravida orci a odio nullam varius " +
  "turpis et commodo pharetra est eros bibendum elit nec luctus magna felis sollicitudin mauris integer in mauris eu nibh " +
  "euismod gravida duis ac tellus et risus vulputate vehicula donec lobortis risus a elit etiam tempor ut ullamcorper ligula " +
  "eu tempor congue eros est euismod turpis id tincidunt sapien risus a quam maecenas fermentum consequat mi donec fermentum " +
  "pellentesque malesuada nulla a mi duis sapien sem aliquet nec commodo eget consequat quis neque aliquam faucibus"
).split(" ");

export function loremIpsum(
  count: number,
  unit: "paragraphs" | "sentences" | "words",
  opts: { startWithLorem?: boolean; random?: () => number } = {},
): string {
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error("Choose a count between 1 and 1000.");
  const rnd = opts.random ?? Math.random;
  const startWithLorem = opts.startWithLorem ?? true;
  let first = true;
  const word = () => LOREM_WORDS[Math.floor(rnd() * LOREM_WORDS.length)];
  const sentence = (): string => {
    const len = 8 + Math.floor(rnd() * 10);
    const words: string[] = [];
    if (first && startWithLorem) {
      words.push("lorem", "ipsum", "dolor", "sit", "amet");
      first = false;
    }
    while (words.length < len) words.push(word());
    if (len > 10) words[Math.floor(len / 2)] += ",";
    const s = words.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  };
  const paragraph = () => Array.from({ length: 4 + Math.floor(rnd() * 4) }, sentence).join(" ");
  if (unit === "words") {
    const words: string[] = startWithLorem ? ["Lorem", "ipsum", "dolor", "sit", "amet"].slice(0, count) : [];
    while (words.length < count) words.push(word());
    return words.join(" ");
  }
  if (unit === "sentences") return Array.from({ length: count }, sentence).join(" ");
  return Array.from({ length: count }, paragraph).join("\n\n");
}

export function repeatText(text: string, times: number, separator = "\n"): string {
  if (!Number.isInteger(times) || times < 1) throw new Error("Repeat count must be a whole number of at least 1.");
  if (text.length * times > 2_000_000) throw new Error("The result would exceed 2,000,000 characters. Reduce the count.");
  return Array.from({ length: times }, () => text).join(separator);
}

export function textToBinary(text: string, separator = " "): string {
  return Array.from(new TextEncoder().encode(text), (b) => b.toString(2).padStart(8, "0")).join(separator);
}

export function binaryToText(binary: string): string {
  const clean = binary.replace(/[\s,]+/g, "");
  if (clean === "") return "";
  if (/[^01]/.test(clean)) throw new Error("Binary input may only contain 0, 1 and spaces.");
  if (clean.length % 8 !== 0) throw new Error(`Binary length must be a multiple of 8 bits (got ${clean.length}).`);
  const bytes = new Uint8Array(clean.length / 8);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 8, i * 8 + 8), 2);
  return decodeUtf8Strict(bytes);
}

export function textToHex(text: string, opts: { separator?: string; uppercase?: boolean; prefix?: boolean } = {}): string {
  const { separator = " ", uppercase = false, prefix = false } = opts;
  return Array.from(new TextEncoder().encode(text), (b) => {
    const h = b.toString(16).padStart(2, "0");
    return (prefix ? "0x" : "") + (uppercase ? h.toUpperCase() : h);
  }).join(separator);
}

export function hexToText(hex: string): string {
  const clean = hex.replace(/0x/gi, "").replace(/[\s,:-]+/g, "");
  if (clean === "") return "";
  if (/[^0-9a-f]/i.test(clean)) throw new Error("Hex input may only contain 0-9, A-F, spaces and an optional 0x prefix.");
  if (clean.length % 2 !== 0) throw new Error("Hex input must contain an even number of digits.");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return decodeUtf8Strict(bytes);
}

function decodeUtf8Strict(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The bytes are not valid UTF-8 text.");
  }
}

/** Line-based comparison summary used by Text Compare. */
export function compareSummary(a: string, b: string) {
  const la = splitLines(a);
  const lb = splitLines(b);
  const setB = new Set(lb);
  const setA = new Set(la);
  return {
    onlyInA: la.filter((l) => !setB.has(l)),
    onlyInB: lb.filter((l) => !setA.has(l)),
    identical: a === b,
  };
}
