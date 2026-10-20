import { describe, expect, it } from "vitest";
import * as U from "@/tools/logic/convert";
import * as C from "@/tools/logic/color";

describe("units", () => {
  it("temperature", () => {
    const t = U.convertTemperature(212, "F");
    expect(t.C).toBeCloseTo(100);
    expect(t.K).toBeCloseTo(373.15);
    expect(U.convertTemperature(-40, "C").F).toBeCloseTo(-40);
    expect(() => U.convertTemperature(-300, "C")).toThrow(/absolute zero/);
  });
  it("data storage decimal vs binary", () => {
    const r = U.convertData(1, "TB");
    expect(r.find((x) => x.id === "GiB")!.value).toBeCloseTo(931.32, 2);
    expect(r.find((x) => x.id === "Mb")!.value).toBe(8_000_000);
    expect(U.humanBytes(1536, true)).toBe("1.50 KiB");
  });
  it("css units", () => {
    const r = U.convertCssUnit(12, "pt", { rootFontSize: 16, parentFontSize: 16, viewportWidth: 1000, viewportHeight: 800, containerSize: 500 });
    expect(r.px).toBeCloseTo(16);
    expect(r.rem).toBeCloseTo(1);
    expect(r.vw).toBeCloseTo(1.6);
    expect(U.pxToRem(24)).toBe(1.5);
    expect(U.remToPx(1.25, 20)).toBe(25);
    expect(() => U.pxToRem(10, 0)).toThrow();
    expect(U.fmtNum(0.1 + 0.2)).toBe("0.3");
  });
});

describe("number systems", () => {
  it("base conversion with big integers", () => {
    expect(U.convertBase("255", 10)).toMatchObject({ binary: "11111111", hex: "FF", octal: "377" });
    expect(U.convertBase("0xff", 16).decimal).toBe("255");
    expect(U.convertBase("123456789012345678901234567890", 10).hex).toBe("18EE90FF6C373E0EE4E3F0AD2");
    expect(U.formatInBase(35n, 36)).toBe("z");
    expect(() => U.parseInBase("2", 2)).toThrow(/not a valid digit/);
    expect(U.groupDigits("1234567", 3, ",")).toBe("1,234,567");
  });
  it("binary calculator", () => {
    expect(U.binaryCalc("1011", "110", "+").binary).toBe("10001");
    expect(U.binaryCalc("1100", "1010", "XOR").binary).toBe("110");
    expect(U.binaryCalc("1", "11", "<<").decimal).toBe("8");
    expect(() => U.binaryCalc("1", "0", "/")).toThrow(/zero/);
  });
  it("roman numerals", () => {
    expect(U.toRoman(2026)).toBe("MMXXVI");
    expect(U.toRoman(3999)).toBe("MMMCMXCIX");
    expect(U.fromRoman("mcmxciv")).toBe(1994);
    expect(() => U.fromRoman("IIII")).toThrow(/Did you mean IV/);
    expect(() => U.toRoman(0)).toThrow();
  });
});

describe("dates and times", () => {
  it("calendar difference and age", () => {
    const d = U.calendarDiff(new Date(2020, 0, 31), new Date(2020, 2, 1));
    expect(d.totalDays).toBe(30);
    expect([d.years, d.months, d.days]).toEqual([0, 1, 1]);
    const a = U.age(new Date(1990, 5, 15), new Date(2026, 5, 14));
    expect(a.years).toBe(35);
    expect(a.daysToBirthday).toBe(1);
    expect(() => U.age(new Date(2030, 0, 1), new Date(2026, 0, 1))).toThrow();
    expect(() => U.parseDateInput("2026-02-30")).toThrow(/real calendar/);
  });
  it("business days", () => expect(U.businessDaysBetween(new Date(2026, 0, 5), new Date(2026, 0, 12))).toBe(5));
  it("time duration across midnight", () => {
    expect(U.timeDuration("22:00", "06:00").hours).toBe(8);
    expect(U.timeDuration("09:15", "17:45").decimalHours).toBe(8.5);
    expect(() => U.timeDuration("25:00", "01:00")).toThrow();
    expect(U.formatDuration(3725)).toBe("1:02:05");
  });
  it("aspect ratios", () => {
    expect(U.aspectRatio(1920, 1080).ratio).toBe("16:9");
    expect(U.scaleToRatio(16, 9, { width: 1280 }).height).toBe(720);
    expect(() => U.scaleToRatio(16, 9, {})).toThrow();
  });
  it("password entropy", () => {
    expect(U.passwordEntropy("").bits).toBe(0);
    const weak = U.passwordEntropy("password123");
    expect(weak.strength).toMatch(/weak/i);
    const strong = U.passwordEntropy("v8#Qp2!xLm9@Rt4&Zw");
    expect(strong.bits).toBeGreaterThan(100);
    expect(U.humanDuration(90)).toBe("1 minute");
  });
});

describe("colors", () => {
  it("parses formats", () => {
    expect(C.parseColor("#1e90ff")).toEqual({ r: 30, g: 144, b: 255, a: 1 });
    expect(C.parseColor("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(C.parseColor("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(C.parseColor("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(C.parseColor("tomato")).toEqual({ r: 255, g: 99, b: 71, a: 1 });
    expect(() => C.parseColor("#12")).toThrow();
    expect(() => C.parseColor("rgb(300,0,0)")).toThrow();
  });
  it("converts between spaces", () => {
    const c = { r: 16, g: 185, b: 129, a: 1 };
    expect(C.rgbToHex(c)).toBe("#10b981");
    expect(C.rgbToHsl(c)).toMatchObject({ h: 160.1, s: 84.1, l: 39.4 });
    expect(C.hslToRgb(160.1, 84.1, 39.4)).toMatchObject({ r: 16, g: 185, b: 129 });
    expect(C.rgbToCmyk({ r: 255, g: 0, b: 0, a: 1 })).toEqual({ c: 0, m: 100, y: 100, k: 0 });
    expect(C.rgbToHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe("#00000080");
  });
  it("contrast ratio", () => {
    expect(C.contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 })).toBe(21);
    expect(C.palette({ r: 255, g: 0, b: 0, a: 1 }, "triadic")).toHaveLength(3);
  });
});
