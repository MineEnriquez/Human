import { CHUNKS, RAG_QUESTIONS, search } from "../../content/modeling/corpus";
import { RagLabView } from "../shared/RagLabView";

export default function RagLab() {
  return <RagLabView lessonId="dm-rag" path="disease-modeling" docs="the TB programme's background notes, cohort study, survey and pilot reports" chunks={CHUNKS} search={search}
    questions={RAG_QUESTIONS.map(q => q.q)} seed={17} />;
}
