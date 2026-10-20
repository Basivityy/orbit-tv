import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * Public pages must allow Google AdSense / Funding Choices (consent) domains.
 * Next.js injects inline bootstrap scripts, and ISR pages cannot carry a per-request
 * nonce, so 'unsafe-inline' is required for scripts on public pages. Everything else
 * (objects, framing, base-uri, form targets) is locked down. 'wasm-unsafe-eval' allows
 * WebAssembly codecs (AVIF/HEIC) without enabling JavaScript eval.
 */
const adsDomains = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://*.google.com",
  "https://*.gstatic.com",
  "https://*.googleadservices.com",
  "https://*.adtrafficquality.google",
  "https://fundingchoicesmessages.google.com",
].join(" ");

const ipv6Origin = (() => {
  try {
    return process.env.NEXT_PUBLIC_IPV6_TEST_URL ? new URL(process.env.NEXT_PUBLIC_IPV6_TEST_URL).origin : "";
  } catch {
    return "";
  }
})();

// React Refresh needs eval() in development only.
const devEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

const publicCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${devEval} blob: ${adsDomains}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' blob: data: ${adsDomains} ${ipv6Origin}`.trim(),
  `frame-src ${adsDomains}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const adminCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devEval}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const commonSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  serverExternalPackages: ["@node-rs/argon2", "sanitize-html"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...commonSecurityHeaders, { key: "Content-Security-Policy", value: publicCsp }],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Content-Security-Policy", value: adminCsp },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
