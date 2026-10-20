import { headers } from "next/headers";
import { clientIp } from "@/lib/request";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/** Returns the caller's public IP. No logging, no storage, never cached. */
export async function GET() {
  const h = await headers();
  const ip = clientIp(h);
  const rl = rateLimit(`ip:${ip}`, 30, 60_000);
  if (!rl.ok) return tooMany(rl);
  track("use", "what-is-my-ip");
  const version = ip.includes(":") && !/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip) ? "IPv6" : "IPv4";
  const display = ip.replace(/^::ffff:/i, "");
  const country = h.get("cf-ipcountry");
  return Response.json(
    { ip: display, version, country: country && country !== "XX" && country !== "T1" ? country : null },
    { headers: { "cache-control": "private, no-store, max-age=0", "access-control-allow-origin": "*", vary: "*" } },
  );
}
