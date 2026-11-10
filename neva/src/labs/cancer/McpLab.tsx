import { McpLabView } from "../shared/McpLabView";

const HANDSHAKE = [
  { id: "h1", label: "[[t|Host]] starts an MCP client and connects to the lab's server", why: "One client per server, inside the host app." },
  { id: "h2", label: "Client → Server: `initialize`", why: "Agree protocol version and capabilities first." },
  { id: "h2b", label: "Server → Client: `initialize` result with its capabilities", why: "The server says what it supports (tools, resources, prompts)." },
  { id: "h2c", label: "Client → Server: `notifications/initialized`", why: "The client confirms; normal requests can start." },
  { id: "h3", label: "Client → Server: `tools/list`", why: "Discover what the server offers." },
  { id: "h4", label: "Server → Client: tool names, descriptions, **input schemas**", why: "The schema tells the model what arguments are valid." },
  { id: "h5", label: "Host gives the tool definitions + the user's question to the [[c|LLM]]", why: "Now the model knows the tools exist." },
  { id: "h6", label: "LLM → Host: request `get_vaf_timeline(IDH2-R140Q)`", why: "The model only *asks*. The host decides whether to run it." },
  { id: "h7", label: "Client → Server: `tools/call`", why: "The host's client makes the real call." },
  { id: "h8", label: "Server → Client: result (VAF per sample)", why: "Data, not instructions." },
  { id: "h9", label: "Host → LLM: tool result; the LLM writes the answer", why: "The loop can repeat if more tools are needed." },
];

const TOOLS: Parameters<typeof McpLabView>[0]["tools"] = [
  { id: "t1", label: "`search_variants`: read variant calls", bucket: "auto", why: "Read-only, narrow, internal." },
  { id: "t2", label: "`get_vaf_timeline`: read one variant across samples", bucket: "auto", why: "Read-only." },
  { id: "t3", label: "`get_sample_qc`: read purity, depth and flags", bucket: "auto", why: "Read-only." },
  { id: "t4", label: "`search_sops`: search the lab's SOPs", bucket: "auto", why: "Read-only retrieval." },
  { id: "t5", label: "`order_orthogonal_confirmation`: queue a digital PCR run", bucket: "ask", why: "Spends sample, money and machine time: a person confirms." },
  { id: "t6", label: "`release_report_to_clinician`", bucket: "ask", why: "External, hard-to-undo; the policy requires director sign-off." },
  { id: "t7", label: "`request_genetic_counseling_referral`", bucket: "ask", why: "Acts on a germline finding about a person: needs a human and the patient's consent." },
  { id: "t8", label: "`delete_patient_record`", bucket: "never", why: "No analysis needs this. Don't expose it at all." },
  { id: "t9", label: "`run_sql(query)` with read/write access", bucket: "never", why: "Unbounded privilege; replace with narrow typed tools." },
];

export default function McpLab() {
  return <McpLabView lessonId="cg-mcp" path="cancer-genomics" system="the translational genomics lab" handshake={HANDSHAKE} tools={TOOLS}
    toolNames={["search_variants", "get_vaf_timeline", "get_sample_qc", "search_sops"]}
    starters={["What is the IDH2 R140Q VAF at each timepoint?", "Which variants are present in the skin sample?", "What does our QC SOP say about low-level variants?"]} />;
}
