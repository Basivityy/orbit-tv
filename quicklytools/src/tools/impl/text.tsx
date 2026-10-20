"use client";

import { useMemo, useState, type ComponentType } from "react";
import { diffLines, diffWordsWithSpace } from "diff";
import * as T from "../logic/text";
import { TextTransformTool } from "../ui/TextTransformTool";
import { TextStatsTool } from "../ui/TextStatsTool";
import { CopyButton, ErrorBox, Field, NumberInput, Panel, Segmented, Select, useReportUse } from "../ui/kit";

const fmt = (n: number) => n.toLocaleString("en-US");

function WordCounter() {
  return (
    <TextStatsTool
      stats={(t) => {
        const c = T.countCharacters(t);
        const words = T.countWords(t);
        const r = T.readingTime(t);
        return [
          { label: "Words", value: fmt(words), primary: true },
          { label: "Characters", value: fmt(c.chars) },
          { label: "Sentences", value: fmt(T.countSentences(t)) },
          { label: "Paragraphs", value: fmt(T.countParagraphs(t)) },
          { label: "Characters (no spaces)", value: fmt(c.noSpaces) },
          { label: "Avg. word length", value: words ? (c.letters / words).toFixed(1) : "0" },
          { label: "Reading time", value: T.formatMinutes(r.readingMinutes) },
          { label: "Speaking time", value: T.formatMinutes(r.speakingMinutes) },
        ];
      }}
      footer={(t) => <KeywordDensity text={t} />}
    />
  );
}

const STOP = new Set("the a an and or but of to in on at for with is are was were be been it this that as by from i you he she we they not have has had do does did so if then than there their them his her its our your my me".split(" "));

function KeywordDensity({ text }: { text: string }) {
  const top = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []) {
      if (w.length < 3 || STOP.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    const total = T.countWords(text) || 1;
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w, n]) => ({ w, n, pct: (n / total) * 100 }));
  }, [text]);
  if (top.length === 0) return null;
  return (
    <Panel title="Top keywords">
      <ul className="flex flex-wrap gap-2">
        {top.map((k) => (
          <li key={k.w} className="chip">
            {k.w} <span className="font-mono">{k.n}× · {k.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CharacterCounter() {
  return (
    <TextStatsTool
      stats={(t) => {
        const c = T.countCharacters(t);
        return [
          { label: "Characters", value: fmt(c.chars), primary: true },
          { label: "Without spaces", value: fmt(c.noSpaces) },
          { label: "Letters", value: fmt(c.letters) },
          { label: "Digits", value: fmt(c.digits) },
          { label: "Spaces & line breaks", value: fmt(c.spaces) },
          { label: "Punctuation", value: fmt(c.punctuation) },
          { label: "UTF-8 bytes", value: fmt(c.bytes) },
          { label: "UTF-16 code units", value: fmt(c.codeUnits), hint: "What JavaScript's .length reports" },
        ];
      }}
      footer={(t) => <LimitBars count={T.countCharacters(t).chars} />}
    />
  );
}

function LimitBars({ count }: { count: number }) {
  const limits = [
    { name: "SEO title", max: 60 },
    { name: "Meta description", max: 160 },
    { name: "SMS (GSM-7)", max: 160 },
    { name: "X / Twitter post", max: 280 },
  ];
  return (
    <Panel title="Common length limits">
      <ul className="space-y-2.5">
        {limits.map((l) => {
          const pct = Math.min(100, (count / l.max) * 100);
          const over = count > l.max;
          return (
            <li key={l.name}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{l.name}</span>
                <span className={`font-mono ${over ? "text-red-600" : "text-muted"}`}>
                  {count}/{l.max}
                </span>
              </div>
              <div className="bg-surface-2 h-1.5 rounded-full">
                <div className={`h-1.5 rounded-full ${over ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function SentenceCounter() {
  return (
    <TextStatsTool
      stats={(t) => {
        const s = T.countSentences(t);
        const w = T.countWords(t);
        return [
          { label: "Sentences", value: fmt(s), primary: true },
          { label: "Words", value: fmt(w) },
          { label: "Avg. words per sentence", value: s ? (w / s).toFixed(1) : "0", hint: "15–20 is comfortable for most readers" },
          { label: "Paragraphs", value: fmt(T.countParagraphs(t)) },
        ];
      }}
    />
  );
}

function ParagraphCounter() {
  return (
    <TextStatsTool
      stats={(t) => {
        const p = T.countParagraphs(t);
        const s = T.countSentences(t);
        return [
          { label: "Paragraphs", value: fmt(p), primary: true },
          { label: "Sentences", value: fmt(s) },
          { label: "Words", value: fmt(T.countWords(t)) },
          { label: "Avg. sentences per paragraph", value: p ? (s / p).toFixed(1) : "0" },
        ];
      }}
      placeholder="Paste text. Paragraphs are separated by a blank line."
    />
  );
}

function LineCounter() {
  return (
    <TextStatsTool
      stats={(t) => {
        const l = T.countLines(t);
        const lens = T.splitLines(t).map((x) => x.length);
        return [
          { label: "Total lines", value: fmt(l.total), primary: true },
          { label: "Non-empty lines", value: fmt(l.nonEmpty) },
          { label: "Empty lines", value: fmt(l.empty) },
          { label: "Longest line", value: lens.length ? `${fmt(Math.max(...lens))} chars` : "0" },
        ];
      }}
    />
  );
}

function ReadingTime() {
  return (
    <TextStatsTool
      settings={[
        { name: "wpm", label: "Reading speed (wpm)", default: 238, min: 50, max: 1000 },
        { name: "spm", label: "Speaking speed (wpm)", default: 150, min: 50, max: 400 },
      ]}
      stats={(t, x) => {
        const r = T.readingTime(t, x.wpm, x.spm);
        return [
          { label: "Reading time", value: T.formatMinutes(r.readingMinutes), primary: true },
          { label: "Speaking time", value: T.formatMinutes(r.speakingMinutes) },
          { label: "Words", value: fmt(r.words) },
          { label: "Skimming (2× speed)", value: T.formatMinutes(r.readingMinutes / 2) },
        ];
      }}
    />
  );
}

const sampleText = "the quick brown fox jumps over the lazy dog.\nA second line of SAMPLE text for testing.";

const Upper = () => <TextTransformTool transform={T.toUpperCase} sample={sampleText} download={{ filename: "uppercase.txt" }} />;
const Lower = () => <TextTransformTool transform={T.toLowerCase} sample={sampleText} download={{ filename: "lowercase.txt" }} />;
const TitleCase = () => (
  <TextTransformTool
    options={[{ type: "select", name: "style", label: "Style", default: "standard", options: [{ value: "standard", label: "Title Case (AP/Chicago style)" }, { value: "all", label: "Capitalize Every Word" }, { value: "sentence", label: "Sentence case" }] }]}
    transform={(t, o) => (o.style === "sentence" ? T.toSentenceCase(t) : T.toTitleCase(t, o.style as "standard" | "all"))}
    sample={"a tale of two cities: the best of times and the worst of times\nhow to use an iPhone with NASA data"}
  />
);

const RemoveDuplicates = () => (
  <TextTransformTool
    options={[
      { type: "checkbox", name: "caseSensitive", label: "Case sensitive", default: true },
      { type: "checkbox", name: "trim", label: "Ignore leading/trailing spaces", default: true },
      { type: "checkbox", name: "keepEmpty", label: "Keep empty lines", default: false },
    ]}
    transform={(t, o) => {
      const r = T.removeDuplicateLines(t, { caseSensitive: Boolean(o.caseSensitive), trim: Boolean(o.trim), keepEmpty: Boolean(o.keepEmpty) });
      return { output: r.output, info: `${r.removed} duplicate line(s) removed.` };
    }}
    sample={"apple\nbanana\nApple\napple\ncherry\nbanana"}
    download={{ filename: "deduplicated.txt" }}
    fileAccept=".txt,.csv,.log,.md,text/plain"
  />
);

const RemoveEmpty = () => (
  <TextTransformTool
    options={[{ type: "checkbox", name: "ws", label: "Treat whitespace-only lines as empty", default: true }]}
    transform={(t, o) => {
      const r = T.removeEmptyLines(t, Boolean(o.ws));
      return { output: r.output, info: `${r.removed} empty line(s) removed.` };
    }}
    sample={"First line\n\n\nSecond line\n   \nThird line"}
    fileAccept=".txt,.csv,.log,.md,text/plain"
  />
);

const SortLines = () => (
  <TextTransformTool
    options={[
      {
        type: "select", name: "mode", label: "Sort order", default: "az",
        options: [
          { value: "az", label: "A → Z" }, { value: "za", label: "Z → A" }, { value: "natural", label: "Natural (file2 before file10)" },
          { value: "numeric", label: "Numeric" }, { value: "length", label: "Shortest first" }, { value: "length-desc", label: "Longest first" },
          { value: "reverse", label: "Reverse current order" }, { value: "shuffle", label: "Random shuffle" },
        ],
      },
      { type: "checkbox", name: "cs", label: "Case sensitive", default: false },
    ]}
    transform={(t, o) => T.sortLines(t, o.mode as T.SortMode, { caseSensitive: Boolean(o.cs) })}
    sample={"banana\nApple\ncherry\nfile10\nfile2\n42\n7"}
    fileAccept=".txt,.csv,.log,text/plain"
  />
);

const Reverse = () => (
  <TextTransformTool
    options={[{ type: "select", name: "mode", label: "Reverse", default: "characters", options: [{ value: "characters", label: "Characters" }, { value: "words", label: "Word order" }, { value: "each-word", label: "Letters in each word" }, { value: "lines", label: "Line order" }] }]}
    transform={(t, o) => T.reverseText(t, o.mode as "characters")}
    sample="Hello world 👋🏽 — reversed!"
  />
);

function TextCompare() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [mode, setMode] = useState<"lines" | "words">("words");
  const report = useReportUse();
  const parts = useMemo(() => (a || b ? (mode === "lines" ? diffLines(a, b) : diffWordsWithSpace(a, b)) : []), [a, b, mode]);
  const added = parts.filter((p) => p.added).reduce((s, p) => s + (p.count ?? 0), 0);
  const removed = parts.filter((p) => p.removed).reduce((s, p) => s + (p.count ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Original text" htmlFor="cmp-a">
          <textarea id="cmp-a" className="field" rows={10} value={a} onChange={(e) => setA(e.target.value)} placeholder="Paste the original version" />
        </Field>
        <Field label="Changed text" htmlFor="cmp-b">
          <textarea id="cmp-b" className="field" rows={10} value={b} onChange={(e) => (setB(e.target.value), report())} placeholder="Paste the new version" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented ariaLabel="Compare by" value={mode} onChange={setMode} options={[{ value: "words", label: "Compare words" }, { value: "lines", label: "Compare lines" }]} />
        {(a || b) && (
          <p className="text-sm">
            {a === b ? (
              <span className="font-semibold text-emerald-600">The texts are identical.</span>
            ) : (
              <>
                <span className="font-semibold text-emerald-600">+{added}</span> <span className="text-muted">added</span> ·{" "}
                <span className="font-semibold text-red-600">−{removed}</span> <span className="text-muted">removed {mode}</span>
              </>
            )}
          </p>
        )}
      </div>
      {parts.length > 0 && (
        <Panel title="Differences">
          <pre className="max-h-[480px] overflow-auto font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
            {parts.map((p, i) => (
              <span
                key={i}
                className={p.added ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" : p.removed ? "bg-red-100 text-red-900 line-through dark:bg-red-900/40 dark:text-red-200" : ""}
              >
                {p.value}
              </span>
            ))}
          </pre>
        </Panel>
      )}
    </div>
  );
}

function FindReplace() {
  return (
    <TextTransformTool
      options={[
        { type: "text", name: "find", label: "Find", default: "", placeholder: "Text or pattern" },
        { type: "text", name: "replace", label: "Replace with", default: "", placeholder: "Replacement ($1 for groups in regex mode)" },
        { type: "checkbox", name: "cs", label: "Match case", default: false },
        { type: "checkbox", name: "word", label: "Whole words", default: false },
        { type: "checkbox", name: "regex", label: "Regular expression", default: false },
      ]}
      transform={(t, o) => {
        const r = T.findAndReplace(t, String(o.find), String(o.replace), { caseSensitive: Boolean(o.cs), wholeWord: Boolean(o.word), regex: Boolean(o.regex) });
        return { output: r.output, info: o.find ? `${r.count} replacement(s) made.` : "Enter text to find." };
      }}
      sample={"The cat sat on the mat. Another cat appeared.\nCats are great."}
      fileAccept=".txt,.csv,.md,.log,.html,text/plain"
    />
  );
}

const ExtraSpaces = () => (
  <TextTransformTool
    options={[
      { type: "checkbox", name: "trim", label: "Trim each line", default: true },
      { type: "checkbox", name: "blank", label: "Collapse blank lines", default: true },
      { type: "checkbox", name: "tabs", label: "Convert tabs to spaces", default: true },
    ]}
    transform={(t, o) => T.removeExtraSpaces(t, { trimLines: Boolean(o.trim), collapseBlankLines: Boolean(o.blank), tabsToSpaces: Boolean(o.tabs) })}
    sample={"  Too    many   spaces   here.  \n\n\n\n\tAnd\ttabs\there.   "}
  />
);

const Slug = () => (
  <TextTransformTool
    options={[
      { type: "select", name: "sep", label: "Separator", default: "-", options: [{ value: "-", label: "Hyphen (-)" }, { value: "_", label: "Underscore (_)" }] },
      { type: "number", name: "max", label: "Max length (0 = none)", default: 0, min: 0, max: 200 },
      { type: "checkbox", name: "lines", label: "One slug per line", default: true },
    ]}
    transform={(t, o) => {
      const one = (s: string) => T.slugify(s, { separator: o.sep as "-", maxLength: Number(o.max) || 0 });
      return o.lines ? T.splitLines(t).map(one).join("\n") : one(t);
    }}
    sample={"Héllo Wörld: 10 Tips & Tricks for 2026!\nCafé crème — Ünïcödé"}
    rows={8}
  />
);

function LoremIpsum() {
  const [count, setCount] = useState("3");
  const [unit, setUnit] = useState<"paragraphs" | "sentences" | "words">("paragraphs");
  const [lorem, setLorem] = useState(true);
  const [html, setHtml] = useState(false);
  const [seed, setSeed] = useState(0);
  const report = useReportUse();
  const { text, error } = useMemo(() => {
    void seed;
    try {
      const t = T.loremIpsum(Number(count), unit, { startWithLorem: lorem });
      return { text: html && unit === "paragraphs" ? t.split("\n\n").map((p) => `<p>${p}</p>`).join("\n") : t, error: null };
    } catch (e) {
      return { text: "", error: (e as Error).message };
    }
  }, [count, unit, lorem, html, seed]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Amount" htmlFor="li-count" className="w-28">
          <NumberInput id="li-count" value={count} onChange={setCount} min={1} max={1000} step={1} />
        </Field>
        <Field label="Unit" htmlFor="li-unit" className="w-40">
          <Select id="li-unit" value={unit} onChange={setUnit} options={[{ value: "paragraphs", label: "Paragraphs" }, { value: "sentences", label: "Sentences" }, { value: "words", label: "Words" }]} />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={lorem} onChange={(e) => setLorem(e.target.checked)} /> Start with “Lorem ipsum”</label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={html} onChange={(e) => setHtml(e.target.checked)} /> Wrap in &lt;p&gt; tags</label>
        <button type="button" className="btn btn-primary" onClick={() => (setSeed((s) => s + 1), report())}>Generate new</button>
      </div>
      {error ? <ErrorBox message={error} /> : (
        <Panel title={`${T.countWords(text)} words`} actions={<CopyButton text={text} />}>
          <div className="max-h-[420px] overflow-auto text-sm leading-relaxed whitespace-pre-wrap">{text}</div>
        </Panel>
      )}
    </div>
  );
}

const Repeater = () => (
  <TextTransformTool
    options={[
      { type: "number", name: "times", label: "Repeat count", default: 5, min: 1, max: 100000 },
      { type: "select", name: "sep", label: "Separator", default: "\n", options: [{ value: "\n", label: "New line" }, { value: " ", label: "Space" }, { value: "", label: "None" }, { value: ", ", label: "Comma" }] },
    ]}
    transform={(t, o) => T.repeatText(t, Number(o.times), String(o.sep))}
    sample="Hello! "
    rows={8}
  />
);

const TextToBinary = () => (
  <TextTransformTool
    options={[{ type: "select", name: "sep", label: "Byte separator", default: " ", options: [{ value: " ", label: "Space" }, { value: "", label: "None" }, { value: "\n", label: "New line" }] }]}
    transform={(t, o) => T.textToBinary(t, String(o.sep))}
    sample="Hi 👋"
    outputLabel="Binary (UTF-8 bytes)"
  />
);

export const BinaryToText = () => <TextTransformTool transform={(t) => T.binaryToText(t)} sample="01001000 01101001 00100001" inputLabel="Binary" outputLabel="Text" />;

export const TextToHex = () => (
  <TextTransformTool
    options={[
      { type: "select", name: "sep", label: "Separator", default: " ", options: [{ value: " ", label: "Space" }, { value: "", label: "None" }, { value: ":", label: "Colon" }, { value: ", ", label: "Comma" }] },
      { type: "checkbox", name: "upper", label: "Uppercase", default: false },
      { type: "checkbox", name: "prefix", label: "0x prefix", default: false },
    ]}
    transform={(t, o) => T.textToHex(t, { separator: String(o.sep), uppercase: Boolean(o.upper), prefix: Boolean(o.prefix) })}
    sample="Hello, world!"
    outputLabel="Hex (UTF-8 bytes)"
  />
);

export const HexToText = () => <TextTransformTool transform={(t) => T.hexToText(t)} sample="48 65 6c 6c 6f 2c 20 77 6f 72 6c 64 21" inputLabel="Hex" outputLabel="Text" />;

const tools: Record<string, ComponentType> = {
  "word-counter": WordCounter,
  "character-counter": CharacterCounter,
  "sentence-counter": SentenceCounter,
  "paragraph-counter": ParagraphCounter,
  "uppercase-converter": Upper,
  "lowercase-converter": Lower,
  "title-case-converter": TitleCase,
  "remove-duplicate-lines": RemoveDuplicates,
  "remove-empty-lines": RemoveEmpty,
  "sort-lines": SortLines,
  "reverse-text": Reverse,
  "text-compare": TextCompare,
  "find-and-replace": FindReplace,
  "remove-extra-spaces": ExtraSpaces,
  "text-to-slug": Slug,
  "lorem-ipsum-generator": LoremIpsum,
  "reading-time-calculator": ReadingTime,
  "text-repeater": Repeater,
  "line-counter": LineCounter,
  "text-to-binary": TextToBinary,
};

export default tools;
