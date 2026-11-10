// What each learning path plugs into the shared API.
import type { Chunk, Hit } from "../../src/content/search";

/** A tool the lab agent can call, as an MCP server would list it in tools/list. */
export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolResult = { ok: boolean; out: unknown };

export type ServerPath = {
  id: string;
  /** Shown to the grader and quiz writer: path name + the fictional case setting. */
  title: string;
  setting: string;
  /** RAG + search_* tool corpus. */
  chunks: Chunk[];
  search: (q: string, k?: number) => Hit[];
  /** Lab agent: system prompt (without the shared markup block), tools and their executor. */
  agentPrompt: string;
  tools: ToolDef[];
  runTool: (name: string, input: unknown) => ToolResult;
  /** System prompt for grading this path's capstone report (includes the answer key and the 10-point rubric). */
  capstoneGrader: string;
};
