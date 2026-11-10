import { McpLabView } from "../shared/McpLabView";

export const HANDSHAKE = [
  { id: "h1", label: "[[t|Host]] launches the simulation server and connects an MCP client (stdio)", why: "One client per server, inside the host app." },
  { id: "h2", label: "Client → Server: `initialize` (protocol version, client capabilities)", why: "Agree the protocol version and capabilities first." },
  { id: "h3", label: "Server → Client: initialize result (server offers **tools** and **resources**)", why: "Now the client knows what it can ask for." },
  { id: "h4", label: "Client → Server: `notifications/initialized`", why: "A notification (no id, no reply) that ends the handshake." },
  { id: "h5", label: "Client → Server: `tools/list`", why: "Discover run_seir, get_case_counts and the others." },
  { id: "h6", label: "Host gives the tool definitions + the analyst's question to the [[c|LLM]]", why: "The schemas tell the model which arguments are valid." },
  { id: "h7", label: "LLM → Host: request `run_seir` with R0, durations and day-45 closure", why: "The model only asks. The host applies policy." },
  { id: "h8", label: "Client → Server: `tools/call` run_seir", why: "The real call, made by the host's client." },
  { id: "h9", label: "Server → Client: projection; host passes it back to the LLM", why: "The model writes its answer, or calls another tool." },
];

export const TOOLS: Parameters<typeof McpLabView>[0]["tools"] = [
  { id: "t1", label: "`get_case_counts`: read reported cases", bucket: "auto", why: "Read-only." },
  { id: "t2", label: "`run_seir`: simulate in memory", bucket: "auto", why: "Compute-only: nothing is saved or published." },
  { id: "t3", label: "`fit_growth_rate`: fit r to a window", bucket: "auto", why: "Read-only computation." },
  { id: "t4", label: "`search_evidence`: search the evidence library", bucket: "auto", why: "Read-only retrieval." },
  { id: "t5", label: "`publish_forecast`: post to the public dashboard", bucket: "ask", why: "The SOP requires a second modeler and Director sign-off." },
  { id: "t6", label: "`email_briefing`: send the briefing to the mayor's office", bucket: "ask", why: "External, hard to retract." },
  { id: "t7", label: "`schedule_cluster_job`: book paid compute time", bucket: "ask", why: "Spends budget: a person confirms." },
  { id: "t8", label: "`overwrite_case_counts`: replace surveillance data", bucket: "never", why: "No forecast needs to rewrite the source of truth." },
  { id: "t9", label: "`run_shell(command)` on the modeling server", bucket: "never", why: "Unbounded privilege. Expose narrow, typed tools instead." },
];

export default function McpLab() {
  return <McpLabView lessonId="om-mcp" path="outbreak-modeling" system="the modeling cell's simulator and surveillance database" handshake={HANDSHAKE} tools={TOOLS}
    toolNames={["get_case_counts", "fit_growth_rate", "run_seir", "search_evidence"]}
    starters={["Show me reported cases for days 28-41.", "Run the SEIR model with R0 1.5, latent 3 days, infectious 4 days, 30% reporting, for 120 days.", "What does our forecast SOP require before release?"]} />;
}
