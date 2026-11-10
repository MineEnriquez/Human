// Placeholder until this path's agent tools and capstone key are written.
import type { ServerPath } from "./types";

export const modeling: ServerPath = {
  id: "outbreak-modeling", title: "", setting: "", chunks: [], search: () => [],
  tools: [], runTool: name => ({ ok: false, out: `Unknown tool ${name}` }),
  agentPrompt: "", capstoneGrader: "",
};
