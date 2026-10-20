import type { CategoryDefinition, CategoryId } from "./types";

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: "image",
    name: "Image Tools",
    slug: "image-tools",
    icon: "image",
    order: 1,
    description: "Convert, compress, resize and inspect images privately in your browser.",
    intro:
      "Every image tool on this page decodes and re-encodes pictures with your browser's own image engine (and WebAssembly codecs for AVIF and HEIC). Your photos are never uploaded, which makes the tools fast on large files and safe for private pictures.",
  },
  {
    id: "pdf",
    name: "PDF Tools",
    slug: "pdf-tools",
    icon: "file-text",
    order: 2,
    description: "Merge, split, rotate, protect and convert PDF files without uploading them.",
    intro:
      "These PDF tools edit documents locally using pdf-lib and Mozilla's PDF.js. Contracts, invoices and scans stay on your device, and you can work with large documents without waiting for uploads.",
  },
  {
    id: "text",
    name: "Text Tools",
    slug: "text-tools",
    icon: "type",
    order: 3,
    description: "Count, clean, convert and compare text instantly.",
    intro:
      "Quick utilities for writers, students and editors: count words, change letter case, remove duplicates, compare two versions and more. Results update as you type and nothing leaves your browser.",
  },
  {
    id: "developer",
    name: "Developer Tools",
    slug: "developer-tools",
    icon: "code",
    order: 4,
    description: "Format, validate, encode and convert data formats used every day by developers.",
    intro:
      "JSON, YAML, CSV, XML, Base64, JWT, hashes, regular expressions and more. Paste data that may contain secrets without worry: all processing runs client-side.",
  },
  {
    id: "calculators",
    name: "Calculators",
    slug: "calculators",
    icon: "calculator",
    order: 5,
    description: "Finance, business, everyday and unit calculators with transparent formulas.",
    intro:
      "Loan, mortgage, interest, tax, margin and everyday calculators. Each calculator shows the formula it uses so you can verify the result. Results are estimates and not financial advice.",
  },
  {
    id: "generators",
    name: "Generators",
    slug: "generators",
    icon: "sparkles",
    order: 6,
    description: "QR codes, barcodes, passwords, CSS snippets and SEO tags in seconds.",
    intro:
      "Generate QR codes, barcodes, secure passwords, random values, CSS effects and web metadata. Random values use the browser's cryptographically secure generator.",
  },
  {
    id: "browser",
    name: "Browser & Privacy",
    slug: "browser-tools",
    icon: "globe",
    order: 7,
    description: "See what your browser reveals and test device features.",
    intro:
      "Check what websites can learn about your browser, screen and device, and test hardware such as your keyboard and mouse. Information is read with standard web APIs and is not stored.",
  },
  {
    id: "utilities",
    name: "Utilities & Converters",
    slug: "utilities",
    icon: "wrench",
    order: 8,
    description: "Number systems, units, colors, timers and network checks.",
    intro:
      "Lightweight converters and utilities: number bases, Roman numerals, CSS units, color formats, timestamps, timers and simple network checks.",
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  CategoryDefinition
>;

export function isCategoryId(value: string): value is CategoryId {
  return value in CATEGORY_BY_ID;
}
