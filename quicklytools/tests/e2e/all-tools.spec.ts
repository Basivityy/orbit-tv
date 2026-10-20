import { expect, test } from "@playwright/test";
import { TOOL_DEFINITIONS } from "../../src/tools/registry";

/** Every tool page must render server-side SEO and mount its interactive UI without errors. */
for (const tool of TOOL_DEFINITIONS) {
  test(`tool page renders: ${tool.id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !/adsbygoogle|Failed to load resource|favicon/i.test(m.text())) errors.push(m.text());
    });
    const res = await page.goto(`/tools/${tool.id}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText(tool.name);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/tools/${tool.id}$`));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", tool.summary);
    // The interactive tool replaces the loading placeholder.
    const panel = page.locator(`section[aria-label="${tool.name} tool"]`);
    await expect(panel.getByText("Loading tool…")).toHaveCount(0);
    await expect(panel.getByText("Something went wrong in this tool")).toHaveCount(0);
    await expect(panel.getByText("could not be loaded")).toHaveCount(0);
    // Interactive controls, or (for information tools) rendered results.
    await expect.poll(async () => (await panel.locator("input, textarea, button, select, canvas, dl, table, [role=alert], [role=img]").count()) + ((await panel.innerText()).trim().length > 40 ? 1 : 0)).toBeGreaterThan(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
