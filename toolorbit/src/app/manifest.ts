import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/data";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: s.site.name,
    short_name: s.site.name.slice(0, 12),
    description: s.site.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#0b0f19",
    theme_color: "#4f46e5",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
