import { CHUNKS, RAG_QUESTIONS, search } from "../../content/software/corpus";
import { RagLabView } from "../shared/RagLabView";

export default function RagLab() {
  return <RagLabView lessonId="se-rag" path="software-engineering" docs="Epiloom's API reference and guides" chunks={CHUNKS} search={search}
    questions={RAG_QUESTIONS.map(q => q.q)} />;
}
