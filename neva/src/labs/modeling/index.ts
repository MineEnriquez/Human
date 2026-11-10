// Labs for the Outbreak Modeling path: lesson `lab` key -> lazily loaded component.
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export const MODELING_LABS: Record<string, LazyExoticComponent<ComponentType>> = {
  "om-llm": lazy(() => import("./ParameterLab")),
  "om-vdb": lazy(() => import("./AnalogueLab")),
  "om-rag": lazy(() => import("./RagLab")),
  "om-mcp": lazy(() => import("./McpLab")),
  "om-capstone": lazy(() => import("./BriefingRoom")),
};
