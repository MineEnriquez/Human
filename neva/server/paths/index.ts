import { modeling } from "./modeling";
import { pathogen } from "./pathogen";
import { research } from "./research";
import type { ServerPath } from "./types";

export const SERVER_PATHS: Record<string, ServerPath> = Object.fromEntries([pathogen, modeling, research].map(p => [p.id, p]));
/** Unknown or missing path ids fall back to Pathogen Genomics. */
export const serverPath = (id: unknown): ServerPath => SERVER_PATHS[String(id)] || pathogen;
