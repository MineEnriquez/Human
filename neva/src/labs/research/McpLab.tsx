import { McpLabView } from "../shared/McpLabView";

const HANDSHAKE = [
  { id: "h1", label: "[[t|Host]] starts an MCP client and connects to the unit's shared bibliographic server (Streamable HTTP)", why: "One client per server, inside the host app." },
  { id: "h2", label: "Client → Server: `initialize` (protocol version, capabilities, client info)", why: "The session always starts by negotiating version and capabilities." },
  { id: "h3", label: "Server → Client: initialize result (its capabilities: tools, resources)", why: "The server says what it offers." },
  { id: "h4", label: "Client → Server: `notifications/initialized`", why: "A notification (no id, no response): the client is ready for normal operation." },
  { id: "h5", label: "Client → Server: `tools/list`", why: "Discover tools with their names, descriptions and input schemas." },
  { id: "h6", label: "Host gives the tool definitions + the reviewer's question to the [[c|LLM]]", why: "Now the model knows which tools exist and what arguments they take." },
  { id: "h7", label: "LLM → Host: request `search_studies(\"molecular identification blood culture\")`", why: "The model only asks; the host applies its policy." },
  { id: "h8", label: "Client → Server: `tools/call`", why: "The host's client makes the real call." },
  { id: "h9", label: "Server → Client → LLM: the results; the LLM writes the answer", why: "Results are data, not instructions; the loop repeats if more tools are needed." },
];

const TOOLS: Parameters<typeof McpLabView>[0]["tools"] = [
  { id: "t1", label: "`search_studies`: query the bibliographic database", bucket: "auto", why: "Read-only and narrow." },
  { id: "t2", label: "`get_study`: fetch one study record", bucket: "auto", why: "Read-only." },
  { id: "t3", label: "`get_citation_list`: list a paper's references", bucket: "auto", why: "Read-only; useful for citation chasing." },
  { id: "t4", label: "`add_to_library`: add records to the shared reference library", bucket: "ask", why: "Writes to a shared system: a reviewer confirms." },
  { id: "t5", label: "`export_to_reference_manager`: push the screened set", bucket: "ask", why: "Side effect on another system; approve and log." },
  { id: "t6", label: "`submit_protocol_to_registry`", bucket: "ask", why: "External and hard to undo: a person must approve." },
  { id: "t7", label: "`delete_library`: remove the shared library", bucket: "never", why: "No review task needs it. Don't expose it." },
  { id: "t8", label: "`run_query(sql)` with write access to the library database", bucket: "never", why: "Unbounded privilege; replace with narrow typed tools." },
];

export default function McpLab() {
  return <McpLabView lessonId="ri-mcp" path="research-intelligence" system="the unit's bibliographic database and reference library" handshake={HANDSHAKE} tools={TOOLS}
    toolNames={["search_studies", "get_study", "get_risk_of_bias", "search_protocol"]}
    starters={["Find the randomized trials in the database.", "What does the protocol say about MALDI-TOF?", "Show me MS-09's record and its risk of bias."]} />;
}
