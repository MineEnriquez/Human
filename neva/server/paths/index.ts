import { modeling } from "./modeling";
import { cancer } from "./cancer";
import { research } from "./research";
import type { ServerPath } from "./types";

export const SERVER_PATHS: Record<string, ServerPath> = Object.fromEntries([cancer, modeling, research].map(p => [p.id, p]));
/** Unknown or missing path ids fall back to Cancer Genomics. */
export const serverPath = (id: unknown): ServerPath => SERVER_PATHS[String(id)] || cancer;
