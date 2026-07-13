import { createFileRoute } from "@tanstack/react-router";
import { CourseWorkspace } from "@/components/course-workspace";

export const Route = createFileRoute("/app/courses_/$courseId")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  return <CourseWorkspace courseId={courseId} />;
}
