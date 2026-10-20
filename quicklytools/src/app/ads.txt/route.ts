import { getSettings } from "@/lib/data";

export const revalidate = 3600;

/** ads.txt authorises Google to sell ads on this domain (required by AdSense). */
export async function GET() {
  const s = await getSettings();
  const lines: string[] = [];
  if (s.ads.publisherId) lines.push(`google.com, ${s.ads.publisherId.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0`);
  if (s.ads.adsTxtExtra.trim()) lines.push(s.ads.adsTxtExtra.trim());
  const body = lines.length ? lines.join("\n") + "\n" : "# No advertising partners configured.\n";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
