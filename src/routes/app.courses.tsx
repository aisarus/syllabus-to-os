import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { CourseBook, WoodenShelf, RoomHeading, BrassButton } from "@/components/study-room-ui";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/app/courses")({
  component: CoursesPage,
});

const samples = [
  ["SOC101", "Introduction to Sociology", 72, "forest"],
  ["GOV202", "Government in Israel", 54, "rust"],
  ["HEB110", "Academic Hebrew", 81, "ochre"],
  ["ECO201", "Economics Principles", 38, "moss"],
  ["PSY120", "Psychology", 65, "wine"],
  ["STA105", "Statistics Basics", 45, "umber"],
  ["ENG210", "Academic English", 70, "navy"],
] as const;

function CoursesPage() {
  const data = useData();
  const courses = data.courses.length
    ? data.courses.slice(0, 8).map((course, index) => ({
        id: course.id,
        code: course.number || `CRS${index + 1}`,
        title: course.title,
        progress: [72, 54, 81, 38, 65, 45, 70, 31][index] || 50,
        tone: (["forest", "rust", "ochre", "moss", "wine", "umber", "navy"] as const)[index % 7],
      }))
    : samples.map((sample, index) => ({
        id: `sample-${index}`,
        code: sample[0],
        title: sample[1],
        progress: sample[2],
        tone: sample[3],
      }));

  return (
    <div className="room-page courses-room">
      <RoomHeading
        eyebrow="Your library"
        title="Courses"
        subtitle={`${courses.length} books currently on the shelf`}
        actions={<BrassButton><Plus size={15} /> New course</BrassButton>}
      />

      <div className="shelf-toolbar">
        <label><Search size={15} /><input placeholder="Find a course…" aria-label="Find a course" /></label>
        <button type="button"><SlidersHorizontal size={14} /> Sort by semester</button>
      </div>

      <div className="course-library">
        <WoodenShelf>
          <div className="course-library__row">
            {courses.slice(0, 4).map((course) => (
              <CourseBook
                key={course.id}
                code={course.code}
                title={course.title}
                progress={course.progress}
                tone={course.tone}
                to={data.courses.length ? `/app/courses/${course.id}` : "/app/courses"}
              />
            ))}
          </div>
        </WoodenShelf>
        <WoodenShelf>
          <div className="course-library__row">
            {courses.slice(4).map((course) => (
              <CourseBook
                key={course.id}
                code={course.code}
                title={course.title}
                progress={course.progress}
                tone={course.tone}
                to={data.courses.length ? `/app/courses/${course.id}` : "/app/courses"}
              />
            ))}
            <button type="button" className="empty-book-slot">
              <span><Plus size={22} /></span>
              <strong>Add new course</strong>
            </button>
          </div>
        </WoodenShelf>
      </div>

      <aside className="library-marginalia">
        <span>LIBRARY NOTE · 12 JUL</span>
        <p>A course becomes easier to return to when every note, card and deadline has a visible home.</p>
      </aside>
    </div>
  );
}
