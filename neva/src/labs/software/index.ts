// Labs for the AI for Software Engineers path: lesson `lab` key -> lazily loaded component.
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export const SOFTWARE_LABS: Record<string, LazyExoticComponent<ComponentType>> = {
  "se-llm": lazy(() => import("./LlmLab")),
  "se-vdb": lazy(() => import("./VectorDbLab")),
  "se-rag": lazy(() => import("./RagLab")),
  "se-mcp": lazy(() => import("./McpLab")),
  "se-capstone": lazy(() => import("./IncidentRoom")),
};
