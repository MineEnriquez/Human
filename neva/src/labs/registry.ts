// Lab registry: a lesson's `lab` key -> its component (code-split, loaded on demand).
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { MODELING_LABS } from "./modeling";
import { SOFTWARE_LABS } from "./software";
import { RESEARCH_LABS } from "./research";

export const LABS: Record<string, LazyExoticComponent<ComponentType>> = {
  ...SOFTWARE_LABS,
  // Cancer Genomics
  "cg-llm": lazy(() => import("./cancer/LlmLab")),
  "cg-vdb": lazy(() => import("./cancer/VectorDbLab")),
  "cg-rag": lazy(() => import("./cancer/RagLab")),
  "cg-mcp": lazy(() => import("./cancer/McpLab")),
  "cg-capstone": lazy(() => import("./cancer/TumorBoard")),
  ...MODELING_LABS,
  ...RESEARCH_LABS,
};
