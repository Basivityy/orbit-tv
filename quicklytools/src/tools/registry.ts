/**
 * Code-level tool registry. Server and client safe (no DB access).
 * Admin overrides are merged in src/lib/catalog.ts.
 */
import type { CategoryId, ToolDefinition } from "./types";
import { imageTools } from "./content/image";
import { pdfTools } from "./content/pdf";
import { textTools } from "./content/text";
import { developerTools } from "./content/developer";
import { calculatorTools } from "./content/calculators";
import { generatorTools } from "./content/generators";
import { browserTools } from "./content/browser";
import { utilityTools } from "./content/utilities";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...imageTools,
  ...pdfTools,
  ...textTools,
  ...developerTools,
  ...calculatorTools,
  ...generatorTools,
  ...browserTools,
  ...utilityTools,
];

export const TOOL_BY_ID: ReadonlyMap<string, ToolDefinition> = new Map(TOOL_DEFINITIONS.map((t) => [t.id, t]));

export function getDefinition(id: string): ToolDefinition | undefined {
  return TOOL_BY_ID.get(id);
}

export function definitionsByCategory(category: CategoryId): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((t) => t.category === category);
}
