import { describe, expect, it } from "vitest";
import * as G from "@/tools/logic/generators";

describe("random", () => {
  it("secureRandomInt stays in range and is roughly uniform", () => {
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 6000; i++) counts[G.secureRandomInt(6)]++;
    for (const c of counts) expect(c).toBeGreaterThan(800);
    expect(() => G.secureRandomInt(0)).toThrow();
  });
  it("passwords include every selected set", () => {
    for (let i = 0; i < 50; i++) {
      const p = G.generatePassword({ length: 8, lower: true, upper: true, digits: true, symbols: true, excludeSimilar: true });
      expect(p).toHaveLength(8);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/\d/);
      expect(p).toMatch(/[^A-Za-z0-9]/);
      expect(p).not.toMatch(/[il1Lo0O]/);
    }
    expect(() => G.generatePassword({ length: 10, lower: false, upper: false, digits: false, symbols: false, excludeSimilar: false })).toThrow();
    expect(G.passwordPoolBits({ length: 10, lower: true, upper: false, digits: false, symbols: false, excludeSimilar: false })).toBeCloseTo(47, 0);
  });
  it("passphrase", () => {
    const p = G.generatePassphrase(["alpha", "beta", "gamma"], { count: 4, separator: "-", capitalize: true, addNumber: false });
    expect(p.split("-")).toHaveLength(4);
    expect(p).toMatch(/^[A-Z]/);
    expect(() => G.generatePassphrase(["a"], { count: 2, separator: "", capitalize: false, addNumber: false })).toThrow();
  });
  it("random integers unique and bounded", () => {
    const r = G.randomIntegers(1, 10, 10, true);
    expect(new Set(r).size).toBe(10);
    expect(Math.min(...r)).toBe(1);
    expect(() => G.randomIntegers(1, 5, 6, true)).toThrow(/Only 5/);
    expect(() => G.randomIntegers(5, 1, 1, false)).toThrow();
    const d = G.randomDecimal(1, 2, 3);
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(2);
  });
  it("pickRandom unique", () => {
    expect(new Set(G.pickRandom([1, 2, 3, 4], 4)).size).toBe(4);
    expect(() => G.pickRandom([], 1)).toThrow();
  });
});

describe("QR payloads", () => {
  it("wifi escaping", () => {
    expect(G.wifiPayload({ ssid: 'My;Net', password: "p:ss,word", security: "WPA", hidden: true })).toBe(String.raw`WIFI:T:WPA;S:My\;Net;P:p\:ss\,word;H:true;;`);
    expect(G.wifiPayload({ ssid: "Open", password: "", security: "nopass", hidden: false })).toBe("WIFI:T:nopass;S:Open;;");
    expect(() => G.wifiPayload({ ssid: "x", password: "short", security: "WPA", hidden: false })).toThrow(/8 characters/);
  });
  it("mailto, tel, sms, vcard", () => {
    expect(G.emailPayload({ to: "a@b.co", subject: "Hi there", body: "x&y" })).toBe("mailto:a@b.co?subject=Hi%20there&body=x%26y");
    expect(() => G.emailPayload({ to: "nope" })).toThrow();
    expect(G.phonePayload("+1 (555) 123-4567")).toBe("tel:+15551234567");
    expect(G.smsPayload("+15551234567", "Hello")).toBe("SMSTO:+15551234567:Hello");
    const v = G.vcardPayload({ firstName: "Ada", lastName: "Lovelace", organization: "Analytical; Engines", email: "ada@example.com" });
    expect(v).toContain("BEGIN:VCARD\r\nVERSION:3.0");
    expect(v).toContain("N:Lovelace;Ada;;;");
    expect(v).toContain(String.raw`ORG:Analytical\; Engines`);
    expect(() => G.vcardPayload({ firstName: "", lastName: "" })).toThrow();
  });
});

describe("web snippets", () => {
  it("UTM builder preserves existing params", () => {
    const u = G.buildUtmUrl("https://ex.com/p?x=1", { source: "news", medium: "email", campaign: "spring sale" });
    expect(u).toBe("https://ex.com/p?x=1&utm_source=news&utm_medium=email&utm_campaign=spring+sale");
    expect(() => G.buildUtmUrl("ex.com", { source: "a", medium: "b", campaign: "c" })).toThrow();
    expect(() => G.buildUtmUrl("ftp://ex.com", { source: "a", medium: "b", campaign: "c" })).toThrow();
  });
  it("robots.txt", () => {
    const r = G.buildRobotsTxt([{ userAgent: "*", allow: [], disallow: ["admin/"] }], ["https://x.com/sitemap.xml"]);
    expect(r).toBe("User-agent: *\nDisallow: /admin/\n\nSitemap: https://x.com/sitemap.xml\n");
  });
  it("meta & OG tags escape attributes", () => {
    const m = G.buildMetaTags({ title: 'A "quoted" <title>', description: "d", robotsIndex: false, robotsFollow: true, viewport: false, charset: false });
    expect(m).toContain("<title>A &quot;quoted&quot; &lt;title&gt;</title>");
    expect(m).toContain('content="noindex, follow"');
    expect(G.metaLengthAdvice("x".repeat(70), "")).toHaveLength(1);
    const og = G.buildOpenGraph({ title: "T", description: "D", url: "https://x.com", type: "website", twitterCard: "summary" });
    expect(og).toContain('<meta property="og:title" content="T">');
    expect(og).toContain('<meta name="twitter:card" content="summary">');
  });
  it("css generators", () => {
    expect(G.cssGradient("linear", 90, [{ color: "#fff", position: 100 }, { color: "#000", position: 0 }])).toBe("linear-gradient(90deg, #000 0%, #fff 100%)");
    expect(() => G.cssGradient("linear", 0, [{ color: "#fff", position: 0 }])).toThrow();
    expect(G.cssBoxShadow([{ x: 0, y: 2, blur: 4, spread: 0, color: "#000000", opacity: 0.5, inset: true }])).toBe("inset 0px 2px 4px 0px rgba(0, 0, 0, 0.5)");
    expect(G.cssBorderRadius({ tl: 8, tr: 8, br: 8, bl: 8 })).toBe("8px");
    expect(G.cssBorderRadius({ tl: 8, tr: 4, br: 8, bl: 4 })).toBe("8px 4px");
    expect(G.cssBorderRadius({ tl: 0, tr: 4, br: 8, bl: 4 })).toBe("0 4px 8px");
  });
});
