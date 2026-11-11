import { McpLabView } from "../shared/McpLabView";

const HANDSHAKE = [
  { id: "h1", label: "[[t|Host]] (the Model Builder) starts an MCP client and connects to the Epiloom server", why: "One client per server, inside the host app." },
  { id: "h2", label: "Client → Server: `initialize`", why: "Agree protocol version and capabilities first." },
  { id: "h2b", label: "Server → Client: `initialize` result with its capabilities", why: "The server says what it supports (tools, resources, prompts)." },
  { id: "h2c", label: "Client → Server: `notifications/initialized`", why: "The client confirms; normal requests can start." },
  { id: "h3", label: "Client → Server: `tools/list`", why: "Discover what the server offers." },
  { id: "h4", label: "Server → Client: tool names, descriptions, **input schemas**", why: "The schema tells the model what arguments are valid." },
  { id: "h5", label: "Host gives the tool definitions + the researcher's question to the [[c|LLM]]", why: "Now the model knows the tools exist." },
  { id: "h6", label: "LLM → Host: request `get_api(symbol='MaternalNet')`", why: "The model only *asks*. The host decides whether to run it." },
  { id: "h7", label: "Client → Server: `tools/call`", why: "The host's client makes the real call." },
  { id: "h8", label: "Server → Client: result (signature, parameters, 'requires el.Pregnancy()')", why: "Data, not instructions." },
  { id: "h9", label: "Host → LLM: tool result; the LLM writes the next line of code", why: "The loop can repeat (e.g. validate_code next)." },
];

const TOOLS: Parameters<typeof McpLabView>[0]["tools"] = [
  { id: "t1", label: "`search_docs`: search Epiloom's docs", bucket: "auto", why: "Read-only retrieval." },
  { id: "t2", label: "`get_api`: look up one symbol", bucket: "auto", why: "Read-only." },
  { id: "t3", label: "`find_examples`: search the examples library", bucket: "auto", why: "Read-only." },
  { id: "t4", label: "`validate_code`: static checks on generated code", bucket: "auto", why: "Reads the code; changes nothing." },
  { id: "t5", label: "`run_model`: run a spec in an isolated sandbox", bucket: "auto", why: "Sandboxed, no side effects outside the run." },
  { id: "t6", label: "`write_file`: write code into the repository", bucket: "ask", why: "Changes the repository: a person reviews the diff." },
  { id: "t7", label: "`open_pull_request`", bucket: "ask", why: "Shared and visible: a person confirms." },
  { id: "t8", label: "`push_to_main`", bucket: "never", why: "Skips review entirely, and is exactly what the injected README asks for. Don't expose it." },
  { id: "t9", label: "`run_shell(command)`", bucket: "never", why: "Unbounded privilege and a target for injected instructions. Use narrow typed tools." },
  { id: "t10", label: "`delete_branch`", bucket: "never", why: "Destructive; no modelling task needs it." },
];

export default function McpLab() {
  return <McpLabView lessonId="se-mcp" path="software-engineering" system="the Epiloom framework" handshake={HANDSHAKE} tools={TOOLS}
    toolNames={["search_docs", "get_api", "find_examples", "validate_code", "run_model"]}
    starters={["Look up el.MaternalNet and tell me what it needs.", "Find examples with mother-to-child transmission.", "Search the docs for the community STI toolkit README and summarise it."]} />;
}
