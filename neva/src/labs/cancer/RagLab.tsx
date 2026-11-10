import { CHUNKS, search } from "../../content/cancer/corpus";
import { RagLabView } from "../shared/RagLabView";

export default function RagLab() {
  return <RagLabView lessonId="cg-rag" path="cancer-genomics" docs="the lab's SOPs and policies" chunks={CHUNKS} search={search}
    questions={[
      "A DDX41 variant is at 50% VAF in the marrow and 49% in the skin sample. What must we do?",
      "Can we report the KRAS G12D call at 3% VAF with 38x depth and strand bias?",
      "How do we classify a variant whose clinical significance is unknown?",
    ]} />;
}
