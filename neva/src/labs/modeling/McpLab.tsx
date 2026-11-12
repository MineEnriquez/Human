import { McpLabView } from "../shared/McpLabView";

export const HANDSHAKE = [
  { id: "h1", label: "[[t|Host]] starts an MCP client and connects to the programme's model server (Streamable HTTP)", why: "One client per server, inside the host app." },
  { id: "h2", label: "Client → Server: `server/discover`", why: "Optional first call in the current MCP revision (2026-07-28): which protocol versions and capabilities does the server support? (Servers on 2025-11-25 and earlier use an initialize handshake instead.)" },
  { id: "h3", label: "Server → Client: supported versions, capabilities (**tools** and **resources**) and server info", why: "Now the client knows what it can ask for." },
  { id: "h4", label: "Client → Server: `tools/list` (protocol version and capabilities in `_meta`)", why: "Every request carries its own version and capabilities; there's no session to set up." },
  { id: "h5", label: "Server → Client: run_tb_model, get_notifications and the others, with **input schemas**", why: "The schemas tell the model which arguments are valid." },
  { id: "h6", label: "Host gives the tool definitions + the analyst's question to the [[c|LLM]]", why: "Now the model knows the tools exist." },
  { id: "h7", label: "LLM → Host: request `run_tb_model` with strategy `acf` to 2035", why: "The model only asks. The host applies policy." },
  { id: "h8", label: "Client → Server: `tools/call` run_tb_model", why: "The real call, made by the host's client." },
  { id: "h9", label: "Server → Client: projection; host passes it back to the LLM", why: "The model writes its answer, or calls another tool." },
];

export const TOOLS: Parameters<typeof McpLabView>[0]["tools"] = [
  { id: "t1", label: "`get_notifications`: read annual notifications", bucket: "auto", why: "Read-only." },
  { id: "t2", label: "`run_tb_model`: project in memory", bucket: "auto", why: "Compute-only: nothing is saved or published." },
  { id: "t3", label: "`fit_tb_model`: fit transmission and detection", bucket: "auto", why: "Read-only computation." },
  { id: "t4", label: "`search_evidence`: search the evidence library", bucket: "auto", why: "Read-only retrieval." },
  { id: "t5", label: "`publish_projection`: post to the national dashboard", bucket: "ask", why: "The SOP requires a second modeller and Director sign-off." },
  { id: "t6", label: "`submit_budget_request`: send the request to the ministry", bucket: "ask", why: "Commits the district; a person must decide." },
  { id: "t7", label: "`message_health_workers`: text all community health workers", bucket: "ask", why: "External, hard to retract." },
  { id: "t8", label: "`overwrite_surveillance_data`: replace notification records", bucket: "never", why: "No projection needs to rewrite the source of truth." },
  { id: "t9", label: "`run_shell(command)` on the model server", bucket: "never", why: "Unbounded privilege. Expose narrow, typed tools instead." },
];

export default function McpLab() {
  return <McpLabView lessonId="dm-mcp" path="disease-modeling" system="the TB programme's model and surveillance database" handshake={HANDSHAKE} tools={TOOLS}
    toolNames={["get_notifications", "fit_tb_model", "run_tb_model", "search_evidence"]}
    starters={["Show me the notifications for 2020-2025.", "Run the TB model to 2035 with active case finding.", "What does our projection SOP require before release?"]} />;
}
