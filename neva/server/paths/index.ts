import { modeling } from "./modeling.js";
import { cancer } from "./cancer.js";
import { research } from "./research.js";
import { software } from "./software.js";
import type { ServerPath } from "./types.js";

export const SERVER_PATHS: Record<string, ServerPath> = Object.fromEntries([software, cancer, modeling, research].map(p => [p.id, p]));
/** Unknown or missing path ids fall back to Cancer Genomics. */
export const serverPath = (id: unknown): ServerPath => SERVER_PATHS[String(id)] || cancer;
