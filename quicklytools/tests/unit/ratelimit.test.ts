import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";
import { validatePasswordStrength, hashPassword, verifyPassword } from "@/lib/password";
import { renderMarkdown } from "@/lib/markdown";
import { jsonLdString } from "@/lib/seo";

describe("rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5, 60_000).ok).toBe(true);
    const r = rateLimit(key, 5, 60_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });
});

describe("passwords", () => {
  it("enforces strength", () => {
    expect(validatePasswordStrength("short")).toMatch(/12/);
    expect(validatePasswordStrength("alllowercaseletters")).toMatch(/three/);
    expect(validatePasswordStrength("Good-Password-2026")).toBeNull();
  });
  it("hashes with argon2id and verifies", async () => {
    const h = await hashPassword("Good-Password-2026");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "Good-Password-2026")).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
    expect(await verifyPassword(null, "x")).toBe(false);
  });
});

describe("XSS protection", () => {
  it("sanitises admin markdown", () => {
    const html = renderMarkdown('# T\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1)) [ok](https://e.com)');
    expect(html).not.toMatch(/<script|onerror=|href="javascript:/i);
    expect(html).toContain('<h2>T</h2>');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
  it("escapes JSON-LD", () => {
    expect(jsonLdString({ a: "</script><script>" })).not.toContain("</script>");
  });
});
