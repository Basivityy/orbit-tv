import type { ComponentType } from "react";
import type { CategoryId } from "./types";

type ToolModule = { default: Record<string, ComponentType> };

/**
 * One lazily-loaded chunk per category. A tool page downloads only the
 * implementation chunk of its own category; heavy libraries inside those
 * modules (pdf.js, codecs, terser…) are imported on demand on top of that.
 */
export const TOOL_LOADERS: Record<CategoryId, () => Promise<ToolModule>> = {
  image: () => import("./impl/image"),
  pdf: () => import("./impl/pdf"),
  text: () => import("./impl/text"),
  developer: () => import("./impl/developer"),
  calculators: () => import("./impl/calculators"),
  generators: () => import("./impl/generators"),
  browser: () => import("./impl/browser"),
  utilities: () => import("./impl/utilities"),
};
