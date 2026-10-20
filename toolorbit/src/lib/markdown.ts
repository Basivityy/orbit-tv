import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Renders admin-authored Markdown to sanitized HTML (defence in depth against XSS). */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false, gfm: true }) as string;
  return sanitizeHtml(raw, {
    allowedTags: ["h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "a", "code", "pre", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "br", "hr", "del", "img"],
    allowedAttributes: { a: ["href", "title", "rel", "target"], img: ["src", "alt", "width", "height", "loading"], th: ["align"], td: ["align"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => {
        const external = /^https?:\/\//i.test(attribs.href ?? "");
        return { tagName, attribs: external ? { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" } : attribs };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
      h1: "h2",
    },
  });
}

/** Plain text paragraphs (blank-line separated) → array. */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
