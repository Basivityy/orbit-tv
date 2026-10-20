import { describe, expect, it } from "vitest";
import * as D from "@/tools/logic/developer";

describe("JSON", () => {
  it("formats, sorts and minifies", () => {
    expect(D.formatJson('{"b":1,"a":[1,2]}', 2)).toBe('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(D.formatJson('{"b":1,"a":2}', 2, true)).toBe('{\n  "a": 2,\n  "b": 1\n}');
    expect(D.formatJson('{"a":1}', "tab")).toBe('{\n\t"a": 1\n}');
    expect(D.minifyJson('{ "a" : [ 1 , 2 ] }')).toBe('{"a":[1,2]}');
  });
  it("reports errors with location", () => {
    expect(() => D.parseJson("")).toThrow(/empty/);
    expect(() => D.formatJson('{\n  "a": 1,\n}')).toThrow(/line 3/);
    const v = D.validateJson('{"a": [1, 2,]}');
    expect(v.valid).toBe(false);
    if (!v.valid) expect(v.error.line).toBe(1);
    const ok = D.validateJson("[1,2,3]");
    expect(ok.valid && ok.summary).toContain("array with 3");
  });
  it("JSON ↔ CSV", () => {
    const csv = D.jsonToCsv('[{"id":1,"name":"Ada","address":{"city":"London"}},{"id":2,"name":"Smith, J","tags":["x"]}]');
    expect(csv.split("\r\n")[0]).toBe("id,name,address.city,tags");
    expect(csv).toContain('"Smith, J"');
    expect(csv).toContain('"[""x""]"');
    expect(() => D.jsonToCsv("[]")).toThrow(/empty/);
    const back = JSON.parse(D.csvToJson("id,name,active\n1,Ada,true\n2,\"Smith, J\",false"));
    expect(back).toEqual([{ id: 1, name: "Ada", active: true }, { id: 2, name: "Smith, J", active: false }]);
    expect(JSON.parse(D.csvToJson("zip\n007", { dynamicTyping: false }))[0].zip).toBe("007");
    expect(JSON.parse(D.csvToJson("a;b\n1;2"))).toEqual([{ a: 1, b: 2 }]);
  });
  it("CSV dedupe by column", () => {
    const r = D.csvRemoveDuplicates("email,name\na@x.com,A\nA@X.com,B\nb@x.com,C", { columns: "email", caseSensitive: false });
    expect(r.removed).toBe(1);
    expect(r.output.split("\r\n")).toHaveLength(3);
    expect(() => D.csvRemoveDuplicates("a\n1", { columns: "nope" })).toThrow(/not found/);
    expect(D.csvRemoveDuplicates("a,b\n1,2\n1,3", { columns: "1" }).removed).toBe(1);
  });
});

describe("YAML & XML", () => {
  it("round trips YAML", () => {
    const y = D.jsonToYaml('{"a":1,"b":["x","yes"]}');
    expect(y).toContain("a: 1");
    expect(y).toContain('"yes"');
    expect(JSON.parse(D.yamlToJson(y))).toEqual({ a: 1, b: ["x", "yes"] });
    expect(JSON.parse(D.yamlToJson("a: 1\n---\nb: 2"))).toEqual([{ a: 1 }, { b: 2 }]);
    expect(() => D.yamlToJson("a: [1, 2")).toThrow(/Invalid YAML/);
  });
  it("formats XML and detects mismatched tags", () => {
    expect(D.formatXml("<a><b>t</b><c/></a>")).toBe("<a>\n  <b>t</b>\n  <c/>\n</a>");
    expect(() => D.formatXml("<a><b></a>")).toThrow(/Mismatched/);
    expect(() => D.formatXml("<a>")).toThrow(/Unclosed/);
    expect(D.formatXml('<?xml version="1.0"?><r><!-- c --></r>')).toContain("<!-- c -->");
  });
});

describe("encodings", () => {
  it("Base64 with UTF-8 and URL-safe", () => {
    expect(D.base64Encode("Hello, World!")).toBe("SGVsbG8sIFdvcmxkIQ==");
    expect(D.base64Decode(D.base64Encode("Ünïcödé ✓"))).toBe("Ünïcödé ✓");
    expect(D.base64Encode("??>", { urlSafe: true })).toBe("Pz8-");
    expect(D.base64Decode("Pz8-")).toBe("??>");
    expect(D.base64Decode("data:text/plain;base64,SGk=")).toBe("Hi");
    expect(() => D.base64Decode("@@@")).toThrow();
    expect(() => D.base64Decode("/w==")).toThrow(/binary/);
  });
  it("URL encode/decode", () => {
    expect(D.urlEncode("a b&c")).toBe("a%20b%26c");
    expect(D.urlEncode("a b", "form")).toBe("a+b");
    expect(D.urlEncode("https://x.com/a b?q=1", "uri")).toBe("https://x.com/a%20b?q=1");
    expect(D.urlDecode("a+b%26c")).toBe("a b&c");
    expect(() => D.urlDecode("%")).toThrow(/invalid percent/);
    expect(D.parseUrlParams("https://x.com/p?a=1&b=two")?.params).toEqual([["a", "1"], ["b", "two"]]);
  });
  it("HTML entities", () => {
    expect(D.htmlEntityEncodeMinimal(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(D.htmlEntityDecode("&lt;p&gt;Caf&eacute; &#169; &#x1F600;")).toBe("<p>Café © 😀");
    expect(D.htmlEntityEncode("©", "basic")).toBe("&copy;");
  });
  it("JWT decode", () => {
    const tok = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJleHAiOjEwMDAwMDAwMDB9.sig";
    const j = D.decodeJwt("Bearer " + tok);
    expect(j.header.alg).toBe("HS256");
    expect(j.payload.sub).toBe("123");
    expect(j.expired).toBe(true);
    expect(() => D.decodeJwt("a.b")).toThrow(/3 dot-separated/);
    expect(() => D.decodeJwt("a.b.c")).toThrow(/header/);
  });
});

describe("ids & hashes", () => {
  it("generates valid UUIDs", () => {
    expect(D.isUuid(D.uuidV4())).toBe(true);
    const v7 = D.uuidV7(1700000000000);
    expect(D.isUuid(v7)).toBe(true);
    expect(v7[14]).toBe("7");
    expect(v7.slice(0, 8)).toBe("018bcfe5");
    expect(D.uuidV7(1) < D.uuidV7(2)).toBe(true);
  });
  it("SHA-256 and HMAC match known vectors", async () => {
    expect(await D.shaDigest("SHA-256", "abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await D.shaDigest("SHA-256", "")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await D.hmacSha256("key", "The quick brown fox jumps over the lazy dog")).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });
});

describe("regex, timestamps, cron, minify", () => {
  it("runs regex with groups and validates flags", () => {
    const r = D.runRegex("(\\w+)@(\\w+)", "g", "a@b c@d");
    expect(r.matches.map((m) => m.groups)).toEqual([["a", "b"], ["c", "d"]]);
    expect(D.runRegex("(?<user>\\w+)@", "", "x@y").matches[0].named).toEqual({ user: "x" });
    expect(() => D.runRegex("a", "q", "")).toThrow(/Unknown flag/);
    expect(() => D.runRegex("(", "", "")).toThrow();
    expect(D.runRegex("a", "g", "a".repeat(2000), 10).truncated).toBe(true);
  });
  it("detects timestamp units", () => {
    expect(D.parseTimestamp("1700000000").unit).toBe("seconds");
    expect(D.parseTimestamp("1700000000000").unit).toBe("milliseconds");
    expect(D.parseTimestamp("1700000000000000").unit).toBe("microseconds");
    expect(D.parseTimestamp("1700000000").date.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(() => D.parseTimestamp("abc")).toThrow();
  });
  it("parses cron and computes next runs", () => {
    const from = new Date(2026, 0, 5, 8, 59); // Monday 08:59 local
    const runs = D.nextCronRuns("*/15 9-17 * * 1-5", 3, from);
    expect(runs.map((d) => [d.getHours(), d.getMinutes()])).toEqual([[9, 0], [9, 15], [9, 30]]);
    expect(D.nextCronRuns("@daily", 1, from)[0].getHours()).toBe(0);
    expect(D.nextCronRuns("0 12 * jan sun", 1, from)[0].getDay()).toBe(0);
    expect(() => D.parseCron("* * *")).toThrow(/5 fields/);
    expect(() => D.parseCron("60 * * * *")).toThrow(/out of range/);
    // DOM and DOW both restricted → OR semantics
    const r = D.nextCronRuns("0 0 13 * 5", 5, new Date(2026, 0, 1));
    expect(r.every((d) => d.getDate() === 13 || d.getDay() === 5)).toBe(true);
  });
  it("basic css minify keeps strings", () => {
    expect(D.minifyCssBasic('a { content: "  x  " ; color : red ; } /* c */')).toBe('a{content:"  x  ";color:red}');
    expect(D.sizeReport("aaaa", "aa").percent).toBe(50);
  });
});
