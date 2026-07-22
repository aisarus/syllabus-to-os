import { Link, createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, ChevronDown, FilePlus2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ConceptEvidenceRiskSummary } from "@/components/concept-evidence-risk-summary";
import { ConceptEvidenceWorkspace } from "@/components/concept-evidence-workspace";
import { ConceptExtractionReview } from "@/components/concept-extraction-review";
import { ConceptOpenAnswerReview } from "@/components/concept-open-answer-review";
import { CourseWorkspace } from "@/components/course-workspace";
import { TopicLearningSlice } from "@/components/topic-learning-slice";
import { useApp } from "@/lib/app-context";
import { useData } from "@/lib/store";
import "@/course-experience.css";

export const Route = createFileRoute("/app/courses_/$courseId")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { lang } = useApp();
  const data = useData();
  const isRu = lang === "ru";
  const [knowledgeLabOpen, setKnowledgeLabOpen] = useState(true);
  const hasCourseMaterials = data.materials.some((material) => material.courseId === courseId);

  return (
    <div className="course-experience">
      <div className="course-experience__workspace">
        {hasCourseMaterials ? (
          <CourseWorkspace courseId={courseId} />
        ) : (
          <section className="rounded-xl border border-dashed border-border bg-surface p-6 text-center">
            <FilePlus2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <h1 className="mt-3 font-serif text-xl font-semibold">
              {isRu ? "В курсе пока нет материалов" : "This course has no materials yet"}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              {isRu
                ? "Импортируй силлабус или добавь источник из библиотеки. Проверка темы и лаборатория знаний остаются доступны ниже."
                : "Import a syllabus or add a source from the library. Topic learning and the knowledge lab remain available below."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                to="/app/import-syllabus"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {isRu ? "Импортировать силлабус" : "Import syllabus"}
              </Link>
              <Link
                to="/app/materials"
                className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent"
              >
                {isRu ? "Открыть материалы" : "Open materials"}
              </Link>
            </div>
          </section>
        )}
      </div>

      <TopicLearningSlice courseId={courseId} />

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
