import { CHUNKS, RAG_QUESTIONS, search } from "../../content/software/corpus";
import { RagLabView } from "../shared/RagLabView";

export default function RagLab() {
  return <RagLabView lessonId="se-rag" path="software-engineering" docs="the team's runbooks, policies and ADRs" chunks={CHUNKS} search={search}
    questions={RAG_QUESTIONS.map(q => q.q)} />;
}
