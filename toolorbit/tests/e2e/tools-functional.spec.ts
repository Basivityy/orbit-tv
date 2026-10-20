import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "@cantoo/pdf-lib";

const PNG_1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

async function pdf(pages: number) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([300, 400]).drawText(`Page ${i + 1}`, { x: 20, y: 20 });
  return Buffer.from(await d.save());
}

async function tool(page: Page, id: string) {
  await page.goto(`/tools/${id}`);
  await expect(page.locator("section[aria-label$=' tool']").getByText("Loading tool…")).toHaveCount(0);
}

test("JSON formatter formats and reports errors", async ({ page }) => {
  await tool(page, "json-formatter");
  await page.locator("#tool-input").fill('{"b":1,"a":[1,2]}');
  await expect(page.locator("#tool-output")).toHaveValue('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}');
  await page.locator("#tool-input").fill('{"a":1,}');
  await expect(page.locator("main [role=alert]")).toContainText("Invalid JSON");
});

test("word counter counts live", async ({ page }) => {
  await tool(page, "word-counter");
  await page.locator("#stats-input").fill("The quick brown fox. It's well-known!");
  await expect(page.locator("dl").first()).toContainText("6");
});

test("percentage calculator", async ({ page }) => {
  await tool(page, "percentage-calculator");
  await page.locator("#calc-x").fill("15");
  await page.locator("#calc-y").fill("240");
  await expect(page.getByText("15% of 240").first()).toBeVisible();
  await expect(page.locator("dd").first()).toHaveText("36");
});

test("mortgage calculator rejects impossible input", async ({ page }) => {
  await tool(page, "mortgage-calculator");
  await page.locator("#calc-down").fill("500000");
  await expect(page.locator("main [role=alert]")).toContainText("less than the home price");
});

test("PNG to JPG converts locally and downloads", async ({ page }) => {
  await tool(page, "png-to-jpg");
  await page.locator('input[type="file"]').setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG_1x1 });
  await expect(page.getByText("dot.jpg")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download/ }).first().click()]);
  expect(download.suggestedFilename()).toBe("dot.jpg");
});

test("image upload rejects empty and wrong files", async ({ page }) => {
  await tool(page, "png-to-jpg");
  await page.locator('input[type="file"]').setInputFiles({ name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0) });
  await expect(page.locator("main [role=alert]")).toContainText("file is empty");
});

test("merge PDF combines files", async ({ page }) => {
  await tool(page, "merge-pdf");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: await pdf(2) },
    { name: "b.pdf", mimeType: "application/pdf", buffer: await pdf(3) },
  ]);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Merge 2 files \(5 pages\)/ }).click()]);
  const bytes = await (await download.createReadStream()).toArray();
  const merged = await PDFDocument.load(Buffer.concat(bytes));
  expect(merged.getPageCount()).toBe(5);
});

test("PDF password protect then unlock", async ({ page }) => {
  await tool(page, "pdf-password-protect");
  await page.locator('input[type="file"]').setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: await pdf(1) });
  await page.locator("#pp-1").fill("correct-horse-battery");
  await page.locator("#pp-2").fill("correct-horse-battery");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Protect PDF/ }).click()]);
  const enc = Buffer.concat(await (await download.createReadStream()).toArray());
  const loaded = await PDFDocument.load(enc, { ignoreEncryption: true });
  expect(loaded.isEncrypted).toBe(true);

  await tool(page, "pdf-unlock");
  await page.locator('input[type="file"]').setInputFiles({ name: "doc-protected.pdf", mimeType: "application/pdf", buffer: enc });
  await page.locator("#ul-p").fill("wrong");
  await page.getByRole("button", { name: /Unlock/ }).click();
  await expect(page.locator("main [role=alert]")).toContainText("incorrect");
});

test("QR generator renders a canvas and SVG download", async ({ page }) => {
  await tool(page, "qr-code-generator");
  await expect(page.locator("canvas[aria-label='QR code preview']")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "SVG" }).click()]);
  expect(download.suggestedFilename()).toBe("qr-code.svg");
});

test("password generator produces requested length", async ({ page }) => {
  await tool(page, "password-generator");
  const pw = await page.locator("code").first().textContent();
  expect(pw?.length).toBe(20);
});

test("what is my IP returns an address", async ({ page }) => {
  await tool(page, "what-is-my-ip");
  await expect(page.locator("p.font-mono").first()).not.toHaveText("Detecting…");
});
