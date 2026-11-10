// Lab registry: a lesson's `lab` key -> its component (code-split, loaded on demand).
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { MODELING_LABS } from "./modeling";
import { RESEARCH_LABS } from "./research";

export const LABS: Record<string, LazyExoticComponent<ComponentType>> = {
  // Pathogen Genomics
  llm: lazy(() => import("./pathogen/LlmLab")),
  vectordb: lazy(() => import("./pathogen/VectorDbLab")),
  rag: lazy(() => import("./pathogen/RagLab")),
  mcp: lazy(() => import("./pathogen/McpLab")),
  outbreak: lazy(() => import("./pathogen/OutbreakRoom")),
  ...MODELING_LABS,
  ...RESEARCH_LABS,
};
