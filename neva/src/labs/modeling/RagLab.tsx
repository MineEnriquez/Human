import { CHUNKS, RAG_QUESTIONS, search } from "../../content/modeling/corpus";
import { RagLabView } from "../shared/RagLabView";

export default function RagLab() {
  return <RagLabView lessonId="om-rag" path="outbreak-modeling" docs="the modeling cell's study summaries and method notes" chunks={CHUNKS} search={search}
    questions={RAG_QUESTIONS.map(q => q.q)} seed={17} />;
}
