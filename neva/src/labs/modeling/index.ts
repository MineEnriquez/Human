// Labs for the Disease Modeling path: lesson `lab` key -> lazily loaded component.
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export const MODELING_LABS: Record<string, LazyExoticComponent<ComponentType>> = {
  "dm-llm": lazy(() => import("./ParameterLab")),
  "dm-vdb": lazy(() => import("./AnalogueLab")),
  "dm-rag": lazy(() => import("./RagLab")),
  "dm-mcp": lazy(() => import("./McpLab")),
  "dm-capstone": lazy(() => import("./StrategyRoom")),
};
