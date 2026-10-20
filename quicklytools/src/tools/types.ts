/** Shared tool registry types. This module is safe to import on server and client. */

export type CategoryId =
  | "image"
  | "pdf"
  | "text"
  | "developer"
  | "calculators"
  | "generators"
  | "browser"
  | "utilities";

/** Where the tool's work happens. Shown to users so the privacy claim is honest. */
export type ProcessingMode = "browser" | "server" | "network";

export interface FaqItem {
  q: string;
  a: string;
}

/** Code-level definition of a tool, including its default SEO content. */
export interface ToolDefinition {
  /** Immutable id. Also the default URL slug. Never change it after launch. */
  id: string;
  name: string;
  category: CategoryId;
  /** lucide icon key from src/components/icons.tsx */
  icon: string;
  /** One-sentence summary (used as default meta description, <= 160 chars). */
  summary: string;
  /** Opening paragraph(s) shown under the tool. Plain text, paragraphs separated by blank lines. */
  intro: string;
  /** How to use it. */
  steps: string[];
  /** Limitations / technical notes that must be honest. */
  notes: string[];
  faq: FaqItem[];
  keywords: string[];
  related: string[];
  processing: ProcessingMode;
  popular?: boolean;
  /** Optional default SEO title. Falls back to `${name} – Free Online Tool`. */
  seoTitle?: string;
}

export interface CategoryDefinition {
  id: CategoryId;
  name: string;
  slug: string;
  icon: string;
  description: string;
  intro: string;
  order: number;
}
