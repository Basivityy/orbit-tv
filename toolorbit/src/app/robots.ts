import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // Staging/preview deployments can disable indexing entirely.
  if (process.env.ROBOTS_DISALLOW_ALL === "true") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
