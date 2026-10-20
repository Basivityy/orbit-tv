/** Setting schemas and defaults. Shared by server data layer and admin forms. */
import { z } from "zod";

const link = z.object({ label: z.string().trim().min(1).max(60), href: z.string().trim().min(1).max(300) });

const safeHref = (s: string) => s.startsWith("/") || /^https?:\/\//i.test(s) || s.startsWith("mailto:");

export const linkSchema = link.refine((l) => safeHref(l.href), { message: "Links must start with /, http(s):// or mailto:" });

export const siteSchema = z.object({
  name: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(160),
  contactEmail: z.string().trim().max(200),
  organizationName: z.string().trim().max(120),
  twitterHandle: z.string().trim().max(40),
  defaultOgImage: z.string().trim().max(500),
  googleSiteVerification: z.string().trim().max(200),
  bingSiteVerification: z.string().trim().max(200),
});
export type SiteSettings = z.infer<typeof siteSchema>;

export const homeSchema = z.object({
  heroTitle: z.string().trim().min(1).max(120),
  heroSubtitle: z.string().trim().max(300),
  seoTitle: z.string().trim().max(120),
  metaDescription: z.string().trim().max(320),
  featuredToolIds: z.array(z.string()).max(24),
  introMarkdown: z.string().max(20_000),
});
export type HomeSettings = z.infer<typeof homeSchema>;

export const navSchema = z.object({ links: z.array(linkSchema).max(12) });
export type NavSettings = z.infer<typeof navSchema>;

export const footerSchema = z.object({
  about: z.string().trim().max(400),
  columns: z.array(z.object({ title: z.string().trim().min(1).max(40), links: z.array(linkSchema).max(12) })).max(5),
  copyright: z.string().trim().max(200),
});
export type FooterSettings = z.infer<typeof footerSchema>;

export const AD_POSITIONS = ["belowHeader", "belowTitle", "belowTool", "sidebar", "inContent"] as const;
export type AdPosition = (typeof AD_POSITIONS)[number];

export const AD_POSITION_LABELS: Record<AdPosition, string> = {
  belowHeader: "Below header (all pages)",
  belowTitle: "Below tool title",
  belowTool: "Below tool interface",
  sidebar: "Desktop sidebar",
  inContent: "Between content sections",
};

export const adsSchema = z.object({
  enabled: z.boolean(),
  publisherId: z
    .string()
    .trim()
    .regex(/^(ca-pub-\d{10,20})?$/, "Publisher ID looks like ca-pub-1234567890123456"),
  slots: z.record(z.enum(AD_POSITIONS), z.object({ enabled: z.boolean(), slotId: z.string().trim().regex(/^\d{0,20}$/, "Ad unit IDs are numeric") })),
  disabledCategories: z.array(z.string()).max(20),
  disabledTools: z.array(z.string()).max(500),
  consentMode: z.enum(["builtin", "google-cmp", "none"]),
  euOnlyBanner: z.boolean(),
  adsTxtExtra: z.string().max(5000),
});
export type AdsSettings = z.infer<typeof adsSchema>;

export const DEFAULT_SITE: SiteSettings = {
  name: process.env.SITE_NAME || "ToolOrbit",
  tagline: "Free, fast and private online tools that run in your browser.",
  contactEmail: process.env.CONTACT_EMAIL || "hello@example.com",
  organizationName: process.env.SITE_NAME || "ToolOrbit",
  twitterHandle: "",
  defaultOgImage: "",
  googleSiteVerification: "",
  bingSiteVerification: "",
};

export const DEFAULT_HOME: HomeSettings = {
  heroTitle: "Free online tools that respect your privacy",
  heroSubtitle: "180+ fast tools for images, PDFs, text, code and everyday calculations. Most run entirely in your browser — your files never leave your device.",
  seoTitle: "",
  metaDescription: "",
  featuredToolIds: [],
  introMarkdown:
    "## Why our tools are different\n\nMost online converters upload your files to a server. Ours don't need to: images, PDFs and text are processed with your browser's own engine and WebAssembly. That means **no waiting for uploads, no file size games and no copies of your documents on someone else's computer**.\n\n## Free, without sign-up\n\nEvery tool works instantly without an account. The site is funded by unobtrusive advertising that never interferes with the tools themselves.",
};

export const DEFAULT_NAV: NavSettings = {
  links: [
    { label: "All tools", href: "/tools" },
    { label: "Image", href: "/category/image-tools" },
    { label: "PDF", href: "/category/pdf-tools" },
    { label: "Developer", href: "/category/developer-tools" },
    { label: "Calculators", href: "/category/calculators" },
  ],
};

export const DEFAULT_FOOTER: FooterSettings = {
  about: "Fast, private online tools. Most processing happens in your browser, so your files stay on your device.",
  columns: [
    {
      title: "Popular",
      links: [
        { label: "Merge PDF", href: "/tools/merge-pdf" },
        { label: "Image Compressor", href: "/tools/image-compressor" },
        { label: "JSON Formatter", href: "/tools/json-formatter" },
        { label: "QR Code Generator", href: "/tools/qr-code-generator" },
        { label: "Word Counter", href: "/tools/word-counter" },
      ],
    },
    {
      title: "Categories",
      links: [
        { label: "Image tools", href: "/category/image-tools" },
        { label: "PDF tools", href: "/category/pdf-tools" },
        { label: "Text tools", href: "/category/text-tools" },
        { label: "Developer tools", href: "/category/developer-tools" },
        { label: "Calculators", href: "/category/calculators" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "FAQ", href: "/faq" },
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Terms of Service", href: "/terms-of-service" },
      ],
    },
  ],
  copyright: "© {year} {siteName}. All rights reserved.",
};

export const DEFAULT_ADS: AdsSettings = {
  enabled: false,
  publisherId: "",
  slots: {
    belowHeader: { enabled: false, slotId: "" },
    belowTitle: { enabled: false, slotId: "" },
    belowTool: { enabled: true, slotId: "" },
    sidebar: { enabled: true, slotId: "" },
    inContent: { enabled: true, slotId: "" },
  },
  disabledCategories: [],
  disabledTools: [],
  consentMode: "builtin",
  euOnlyBanner: false,
  adsTxtExtra: "",
};

export const SETTING_DEFAULTS = {
  site: { schema: siteSchema, value: DEFAULT_SITE },
  home: { schema: homeSchema, value: DEFAULT_HOME },
  nav: { schema: navSchema, value: DEFAULT_NAV },
  footer: { schema: footerSchema, value: DEFAULT_FOOTER },
  ads: { schema: adsSchema, value: DEFAULT_ADS },
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export interface AllSettings {
  site: SiteSettings;
  home: HomeSettings;
  nav: NavSettings;
  footer: FooterSettings;
  ads: AdsSettings;
}
