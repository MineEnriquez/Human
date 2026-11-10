import { CHUNKS, search } from "../../content/pathogen/corpus";
import { RagLabView } from "../shared/RagLabView";

export default function RagLab() {
  return <RagLabView lessonId="pg-rag" path="pathogen-genomics" docs="the hospital documents" chunks={CHUNKS} search={search}
    questions={["The bay 3 sink drain grew the outbreak strain. What must we do about the drain?", "Who needs screening after a new CPE case, and for how long?", "Can we interpret the SNP distances for KP-07?"]} />;
}
