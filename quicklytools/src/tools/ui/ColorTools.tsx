"use client";

import { useMemo, useState } from "react";
import * as C from "../logic/color";
import { ErrorBox, Field, KeyValueList, NumberInput, useReportUse } from "./kit";

function Swatch({ color }: { color: string }) {
  return (
    <div className="checkerboard border-base h-28 w-full overflow-hidden rounded-xl border sm:h-auto sm:w-40">
      <div className="h-full min-h-28 w-full" style={{ background: color }} />
    </div>
  );
}

function useParsed(input: string) {
  return useMemo(() => {
    try {
      return { color: C.parseColor(input), error: null as string | null };
    } catch (e) {
      return { color: null, error: (e as Error).message };
    }
  }, [input]);
}

/** Universal converter: any CSS color in, every format out. */
export function ColorConverter() {
  const [input, setInput] = useState("#4f46e5");
  const { color, error } = useParsed(input);
  const report = useReportUse();
  const f = color ? C.allFormats(color) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Color value" htmlFor="cc-in" className="min-w-60 flex-1" hint="Accepts HEX, RGB(A), HSL(A) and basic CSS color names.">
          <input id="cc-in" className="field font-mono" value={input} onChange={(e) => (setInput(e.target.value), report())} />
        </Field>
        <Field label="Picker" htmlFor="cc-pick">
          <input id="cc-pick" type="color" className="border-base h-10 w-16 cursor-pointer rounded-lg border" value={color ? C.rgbToHex({ ...color, a: 1 }) : "#000000"} onChange={(e) => setInput(e.target.value)} />
        </Field>
      </div>
      {error && <ErrorBox message={error} />}
      {f && color && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Swatch color={f.rgb} />
          <div className="flex-1">
            <KeyValueList
              items={[
                { k: "HEX", v: f.hex, copy: f.hex },
                { k: "RGB", v: f.rgb, copy: f.rgb },
                { k: "HSL", v: f.hsl, copy: f.hsl },
                { k: "HSV / HSB", v: f.hsv, copy: f.hsv },
                { k: "CMYK (approx.)", v: f.cmyk, copy: f.cmyk },
                { k: "Contrast vs white", v: `${f.contrastWhite}:1 ${f.contrastWhite >= 4.5 ? "✓ AA text" : ""}` },
                { k: "Contrast vs black", v: `${f.contrastBlack}:1 ${f.contrastBlack >= 4.5 ? "✓ AA text" : ""}` },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function HexToRgb() {
  const [hex, setHex] = useState("#1E90FF");
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      return { c: C.parseHex(hex), e: null as string | null };
    } catch (e) {
      return { c: null, e: (e as Error).message };
    }
  }, [hex]);
  return (
    <div className="space-y-4">
      <Field label="HEX color" htmlFor="h2r" hint="3, 4, 6 or 8 digits, with or without #.">
        <input id="h2r" className="field max-w-xs font-mono" value={hex} onChange={(e) => (setHex(e.target.value), report())} />
      </Field>
      {res.e && <ErrorBox message={res.e} />}
      {res.c && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Swatch color={C.formatRgb(res.c)} />
          <div className="flex-1">
            <KeyValueList
              items={[
                { k: "RGB", v: C.formatRgb(res.c), copy: C.formatRgb(res.c) },
                { k: "Red", v: res.c.r },
                { k: "Green", v: res.c.g },
                { k: "Blue", v: res.c.b },
                ...(res.c.a < 1 ? [{ k: "Alpha", v: res.c.a }] : []),
                { k: "Normalized (0–1)", v: `${(res.c.r / 255).toFixed(3)}, ${(res.c.g / 255).toFixed(3)}, ${(res.c.b / 255).toFixed(3)}` },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RgbInputs({ r, g, b, set }: { r: string; g: string; b: string; set: (k: "r" | "g" | "b", v: string) => void }) {
  return (
    <div className="grid max-w-md grid-cols-3 gap-3">
      {(["r", "g", "b"] as const).map((k) => (
        <Field key={k} label={{ r: "Red", g: "Green", b: "Blue" }[k]} htmlFor={`rgb-${k}`}>
          <NumberInput id={`rgb-${k}`} value={{ r, g, b }[k]} onChange={(v) => set(k, v)} min={0} max={255} step={1} />
        </Field>
      ))}
    </div>
  );
}

function useRgb(initial: [number, number, number]) {
  const [v, setV] = useState({ r: String(initial[0]), g: String(initial[1]), b: String(initial[2]) });
  const report = useReportUse();
  const parsed = useMemo(() => {
    const nums = [v.r, v.g, v.b].map((x) => Number(x));
    if ([v.r, v.g, v.b].some((x) => x.trim() === "") || nums.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) {
      return { c: null, e: "Each channel must be a whole number from 0 to 255." };
    }
    return { c: { r: nums[0], g: nums[1], b: nums[2], a: 1 } as C.RGBA, e: null };
  }, [v]);
  return { v, set: (k: "r" | "g" | "b", val: string) => (setV((p) => ({ ...p, [k]: val })), report()), ...parsed };
}

export function RgbToHsl() {
  const { v, set, c, e } = useRgb([79, 70, 229]);
  const hsl = c ? C.rgbToHsl(c) : null;
  return (
    <div className="space-y-4">
      <RgbInputs {...v} set={set} />
      {e && <ErrorBox message={e} />}
      {c && hsl && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Swatch color={C.formatRgb(c)} />
          <div className="flex-1">
            <KeyValueList
              items={[
                { k: "HSL", v: C.formatHsl(c), copy: C.formatHsl(c) },
                { k: "Hue", v: `${hsl.h}°` },
                { k: "Saturation", v: `${hsl.s}%` },
                { k: "Lightness", v: `${hsl.l}%` },
                { k: "HEX", v: C.rgbToHex(c), copy: C.rgbToHex(c) },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function RgbToHex() {
  const { v, set, c, e } = useRgb([255, 99, 71]);
  return (
    <div className="space-y-4">
      <RgbInputs {...v} set={set} />
      {e && <ErrorBox message={e} />}
      {c && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Swatch color={C.formatRgb(c)} />
          <div className="flex-1">
            <KeyValueList
              items={[
                { k: "HEX", v: C.rgbToHex(c), copy: C.rgbToHex(c) },
                { k: "HEX (uppercase)", v: C.rgbToHex(c, { uppercase: true }), copy: C.rgbToHex(c, { uppercase: true }) },
                { k: "Short HEX", v: shortHex(C.rgbToHex(c)) ?? "Not representable", copy: shortHex(C.rgbToHex(c)) ?? undefined },
                { k: "RGB", v: C.formatRgb(c), copy: C.formatRgb(c) },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function shortHex(hex: string): string | null {
  const h = hex.slice(1);
  return h[0] === h[1] && h[2] === h[3] && h[4] === h[5] ? `#${h[0]}${h[2]}${h[4]}` : null;
}

export function HexToHsl() {
  const [hex, setHex] = useState("#10B981");
  const report = useReportUse();
  const res = useMemo(() => {
    try {
      return { c: C.parseHex(hex), e: null as string | null };
    } catch (e) {
      return { c: null, e: (e as Error).message };
    }
  }, [hex]);
  const hsl = res.c ? C.rgbToHsl(res.c) : null;
  return (
    <div className="space-y-4">
      <Field label="HEX color" htmlFor="h2h">
        <input id="h2h" className="field max-w-xs font-mono" value={hex} onChange={(e) => (setHex(e.target.value), report())} />
      </Field>
      {res.e && <ErrorBox message={res.e} />}
      {res.c && hsl && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Swatch color={C.formatRgb(res.c)} />
          <div className="flex-1">
            <KeyValueList
              items={[
                { k: "HSL", v: C.formatHsl(res.c), copy: C.formatHsl(res.c) },
                { k: "Hue", v: `${hsl.h}°` },
                { k: "Saturation", v: `${hsl.s}%` },
                { k: "Lightness", v: `${hsl.l}%` },
                { k: "CSS (modern syntax)", v: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`, copy: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)` },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
