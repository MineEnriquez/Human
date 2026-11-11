import { McpLabView } from "../shared/McpLabView";

const HANDSHAKE = [
  { id: "h1", label: "[[t|Host]] (the on-call assistant) starts an MCP client and connects to the ops server", why: "One client per server, inside the host app." },
  { id: "h2", label: "Client → Server: `initialize`", why: "Agree protocol version and capabilities first." },
  { id: "h2b", label: "Server → Client: `initialize` result with its capabilities", why: "The server says what it supports (tools, resources, prompts)." },
  { id: "h2c", label: "Client → Server: `notifications/initialized`", why: "The client confirms; normal requests can start." },
  { id: "h3", label: "Client → Server: `tools/list`", why: "Discover what the server offers." },
  { id: "h4", label: "Server → Client: tool names, descriptions, **input schemas**", why: "The schema tells the model what arguments are valid." },
  { id: "h5", label: "Host gives the tool definitions + the engineer's question to the [[c|LLM]]", why: "Now the model knows the tools exist." },
  { id: "h6", label: "LLM → Host: request `get_metrics(payouts-api, error_rate_pct, 02:00, 03:25)`", why: "The model only *asks*. The host decides whether to run it." },
  { id: "h7", label: "Client → Server: `tools/call`", why: "The host's client makes the real call." },
  { id: "h8", label: "Server → Client: result (error rate per 5 minutes)", why: "Data, not instructions." },
  { id: "h9", label: "Host → LLM: tool result; the LLM writes the answer", why: "The loop can repeat if more tools are needed." },
];

const TOOLS: Parameters<typeof McpLabView>[0]["tools"] = [
  { id: "t1", label: "`search_logs`: read log lines", bucket: "auto", why: "Read-only, narrow." },
  { id: "t2", label: "`get_metrics`: read a metric over a time range", bucket: "auto", why: "Read-only." },
  { id: "t3", label: "`list_deploys`: read deploy history", bucket: "auto", why: "Read-only." },
  { id: "t4", label: "`search_runbooks`: search the team's docs", bucket: "auto", why: "Read-only retrieval." },
  { id: "t5", label: "`rollback_deploy`: roll back one deploy", bucket: "ask", why: "Often the right fix, but it changes production: a person confirms." },
  { id: "t6", label: "`restart_service`", bucket: "ask", why: "Side effects on live traffic: approve first." },
  { id: "t7", label: "`post_status_update`: publish to the status page", bucket: "ask", why: "Public and hard to take back: a human reviews the wording." },
  { id: "t8", label: "`drop_database`", bucket: "never", why: "No incident needs this. Don't expose it at all." },
  { id: "t9", label: "`run_shell(command)` on production hosts", bucket: "never", why: "Unbounded privilege, and a target for injected instructions. Use narrow typed tools." },
];

export default function McpLab() {
  return <McpLabView lessonId="se-mcp" path="software-engineering" system="Lumenrail's on-call tools" handshake={HANDSHAKE} tools={TOOLS}
    toolNames={["search_logs", "get_metrics", "list_deploys", "search_runbooks"]}
    starters={["What was the payouts-api error rate between 02:00 and 03:25?", "List the deploys from 01:00 to 03:30.", "What does our runbook say about an exhausted connection pool?"]} />;
}
