// Labs for the Research Intelligence path: lesson `lab` key -> lazily loaded component.
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export const RESEARCH_LABS: Record<string, LazyExoticComponent<ComponentType>> = {
  "ri-screen": lazy(() => import("./ScreenLab")),
  "ri-semantic": lazy(() => import("./SemanticLab")),
  "ri-rag": lazy(() => import("./RagLab")),
  "ri-mcp": lazy(() => import("./McpLab")),
  "ri-capstone": lazy(() => import("./ReviewBoard")),
};
