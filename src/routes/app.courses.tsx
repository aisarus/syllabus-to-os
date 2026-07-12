import { createFileRoute } from "@tanstack/react-router";
import { CourseLibrary } from "@/components/course-library";

export const Route = createFileRoute("/app/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  return <CourseLibrary />;
}
