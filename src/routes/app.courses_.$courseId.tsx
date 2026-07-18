import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, ChevronDown, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ConceptEvidenceRiskSummary } from "@/components/concept-evidence-risk-summary";
import { ConceptEvidenceWorkspace } from "@/components/concept-evidence-workspace";
import { ConceptExtractionReview } from "@/components/concept-extraction-review";
import { ConceptOpenAnswerReview } from "@/components/concept-open-answer-review";
import { CourseWorkspace } from "@/components/course-workspace";
import { useApp } from "@/lib/app-context";
import "@/course-experience.css";

export const Route = createFileRoute("/app/courses_/$courseId")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { lang } = useApp();
  const isRu = lang === "ru";
  const [knowledgeLabOpen, setKnowledgeLabOpen] = useState(true);

  return (
    <div className="course-experience">
      <div className="course-experience__workspace">
        <CourseWorkspace courseId={courseId} />
      </div>

      <div className="course-experience__risk">
        <ConceptEvidenceRiskSummary courseId={courseId} />
      </div>

      <details
        className="course-knowledge-lab"
        open={knowledgeLabOpen}
        onToggle={(event) => setKnowledgeLabOpen(event.currentTarget.open)}
      >
        <summary>
          <span className="course-knowledge-lab__icon" aria-hidden="true">
            <BrainCircuit size={20} />
          </span>
          <span className="course-knowledge-lab__copy">
            <span className="course-experience__eyebrow">
              {isRu ? "Лаборатория знаний" : "Knowledge lab"}
            </span>
            <strong>
              {isRu ? "Понятия, открытые ответы и evidence" : "Concepts, open answers and evidence"}
            </strong>
            <small>
              {isRu
                ? "Продвинутые инструменты проверки знания отделены от основной структуры курса. Здесь можно извлечь понятия, проверить открытые ответы и вручную разобрать evidence."
                : "Advanced knowledge checks are separated from the main course structure. Extract concepts, review open answers and inspect evidence here."}
            </small>
          </span>
          <span className="course-knowledge-lab__status">
            <ShieldCheck size={13} />
            {isRu ? "по подтверждённым данным" : "verified data only"}
          </span>
          <ChevronDown className="course-knowledge-lab__chevron" size={18} aria-hidden="true" />
        </summary>

        <div className="course-knowledge-lab__body">
          <ConceptExtractionReview courseId={courseId} />
          <ConceptOpenAnswerReview courseId={courseId} />
          <ConceptEvidenceWorkspace courseId={courseId} />
        </div>
      </details>
    </div>
  );
}
