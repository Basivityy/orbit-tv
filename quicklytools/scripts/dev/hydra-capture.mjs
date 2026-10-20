import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const base = process.argv[2];
const ids = (await (await fetch(base + "/search-index.json")).json()).map((e) => e.s);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let found = 0;
async function visit(id) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  let html = "";
  let err = null;
  p.on("response", async (r) => { if (r.request().resourceType() === "document") html = await r.text().catch(() => ""); });
  p.on("pageerror", (e) => { if (e.message.includes("418")) err = e.message; });
  p.on("console", (m) => { if (m.text().includes("418")) err = m.text(); });
  await p.goto(`${base}/tools/${id}`, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(300);
  if (err && found < 3) {
    found++;
    writeFileSync(`/tmp/claude-0/h-${id}-server.html`, html);
    writeFileSync(`/tmp/claude-0/h-${id}-client.html`, await p.content());
    console.log("418 on", id);
  }
  await ctx.close();
}
for (let i = 0; i < ids.length; i += 8) await Promise.all(ids.slice(i, i + 8).map(visit));
console.log("done, found", found);
await b.close();
