import { expect, test } from "@playwright/test";

/**
 * Requires an admin created with:
 *   ADMIN_EMAIL=e2e-owner@example.com ADMIN_PASSWORD='E2e-Owner-Password-1!' npm run admin:create -- --yes
 *   ADMIN_EMAIL=e2e-editor@example.com ADMIN_PASSWORD='E2e-Editor-Password-1!' ADMIN_ROLE=EDITOR npm run admin:create -- --yes
 */
const OWNER = { email: "e2e-owner@example.com", password: "E2e-Owner-Password-1!" };
const EDITOR = { email: "e2e-editor@example.com", password: "E2e-Editor-Password-1!" };

async function login(page: import("@playwright/test").Page, u: { email: string; password: string }) {
  await page.goto("/admin/login");
  await page.fill("input[name=email]", u.email);
  await page.fill("input[name=password]", u.password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/admin");
}

test.describe.configure({ mode: "serial" });

test("unauthenticated users are redirected and APIs not cached", async ({ page }) => {
  const r = await page.goto("/admin/tools");
  expect(page.url()).toContain("/admin/login");
  expect(r?.headers()["cache-control"]).toContain("no-store");
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/admin/login");
  await page.fill("input[name=email]", OWNER.email);
  await page.fill("input[name=password]", "nope-nope-nope");
  await page.click("button[type=submit]");
  await expect(page.getByRole("status")).toContainText(/Invalid email or password|Too many/);
});

test("owner edits SEO and the public HTML changes, then reverts", async ({ page, request }) => {
  await login(page, OWNER);
  await page.goto("/admin/tools/sort-lines");
  const title = `Sort Lines Online E2E ${Date.now()}`;
  await page.fill("input[name=title]", title);
  await page.click("text=Save & publish SEO");
  await expect(page.getByText(/field\(s\) updated/)).toBeVisible();
  expect(await (await request.get("/tools/sort-lines")).text()).toContain(title);
  await page.goto("/admin/seo/history?tool=sort-lines");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Revert" }).first().click();
  await expect.poll(async () => (await (await request.get("/tools/sort-lines")).text()).includes(title)).toBe(false);
});

test("editor cannot access users, ads or redirects", async ({ page }) => {
  await login(page, EDITOR);
  for (const path of ["/admin/users", "/admin/ads", "/admin/redirects"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/denied=1/);
  }
  await page.goto("/admin/seo");
  await expect(page.locator("h1")).toHaveText("SEO manager");
});
