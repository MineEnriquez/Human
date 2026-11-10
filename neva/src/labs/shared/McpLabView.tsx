import { AgentConsole } from "../../components/AgentConsole";
import { DragHint, SortableSequence, SortIntoBuckets } from "../../components/dnd";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

export const MCP_EVIDENCE = ["Handshake ordered", "Tool policy", "Live tool trace"];
type Step = { id: string; label: string; why: string };
type ToolCard = { id: string; label: string; bucket: "auto" | "ask" | "never"; why: string };

export type McpLabProps = { lessonId: string; path: string; system: string; handshake: Step[]; tools: ToolCard[]; starters: string[]; toolNames: string[] };

export function McpLabView({ lessonId: ID, path, system, handshake, tools, starters, toolNames }: McpLabProps) {
  const EV = MCP_EVIDENCE;
  const ev = useProgress().lessons[ID]?.evidence || [];
  return (
    <>
      <LabCard title="A. One tool call, message by message" done={ev.includes(EV[0])} sub="Order the messages from start-up to the model's answer." right={<DragHint />}>
        <SortableSequence items={handshake} seed={5} onSolved={n => { finishPart(ID, EV[0], EV); if (n <= 2) earnBadge("toolsmith"); }} />
      </LabCard>
      <LabCard title="B. Set the tool policy" done={ev.includes(EV[1])} sub={`You're designing the MCP server for ${system}. Which tools run automatically, which need a human's approval, and which should not exist?`} right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={tools} columns={3} buckets={[{ id: "auto", title: "Auto-run (read-only)" }, { id: "ask", title: "Ask a human first" }, { id: "never", title: "Don't expose" }]}
          onSolved={n => { finishPart(ID, EV[1], EV); if (n === 1) earnBadge("gatekeeper"); }} />
      </LabCard>
      <LabCard title="C. Watch a live host" done={ev.includes(EV[2])} sub="This is a real Claude model with read-only tools. Each call is shown as the JSON-RPC tools/call message an MCP host would send.">
        <AgentConsole path={path} toolNames={toolNames} showRpc height={420} starters={starters} onToolCall={() => finishPart(ID, EV[2], EV)} />
      </LabCard>
    </>
  );
}
