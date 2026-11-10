import { AgentConsole } from "../components/AgentConsole";
import { DragHint, SortableSequence, SortIntoBuckets } from "../components/dnd";
import { earnBadge, useProgress } from "../lib/progress";
import { finishPart, LabCard } from "./common";

const ID = "pg-mcp";
const EV = ["Handshake ordered", "Tool policy", "Live tool trace"];

const HANDSHAKE = [
  { id: "h1", label: "[[t|Host]] starts an MCP client for the lab server", why: "One client per server, inside the host app." },
  { id: "h2", label: "Client → Server: `initialize`", why: "Agree protocol version and capabilities first." },
  { id: "h3", label: "Client → Server: `tools/list`", why: "Discover what the server offers." },
  { id: "h4", label: "Server → Client: tool names, descriptions, **input schemas**", why: "The schema tells the model what arguments are valid." },
  { id: "h5", label: "Host gives the tool definitions + the user's question to the [[c|LLM]]", why: "Now the model knows the tools exist." },
  { id: "h6", label: "LLM → Host: request `get_snp_distances(KP-01, KP-12)`", why: "The model only *asks*. The host decides whether to run it." },
  { id: "h7", label: "Client → Server: `tools/call`", why: "The host's client makes the real call." },
  { id: "h8", label: "Server → Client: result (SNP matrix)", why: "Data, not instructions." },
  { id: "h9", label: "Host → LLM: tool result; the LLM writes the answer", why: "The loop can repeat if more tools are needed." },
];

const TOOLS = [
  { id: "t1", label: "`search_isolates`: read isolate records", bucket: "auto", why: "Read-only, narrow, internal." },
  { id: "t2", label: "`get_snp_distances`: read the SNP matrix", bucket: "auto", why: "Read-only computation." },
  { id: "t3", label: "`search_protocols`: search hospital documents", bucket: "auto", why: "Read-only retrieval." },
  { id: "t4", label: "`order_resequencing`: queue a sample on the sequencer", bucket: "ask", why: "Spends money and machine time: a person confirms." },
  { id: "t5", label: "`release_report_to_public_health`", bucket: "ask", why: "External, irreversible side effect." },
  { id: "t6", label: "`update_isolate_record`: edit a record", bucket: "ask", why: "Writes to the system of record: approve and log." },
  { id: "t7", label: "`delete_patient_record`", bucket: "never", why: "No investigation needs this. Don't expose it at all." },
  { id: "t8", label: "`run_sql(query)` with read/write access", bucket: "never", why: "Unbounded privilege; replace with narrow typed tools." },
];

export default function McpLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  return (
    <>
      <LabCard title="A. One tool call, message by message" done={ev.includes(EV[0])} sub="Order the messages from start-up to the model's answer." right={<DragHint />}>
        <SortableSequence items={HANDSHAKE} seed={5} onSolved={n => { finishPart(ID, EV[0], EV); if (n <= 2) earnBadge("toolsmith"); }} />
      </LabCard>
      <LabCard title="B. Set the tool policy" done={ev.includes(EV[1])} sub="You're designing the lab's MCP server. Which tools run automatically, which need a human's approval, and which should not exist?" right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={TOOLS} columns={3} buckets={[{ id: "auto", title: "Auto-run (read-only)" }, { id: "ask", title: "Ask a human first" }, { id: "never", title: "Don't expose" }]}
          onSolved={n => { finishPart(ID, EV[1], EV); if (n === 1) earnBadge("gatekeeper"); }} />
      </LabCard>
      <LabCard title="C. Watch a live host" done={ev.includes(EV[2])} sub="This is a real Claude model with the lab's read-only tools. Each call is shown as the JSON-RPC tools/call message an MCP host would send.">
        <AgentConsole showRpc height={420}
          starters={["What are the SNP distances between KP-01, KP-03 and KP-12?", "Which ICU isolates carry blaKPC-3?", "What does our SOP say about low-coverage genomes?"]}
          onToolCall={() => finishPart(ID, EV[2], EV)} />
      </LabCard>
    </>
  );
}
