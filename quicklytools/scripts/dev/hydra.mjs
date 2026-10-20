import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const id of process.argv.slice(3)) {
  for (let k = 0; k < 3; k++) {
    const p = await b.newPage();
    p.on("console", (m) => m.type() === "error" && console.log(id, m.text().slice(0, 1500)));
    p.on("pageerror", (e) => console.log(id, "PAGEERROR", e.message.slice(0, 1500)));
    await p.goto(process.argv[2] + "/tools/" + id, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    await p.close();
  }
}
await b.close();
