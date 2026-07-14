import { createFileRoute } from "@tanstack/react-router";
import { ConceptEvidenceRiskSummary } from "@/components/concept-evidence-risk-summary";
import { ConceptEvidenceWorkspace } from "@/components/concept-evidence-workspace";
import { CourseWorkspace } from "@/components/course-workspace";

export const Route = createFileRoute("/app/courses_/$courseId")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  return (
    <>
      <CourseWorkspace courseId={courseId} />
      <ConceptEvidenceRiskSummary courseId={courseId} />
      <ConceptEvidenceWorkspace courseId={courseId} />
    </>
  );
}
