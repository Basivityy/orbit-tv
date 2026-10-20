import { ImageResponse } from "next/og";
import { getSettings, getToolBySlug } from "@/lib/data";

export const alt = "Tool preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [tool, settings] = await Promise.all([getToolBySlug(slug), getSettings()]);
  const title = tool?.name ?? settings.site.name;
  const desc = tool?.description ?? settings.site.tagline;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #0b0f19 0%, #1e1b4b 60%, #155e75 100%)", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#22d3ee)", display: "flex" }} />
          {settings.site.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 32, color: "#cbd5e1", lineHeight: 1.35 }}>{desc.length > 140 ? desc.slice(0, 137) + "…" : desc}</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 26, color: "#a5b4fc" }}>Free · No sign-up · Private</div>
      </div>
    ),
    size,
  );
}
