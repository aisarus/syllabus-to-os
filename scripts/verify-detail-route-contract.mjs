import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");
const failures = [];
const requireMarker = (content, marker, message) => {
  if (!content.includes(marker)) failures.push(message);
};

const routes = [
  {
    name: "material",
    list: "src/routes/app.materials.tsx",
    detail: "src/routes/app.materials_.$materialId.tsx",
    oldDetail: "src/routes/app.materials.$materialId.tsx",
    link: 'to="/app/materials/$materialId"',
    route: 'createFileRoute("/app/materials_/$materialId")',
    surface: "MaterialWorkspace",
  },
  {
    name: "quiz",
    list: "src/components/quiz-library.tsx",
    detail: "src/routes/app.quizzes_.$quizId.tsx",
    oldDetail: "src/routes/app.quizzes.$quizId.tsx",
    link: 'to="/app/quizzes/$quizId"',
    route: 'createFileRoute("/app/quizzes_/$quizId")',
    surface: "EvidenceQuizExperience",
  },
  {
    name: "course",
    list: "src/components/course-library.tsx",
    detail: "src/routes/app.courses_.$courseId.tsx",
    oldDetail: "src/routes/app.courses.$courseId.tsx",
    link: 'to="/app/courses/$courseId"',
    route: 'createFileRoute("/app/courses_/$courseId")',
    surface: "CourseWorkspace",
  },
  {
    name: "presentation",
    list: "src/routes/app.presentations.tsx",
    detail: "src/routes/app.presentations_.$outlineId.tsx",
    oldDetail: "src/routes/app.presentations.$outlineId.tsx",
    link: 'to="/app/presentations/$outlineId"',
    route: 'createFileRoute("/app/presentations_/$outlineId")',
    surface: "OutlineEditor",
  },
];

for (const item of routes) {
  const [list, detail] = await Promise.all([read(item.list), read(item.detail)]);
  requireMarker(list, item.link, `${item.name} list no longer links to its detail URL.`);
  requireMarker(detail, item.route, `${item.name} detail is nested under the list route again.`);
  requireMarker(detail, item.surface, `${item.name} detail no longer renders its workspace.`);
  try {
    await access(resolve(process.cwd(), item.oldDetail), constants.F_OK);
    failures.push(
      `${item.name} legacy nested route still exists and can shadow the working detail route.`,
    );
  } catch {
    // Expected: the nested route file must not exist.
  }
}

if (failures.length) {
  console.error("Detail route reachability contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Material, quiz, course and presentation detail routes are directly reachable.");
