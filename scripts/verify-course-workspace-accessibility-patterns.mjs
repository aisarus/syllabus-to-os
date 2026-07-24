import {
  topicInputPattern,
  uploadTopicPattern,
} from "./course-workspace-accessibility-patterns.mjs";

const fixtures = [
  {
    name: "topic input — one line",
    pattern: topicInputPattern,
    source:
      '<Input value={newTopic} aria-label={isRu ? "Название новой темы" : "New topic title"} />',
    expected: true,
  },
  {
    name: "topic input — reordered multiline attributes",
    pattern: topicInputPattern,
    source: `<Input
  onChange={onChange}
  aria-label={
    isRu
      ? "Название новой темы"
      : "New topic title"
  }
  value={newTopic}
/>`,
    expected: true,
  },
  {
    name: "topic input — unrelated input",
    pattern: topicInputPattern,
    source:
      '<Input value={course.title} aria-label={isRu ? "Название новой темы" : "New topic title"} />',
    expected: false,
  },
  {
    name: "topic input — missing label",
    pattern: topicInputPattern,
    source: '<Input value={newTopic} />',
    expected: false,
  },
  {
    name: "topic input — wrong localized copy",
    pattern: topicInputPattern,
    source:
      '<Input value={newTopic} aria-label={isRu ? "Новая тема" : "Topic"} />',
    expected: false,
  },
  {
    name: "upload selector — one line",
    pattern: uploadTopicPattern,
    source:
      '<SelectTrigger aria-label={isRu ? "Тема для загружаемого материала" : "Topic for uploaded material"}>',
    expected: true,
  },
  {
    name: "upload selector — multiline expression",
    pattern: uploadTopicPattern,
    source: `<SelectTrigger
  className="w-full"
  aria-label={
    isRu
      ? "Тема для загружаемого материала"
      : "Topic for uploaded material"
  }
>`,
    expected: true,
  },
  {
    name: "upload selector — missing label",
    pattern: uploadTopicPattern,
    source: '<SelectTrigger className="w-full">',
    expected: false,
  },
  {
    name: "upload selector — wrong control",
    pattern: uploadTopicPattern,
    source:
      '<Input aria-label={isRu ? "Тема для загружаемого материала" : "Topic for uploaded material"} />',
    expected: false,
  },
  {
    name: "upload selector — wrong localized copy",
    pattern: uploadTopicPattern,
    source:
      '<SelectTrigger aria-label={isRu ? "Выбрать тему" : "Choose topic"}>',
    expected: false,
  },
  {
    name: "topic input — label on neighboring control",
    pattern: topicInputPattern,
    source: `<Input value={newTopic} />
<SelectTrigger aria-label={isRu ? "Название новой темы" : "New topic title"}>`,
    expected: false,
  },
];

const failures = [];
for (const fixture of fixtures) {
  const actual = fixture.pattern.test(fixture.source);
  if (actual !== fixture.expected) {
    failures.push(`${fixture.name}: expected ${fixture.expected}, received ${actual}`);
  }
}

if (failures.length) {
  console.error("CourseWorkspace accessibility pattern smoke test failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`CourseWorkspace accessibility pattern smoke test passed: ${fixtures.length} fixtures.`);
