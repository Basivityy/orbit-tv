import { ImageResponse } from "next/og";
import { getSettings } from "@/lib/data";

export const alt = "Free online tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image() {
  const s = await getSettings();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #0b0f19 0%, #1e1b4b 60%, #155e75 100%)", color: "#fff" }}>
        <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2 }}>{s.site.name}</div>
        <div style={{ fontSize: 38, color: "#cbd5e1", marginTop: 20, maxWidth: 950 }}>{s.site.tagline}</div>
      </div>
    ),
    size,
  );
}
