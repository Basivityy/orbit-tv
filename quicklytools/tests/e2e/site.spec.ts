import { expect, test } from "@playwright/test";

test("home page SEO and navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Free Online Tools/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(ld!)["@graph"][0]["@type"]).toBe("WebSite");
  await page.getByRole("link", { name: /All \d+ tools/ }).click();
  await expect(page.locator("h1")).toHaveText("All tools");
});

test("search finds tools", async ({ page, isMobile }) => {
  test.skip(isMobile, "header search is inside the mobile menu");
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search tools" }).first().fill("merge pdf");
  await page.getByRole("option").first().click();
  await expect(page).toHaveURL(/\/tools\/merge-pdf$/);
});

test("tool page structured data is valid JSON-LD", async ({ page }) => {
  await page.goto("/tools/loan-calculator");
  const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!)["@graph"];
  const types = graph.map((g: { "@type": string }) => g["@type"]);
  expect(types).toEqual(expect.arrayContaining(["WebApplication", "BreadcrumbList", "FAQPage"]));
});

test("404 and robots/sitemap", async ({ page, request }) => {
  const r = await page.goto("/this-does-not-exist");
  expect(r?.status()).toBe(404);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect((sitemap.match(/<loc>/g) || []).length).toBeGreaterThan(180);
});

test("favorites and recent tools persist locally", async ({ page }) => {
  await page.goto("/tools/uuid-generator");
  await page.getByRole("button", { name: /Save/ }).first().click();
  await page.goto("/");
  await expect(page.getByText("Your favorites")).toBeVisible();
  await expect(page.getByText("Recently used")).toBeVisible();
});

test("dark mode toggle", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  for (let i = 0; i < 3 && !(await html.getAttribute("class"))?.includes("dark"); i++) await page.getByRole("button", { name: /Theme/ }).click();
  await expect(html).toHaveClass(/dark/);
});

test("API rate limiting on /api/ip", async ({ request }) => {
  let limited = false;
  for (let i = 0; i < 40; i++) {
    const r = await request.get("/api/ip", { headers: { "x-real-ip": "203.0.113.77" } });
    if (r.status() === 429) {
      limited = true;
      expect(r.headers()["retry-after"]).toBeTruthy();
      break;
    }
  }
  expect(limited).toBe(true);
});
