import { CHUNKS, RAG_QUESTIONS, search } from "../../content/research/corpus";
import { RagLabView } from "../shared/RagLabView";

export default function RagLab() {
  return <RagLabView lessonId="ri-rag" path="research-intelligence" docs="the review protocol and study abstracts" chunks={CHUNKS} search={search}
    questions={RAG_QUESTIONS.map(r => r.q)} budget={220} seed={13} />;
}
