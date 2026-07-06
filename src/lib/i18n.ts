export type Lang = "ru" | "en";

export const isRTL = (_l: Lang) => false;

export type Dict = {
  appName: string;
  tagline: string;
  // nav
  dashboard: string;
  program: string;
  courses: string;
  notes: string;
  flashcards: string;
  quizzes: string;
  assignments: string;
  progress: string;
  data: string;
  settings: string;
  materials: string;
  calendar: string;
  studyPlan: string;
  presentations: string;
  // common
  create: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  confirm: string;
  search: string;
  title: string;
  description: string;
  status: string;
  actions: string;
  none: string;
  empty: string;
  language: string;
  theme: string;
  dark: string;
  light: string;
  notConnected: string;
  add: string;
  open: string;
  close: string;
  back: string;
  loadSample: string;
  clearAll: string;
  export: string;
  import: string;
  importFile: string;
  invalidFile: string;
  yes: string;
  no: string;
  type: string;
  filter: string;
  reset: string;
  today: string;
  upcoming: string;
  copy: string;
  copied: string;
  markdown: string;
  minutes: string;
  markDone: string;
  done: string;
  reason: string;
  estimated: string;
  source: string;
  suggestions: string;
  // dashboard
  totalCourses: string;
  inProgress: string;
  completed: string;
  assignmentsDue: string;
  notesCount: string;
  cardsDue: string;
  quizAvg: string;
  welcome: string;
  emptyDashboard: string;
  todaysSchedule: string;
  upcomingDeadlines: string;
  upcomingExams: string;
  recentMaterials: string;
  recentNotes: string;
  suggestedPlan: string;
  activeCourses: string;
  lowScoreQuizzes: string;
  // program
  createProgram: string;
  institution: string;
  degree: string;
  years: string;
  semesters: string;
  programName: string;
  noProgram: string;
  // course
  createCourse: string;
  courseNumber: string;
  credits: string;
  courseType: string;
  instructor: string;
  prerequisites: string;
  difficulty: string;
  originalTitle: string;
  semester: string;
  topics: string;
  notStarted: string;
  learning: string;
  understood: string;
  completedStatus: string;
  addTopic: string;
  courseEvents: string;
  courseMaterials: string;
  readinessScore: string;
  readinessFormula: string;
  // notes
  createNote: string;
  content: string;
  tags: string;
  linkedCourse: string;
  linkedTopic: string;
  linkedMaterial: string;
  generateNotes: string;
  fromMaterial: string;
  // flashcards
  createCard: string;
  front: string;
  cardBack: string;
  review: string;
  again: string;
  good: string;
  easy: string;
  new_: string;
  mastered: string;
  reviewMode: string;
  noDueCards: string;
  generateCards: string;
  buildCardsFromMaterial: string;
  // quizzes
  createQuiz: string;
  addQuestion: string;
  question: string;
  answer: string;
  correct: string;
  takeQuiz: string;
  submitQuiz: string;
  score: string;
  attempts: string;
  retry: string;
  generateQuiz: string;
  explanation: string;
  buildQuizFromMaterial: string;
  // assignments
  createAssignment: string;
  dueDate: string;
  priority: string;
  grade: string;
  submitted: string;
  graded: string;
  low: string;
  medium: string;
  high: string;
  // data
  dataTitle: string;
  exportDesc: string;
  importDesc: string;
  importSuccess: string;
  clearConfirm: string;
  emptyImport: string;
  // materials
  createMaterial: string;
  uploadFile: string;
  pasteText: string;
  materialType: string;
  syllabus: string;
  lecture: string;
  article: string;
  presentationMat: string;
  exam: string;
  other: string;
  rawText: string;
  userSummary: string;
  processingReady: string;
  processingUnsupported: string;
  processingNoText: string;
  processingError: string;
  createNoteFromMaterial: string;
  createFlashcardsFromMaterial: string;
  createQuizFromMaterial: string;
  createOutlineFromMaterial: string;
  materialsEmpty: string;
  extractTerms: string;
  extractTermsHelp: string;
  fileMeta: string;
  aiDisabledHint: string;
  // presentations
  createOutline: string;
  slides: string;
  slide: string;
  addSlide: string;
  bullets: string;
  speakerNotes: string;
  sourceQuote: string;
  exportMarkdown: string;
  presentationsEmpty: string;
  // calendar
  createEvent: string;
  eventType: string;
  class_: string;
  studySession: string;
  personal: string;
  date: string;
  startTime: string;
  endTime: string;
  recurrence: string;
  weekday: string;
  weekly: string;
  none_: string;
  deadlines: string;
  calendarEmpty: string;
  // study plan
  availableTime: string;
  generatePlan: string;
  emptyPlan: string;
  studyPlanIntro: string;
  planWhyCardsDue: string;
  planWhyLowScore: string;
  planWhyLearning: string;
  planWhyDeadline: string;
  planWhyExamSoon: string;
  planWhyStaleCourse: string;
  planCompletedToday: string;
  // settings
  aiConnection: string;
  aiStatus: string;
  aiStatusNotConnected: string;
  aiExplanation: string;
  serverEndpoint: string;
  noKeyInFrontend: string;
  // syllabus import
  importSyllabus: string;
  importSyllabusIntro: string;
  syllabusTabXlsx: string;
  syllabusTabJson: string;
  syllabusChooseXlsx: string;
  syllabusChooseSheet: string;
  syllabusHeaderRow: string;
  syllabusSheetPreview: string;
  syllabusColumnMapping: string;
  syllabusMappingHelp: string;
  syllabusColTitle: string;
  syllabusColOriginalTitle: string;
  syllabusColNumber: string;
  syllabusColSemester: string;
  syllabusColCredits: string;
  syllabusColInstructor: string;
  syllabusColType: string;
  syllabusColDescription: string;
  syllabusColTopics: string;
  syllabusColIgnore: string;
  syllabusCoursePreview: string;
  syllabusIncludeRow: string;
  syllabusDestinationProgram: string;
  syllabusNewProgram: string;
  syllabusExistingProgram: string;
  syllabusRunImport: string;
  syllabusImported: string;
  syllabusJsonPasteHelp: string;
  syllabusJsonSchemaHint: string;
  syllabusJsonPreview: string;
  syllabusHistory: string;
  syllabusHistoryEmpty: string;
  syllabusNoRowsPicked: string;
  syllabusTitleRequired: string;
  syllabusRowCount: string;
  syllabusCoursesImported: string;
  syllabusTopicsImported: string;
  syllabusTopicsSplitHelp: string;
  // materials v2
  searchNav: string;
  overview: string;
  chunks: string;
  studyBuilder: string;
  outputs: string;
  wordCount: string;
  charCount: string;
  chunkCount: string;
  pageCount: string;
  extractionMethod: string;
  sourceLanguage: string;
  processingPartial: string;
  processingWarnings: string;
  regenerateChunks: string;
  clearRawText: string;
  addChunk: string;
  editChunk: string;
  deleteChunk: string;
  searchInChunks: string;
  useSelection: string;
  selectionEmpty: string;
  createNoteFromChunk: string;
  createCardFromChunk: string;
  createQuestionFromChunk: string;
  createAssignmentNoteFromChunk: string;
  createSlideFromChunk: string;
  sourceChunks: string;
  openSource: string;
  chunksEmpty: string;
  materialsEmptyV2: string;
  materialNoTextExtracted: string;
  materialUnsupportedPaste: string;
  langRu: string;
  langEn: string;
  langHe: string;
  langAr: string;
  langMixed: string;
  langUnknown: string;
  extMethodManual: string;
  extMethodTxt: string;
  extMethodMarkdown: string;
  extMethodCsv: string;
  extMethodJson: string;
  extMethodHtml: string;
  extMethodXml: string;
  extMethodYaml: string;
  extMethodXlsx: string;
  extMethodDocx: string;
  extMethodPdf: string;
  needsAttention: string;
  unsupportedFiles: string;
  materialsWithoutCourse: string;
  materialsWithChunksNoOutputs: string;
  continueLatestMaterial: string;
  recentlyProcessed: string;
  searchPlaceholderGlobal: string;
  searchNoResults: string;
  searchAllScopes: string;
  filterStatus: string;
  filterExtraction: string;
  filterCourse: string;
  filterTag: string;
  statusReady: string;
  statusUnsupported: string;
  statusError: string;
  statusNoText: string;
  statusPartial: string;
  regenerateChunksHelp: string;
  chunkAddedManually: string;
  clearRawTextConfirm: string;
  extractingFile: string;
  pdfNoTextHint: string;
  docxUnsupportedHint: string;
  pdfUnsupportedHint: string;
  ingestionErrorHint: string;
};

const en: Dict = {
  appName: "Lamdan",
  tagline: "Personal study workspace",
  dashboard: "Dashboard",
  program: "Program",
  courses: "Courses",
  notes: "Notes",
  flashcards: "Flashcards",
  quizzes: "Quizzes",
  assignments: "Assignments",
  progress: "Progress",
  data: "Import / Export",
  settings: "Settings",
  materials: "Materials",
  calendar: "Calendar",
  studyPlan: "Study Plan",
  presentations: "Presentations",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  save: "Save",
  cancel: "Cancel",
  confirm: "Confirm",
  search: "Search",
  title: "Title",
  description: "Description",
  status: "Status",
  actions: "Actions",
  none: "None",
  empty: "Nothing here yet",
  language: "Language",
  theme: "Theme",
  dark: "Dark",
  light: "Light",
  notConnected: "Not connected yet",
  add: "Add",
  open: "Open",
  close: "Close",
  back: "Back",
  loadSample: "Load sample Bar-Ilan program",
  clearAll: "Clear all data",
  export: "Export",
  import: "Import",
  importFile: "Choose JSON file",
  invalidFile: "Invalid file format",
  yes: "Yes",
  no: "No",
  type: "Type",
  filter: "Filter",
  reset: "Reset",
  today: "Today",
  upcoming: "Upcoming",
  copy: "Copy",
  copied: "Copied",
  markdown: "Markdown",
  minutes: "min",
  markDone: "Mark done",
  done: "Done",
  reason: "Reason",
  estimated: "Est.",
  source: "Source",
  suggestions: "Suggestions",
  totalCourses: "Total courses",
  inProgress: "In progress",
  completed: "Completed",
  assignmentsDue: "Assignments due",
  notesCount: "Notes",
  cardsDue: "Cards due",
  quizAvg: "Quiz average",
  welcome: "Welcome",
  emptyDashboard: "Create a program or import a JSON structure to get started.",
  todaysSchedule: "Today's schedule",
  upcomingDeadlines: "Upcoming deadlines",
  upcomingExams: "Upcoming exams",
  recentMaterials: "Recent materials",
  recentNotes: "Recent notes",
  suggestedPlan: "Suggested plan",
  activeCourses: "Active courses",
  lowScoreQuizzes: "Low-score quizzes",
  createProgram: "Create program",
  institution: "Institution",
  degree: "Degree",
  years: "Years",
  semesters: "Semesters",
  programName: "Program name",
  noProgram: "No program yet.",
  createCourse: "Create course",
  courseNumber: "Course number",
  credits: "Credits",
  courseType: "Type",
  instructor: "Instructor",
  prerequisites: "Prerequisites",
  difficulty: "Difficulty",
  originalTitle: "Original title",
  semester: "Semester",
  topics: "Topics",
  notStarted: "Not started",
  learning: "Learning",
  understood: "Understood",
  completedStatus: "Completed",
  addTopic: "Add topic",
  courseEvents: "Upcoming events",
  courseMaterials: "Materials",
  readinessScore: "Readiness score",
  readinessFormula: "40% topics · 25% quizzes · 20% cards · 15% assignments",
  createNote: "Create note",
  content: "Content",
  tags: "Tags (comma separated)",
  linkedCourse: "Course",
  linkedTopic: "Topic",
  linkedMaterial: "Material",
  generateNotes: "Generate notes — not connected yet",
  fromMaterial: "From material",
  createCard: "Create card",
  front: "Front",
  cardBack: "Back",
  review: "Review",
  again: "Again",
  good: "Good",
  easy: "Easy",
  new_: "New",
  mastered: "Mastered",
  reviewMode: "Review mode",
  noDueCards: "No cards due for review.",
  generateCards: "Generate flashcards — not connected yet",
  buildCardsFromMaterial: "Build cards from material",
  createQuiz: "Create quiz",
  addQuestion: "Add question",
  question: "Question",
  answer: "Answer",
  correct: "Correct",
  takeQuiz: "Take quiz",
  submitQuiz: "Submit",
  score: "Score",
  attempts: "Attempts",
  retry: "Retry",
  generateQuiz: "Generate quiz — not connected yet",
  explanation: "Explanation",
  buildQuizFromMaterial: "Build quiz from material",
  createAssignment: "Create assignment",
  dueDate: "Due date",
  priority: "Priority",
  grade: "Grade",
  submitted: "Submitted",
  graded: "Graded",
  low: "Low",
  medium: "Medium",
  high: "High",
  dataTitle: "Import / Export",
  exportDesc: "Download all your data as a JSON file.",
  importDesc: "Import previously exported JSON data.",
  importSuccess: "Data imported successfully.",
  clearConfirm: "This will erase all local data. Continue?",
  emptyImport: "Import a JSON structure or create your program manually.",
  createMaterial: "Create material",
  uploadFile: "Upload file",
  pasteText: "Paste text",
  materialType: "Material type",
  syllabus: "Syllabus",
  lecture: "Lecture",
  article: "Article",
  presentationMat: "Presentation",
  exam: "Exam",
  other: "Other",
  rawText: "Raw text",
  userSummary: "Your summary",
  processingReady: "Ready",
  processingUnsupported: "Text extraction not connected for this format",
  processingNoText: "No text",
  processingError: "Error",
  createNoteFromMaterial: "Create note",
  createFlashcardsFromMaterial: "Build flashcards",
  createQuizFromMaterial: "Build quiz",
  createOutlineFromMaterial: "Create outline",
  materialsEmpty: "No materials yet. Upload a file or paste text.",
  extractTerms: "Suggest terms",
  extractTermsHelp: "Local heuristic — repeated capitalized/technical words in the text. Not AI.",
  fileMeta: "File info",
  aiDisabledHint: "AI is not connected. Manual tools work locally.",
  createOutline: "Create outline",
  slides: "Slides",
  slide: "Slide",
  addSlide: "Add slide",
  bullets: "Bullets (one per line)",
  speakerNotes: "Speaker notes",
  sourceQuote: "Source quote",
  exportMarkdown: "Export as Markdown",
  presentationsEmpty: "No presentation outlines yet.",
  createEvent: "Create event",
  eventType: "Event type",
  class_: "Class",
  studySession: "Study session",
  personal: "Personal",
  date: "Date",
  startTime: "Start",
  endTime: "End",
  recurrence: "Recurrence",
  weekday: "Weekday",
  weekly: "Weekly",
  none_: "None",
  deadlines: "Deadlines",
  calendarEmpty: "No events yet.",
  availableTime: "Available time today",
  generatePlan: "Generate plan",
  emptyPlan: "Nothing to suggest right now. Add assignments, cards or quizzes.",
  studyPlanIntro: "Rule-based suggestions built from your own data.",
  planWhyCardsDue: "cards are due today",
  planWhyLowScore: "best quiz score is below 70%",
  planWhyLearning: "topic still in \"learning\" status",
  planWhyDeadline: "assignment deadline soon",
  planWhyExamSoon: "exam soon",
  planWhyStaleCourse: "no recent activity on this course",
  planCompletedToday: "Completed today",
  aiConnection: "AI Connection",
  aiStatus: "Status",
  aiStatusNotConnected: "Not connected",
  aiExplanation:
    "AI generation is not connected yet. Manual tools work locally. A future update will let you connect a server endpoint — API keys are never stored in the browser.",
  serverEndpoint: "Server endpoint (planned)",
  noKeyInFrontend: "No secret keys will be stored in this app.",
  importSyllabus: "Import syllabus",
  importSyllabusIntro: "Import an XLSX syllabus/ידיעון or a structured JSON structure into real programs and courses.",
  syllabusTabXlsx: "XLSX file",
  syllabusTabJson: "Structured JSON",
  syllabusChooseXlsx: "Choose XLSX file",
  syllabusChooseSheet: "Sheet",
  syllabusHeaderRow: "Header row",
  syllabusSheetPreview: "Sheet preview",
  syllabusColumnMapping: "Column mapping",
  syllabusMappingHelp: "Pick which column contains each course field. Only Title is required.",
  syllabusColTitle: "Title (required)",
  syllabusColOriginalTitle: "Original title",
  syllabusColNumber: "Course number",
  syllabusColSemester: "Semester",
  syllabusColCredits: "Credits",
  syllabusColInstructor: "Instructor",
  syllabusColType: "Type",
  syllabusColDescription: "Description",
  syllabusColTopics: "Topics (one per line)",
  syllabusColIgnore: "— ignore —",
  syllabusCoursePreview: "Course preview",
  syllabusIncludeRow: "Include",
  syllabusDestinationProgram: "Destination program",
  syllabusNewProgram: "Create new program",
  syllabusExistingProgram: "Add to existing program",
  syllabusRunImport: "Import into workspace",
  syllabusImported: "Import successful",
  syllabusJsonPasteHelp: "Paste a JSON object with a program and/or courses array.",
  syllabusJsonSchemaHint: `Example: { "program": { "name": "...", "institution": "..." }, "courses": [ { "title": "...", "number": "615", "semester": "Sem A", "credits": 5, "topics": ["Topic 1", "Topic 2"] } ] }`,
  syllabusJsonPreview: "Parsed preview",
  syllabusHistory: "Import history",
  syllabusHistoryEmpty: "No imports yet.",
  syllabusNoRowsPicked: "No rows selected.",
  syllabusTitleRequired: "Map a Title column first.",
  syllabusRowCount: "rows",
  syllabusCoursesImported: "courses imported",
  syllabusTopicsImported: "topics imported",
  syllabusTopicsSplitHelp: "Topic cells are split by newline or semicolon.",
};

const ru: Dict = {
  appName: "Ламдан",
  tagline: "Личное учебное пространство",
  dashboard: "Обзор",
  program: "Программа",
  courses: "Курсы",
  notes: "Заметки",
  flashcards: "Карточки",
  quizzes: "Тесты",
  assignments: "Задания",
  progress: "Прогресс",
  data: "Импорт / Экспорт",
  settings: "Настройки",
  materials: "Материалы",
  calendar: "Расписание",
  studyPlan: "Учебный план",
  presentations: "Презентации",
  create: "Создать",
  edit: "Изменить",
  delete: "Удалить",
  save: "Сохранить",
  cancel: "Отмена",
  confirm: "Подтвердить",
  search: "Поиск",
  title: "Название",
  description: "Описание",
  status: "Статус",
  actions: "Действия",
  none: "Нет",
  empty: "Пока пусто",
  language: "Язык",
  theme: "Тема",
  dark: "Тёмная",
  light: "Светлая",
  notConnected: "Ещё не подключено",
  add: "Добавить",
  open: "Открыть",
  close: "Закрыть",
  back: "Назад",
  loadSample: "Загрузить пример программы Бар-Илан",
  clearAll: "Очистить все данные",
  export: "Экспорт",
  import: "Импорт",
  importFile: "Выбрать JSON файл",
  invalidFile: "Неверный формат файла",
  yes: "Да",
  no: "Нет",
  type: "Тип",
  filter: "Фильтр",
  reset: "Сброс",
  today: "Сегодня",
  upcoming: "Скоро",
  copy: "Копировать",
  copied: "Скопировано",
  markdown: "Markdown",
  minutes: "мин",
  markDone: "Отметить",
  done: "Готово",
  reason: "Причина",
  estimated: "≈",
  source: "Источник",
  suggestions: "Подсказки",
  totalCourses: "Всего курсов",
  inProgress: "В процессе",
  completed: "Завершено",
  assignmentsDue: "Актуальных заданий",
  notesCount: "Заметок",
  cardsDue: "Карточек к повторению",
  quizAvg: "Средний балл",
  welcome: "Добро пожаловать",
  emptyDashboard: "Создайте программу или импортируйте JSON-структуру, чтобы начать.",
  todaysSchedule: "Расписание на сегодня",
  upcomingDeadlines: "Ближайшие дедлайны",
  upcomingExams: "Ближайшие экзамены",
  recentMaterials: "Недавние материалы",
  recentNotes: "Недавние заметки",
  suggestedPlan: "Рекомендуемый план",
  activeCourses: "Активные курсы",
  lowScoreQuizzes: "Тесты со слабым результатом",
  createProgram: "Создать программу",
  institution: "Учебное заведение",
  degree: "Степень",
  years: "Годы обучения",
  semesters: "Семестры",
  programName: "Название программы",
  noProgram: "Программа ещё не создана.",
  createCourse: "Создать курс",
  courseNumber: "Номер курса",
  credits: "Кредиты",
  courseType: "Тип",
  instructor: "Преподаватель",
  prerequisites: "Пререквизиты",
  difficulty: "Сложность",
  originalTitle: "Оригинальное название",
  semester: "Семестр",
  topics: "Темы",
  notStarted: "Не начат",
  learning: "Изучается",
  understood: "Понятно",
  completedStatus: "Завершён",
  addTopic: "Добавить тему",
  courseEvents: "Ближайшие события",
  courseMaterials: "Материалы",
  readinessScore: "Оценка готовности",
  readinessFormula: "40% темы · 25% тесты · 20% карточки · 15% задания",
  createNote: "Создать заметку",
  content: "Содержимое",
  tags: "Теги (через запятую)",
  linkedCourse: "Курс",
  linkedTopic: "Тема",
  linkedMaterial: "Материал",
  generateNotes: "Сгенерировать конспект — ещё не подключено",
  fromMaterial: "Из материала",
  createCard: "Создать карточку",
  front: "Лицевая сторона",
  cardBack: "Обратная сторона",
  review: "Повторить",
  again: "Ещё раз",
  good: "Нормально",
  easy: "Легко",
  new_: "Новые",
  mastered: "Освоено",
  reviewMode: "Режим повторения",
  noDueCards: "Нет карточек к повторению.",
  generateCards: "Сгенерировать карточки — ещё не подключено",
  buildCardsFromMaterial: "Создать карточки из материала",
  createQuiz: "Создать тест",
  addQuestion: "Добавить вопрос",
  question: "Вопрос",
  answer: "Ответ",
  correct: "Правильный",
  takeQuiz: "Пройти тест",
  submitQuiz: "Отправить",
  score: "Результат",
  attempts: "Попытки",
  retry: "Пройти снова",
  generateQuiz: "Сгенерировать тест — ещё не подключено",
  explanation: "Пояснение",
  buildQuizFromMaterial: "Собрать тест из материала",
  createAssignment: "Создать задание",
  dueDate: "Срок сдачи",
  priority: "Приоритет",
  grade: "Оценка",
  submitted: "Сдано",
  graded: "Оценено",
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  dataTitle: "Импорт / Экспорт",
  exportDesc: "Скачать все данные в виде JSON файла.",
  importDesc: "Импортировать ранее экспортированные JSON данные.",
  importSuccess: "Данные успешно импортированы.",
  clearConfirm: "Все локальные данные будут удалены. Продолжить?",
  emptyImport: "Загрузите JSON-структуру или создайте программу вручную.",
  createMaterial: "Создать материал",
  uploadFile: "Загрузить файл",
  pasteText: "Вставить текст",
  materialType: "Тип материала",
  syllabus: "Силабус",
  lecture: "Лекция",
  article: "Статья",
  presentationMat: "Презентация",
  exam: "Экзамен",
  other: "Другое",
  rawText: "Исходный текст",
  userSummary: "Ваше резюме",
  processingReady: "Готово",
  processingUnsupported: "Извлечение текста для этого формата ещё не подключено",
  processingNoText: "Нет текста",
  processingError: "Ошибка",
  createNoteFromMaterial: "Создать заметку",
  createFlashcardsFromMaterial: "Собрать карточки",
  createQuizFromMaterial: "Собрать тест",
  createOutlineFromMaterial: "Создать план презентации",
  materialsEmpty: "Материалов пока нет. Загрузите файл или вставьте текст.",
  extractTerms: "Подсказать термины",
  extractTermsHelp: "Локальная эвристика — часто встречающиеся термины с большой буквы. Не AI.",
  fileMeta: "О файле",
  aiDisabledHint: "AI не подключён. Ручные инструменты работают локально.",
  createOutline: "Создать план",
  slides: "Слайды",
  slide: "Слайд",
  addSlide: "Добавить слайд",
  bullets: "Пункты (по одному на строку)",
  speakerNotes: "Заметки докладчика",
  sourceQuote: "Цитата-источник",
  exportMarkdown: "Экспорт в Markdown",
  presentationsEmpty: "Планов презентаций пока нет.",
  createEvent: "Создать событие",
  eventType: "Тип события",
  class_: "Занятие",
  studySession: "Учебная сессия",
  personal: "Личное",
  date: "Дата",
  startTime: "Начало",
  endTime: "Конец",
  recurrence: "Повторение",
  weekday: "День недели",
  weekly: "Еженедельно",
  none_: "Нет",
  deadlines: "Дедлайны",
  calendarEmpty: "Событий пока нет.",
  availableTime: "Доступное время сегодня",
  generatePlan: "Собрать план",
  emptyPlan: "Сейчас нечего рекомендовать. Добавьте задания, карточки или тесты.",
  studyPlanIntro: "Рекомендации по простым правилам, только на основе ваших данных.",
  planWhyCardsDue: "карточек ждут повторения сегодня",
  planWhyLowScore: "лучший результат по тесту ниже 70%",
  planWhyLearning: "тема ещё в статусе «изучается»",
  planWhyDeadline: "скоро дедлайн задания",
  planWhyExamSoon: "скоро экзамен",
  planWhyStaleCourse: "по курсу нет недавней активности",
  planCompletedToday: "Выполнено сегодня",
  aiConnection: "Подключение AI",
  aiStatus: "Статус",
  aiStatusNotConnected: "Не подключено",
  aiExplanation:
    "AI-генерация ещё не подключена. Ручные инструменты работают локально. В будущем можно будет указать серверный endpoint — секретные ключи в браузере не хранятся никогда.",
  serverEndpoint: "Серверный endpoint (в планах)",
  noKeyInFrontend: "Секретные ключи не хранятся в приложении.",
  importSyllabus: "Импорт силабуса",
  importSyllabusIntro: "Загрузите XLSX-силабус/ידיעון или структурированный JSON и превратите его в реальные программы и курсы.",
  syllabusTabXlsx: "XLSX файл",
  syllabusTabJson: "Структурированный JSON",
  syllabusChooseXlsx: "Выбрать XLSX файл",
  syllabusChooseSheet: "Лист",
  syllabusHeaderRow: "Строка заголовков",
  syllabusSheetPreview: "Предпросмотр листа",
  syllabusColumnMapping: "Сопоставление колонок",
  syllabusMappingHelp: "Укажите, какая колонка содержит каждое поле курса. Обязательна только «Название».",
  syllabusColTitle: "Название (обязательно)",
  syllabusColOriginalTitle: "Оригинальное название",
  syllabusColNumber: "Номер курса",
  syllabusColSemester: "Семестр",
  syllabusColCredits: "Кредиты",
  syllabusColInstructor: "Преподаватель",
  syllabusColType: "Тип",
  syllabusColDescription: "Описание",
  syllabusColTopics: "Темы (по одной на строку)",
  syllabusColIgnore: "— не использовать —",
  syllabusCoursePreview: "Предпросмотр курсов",
  syllabusIncludeRow: "Включить",
  syllabusDestinationProgram: "Программа-приёмник",
  syllabusNewProgram: "Создать новую программу",
  syllabusExistingProgram: "Добавить в существующую программу",
  syllabusRunImport: "Импортировать в рабочее пространство",
  syllabusImported: "Импорт выполнен",
  syllabusJsonPasteHelp: "Вставьте JSON-объект с программой и/или массивом курсов.",
  syllabusJsonSchemaHint: `Пример: { "program": { "name": "...", "institution": "..." }, "courses": [ { "title": "...", "number": "615", "semester": "Sem A", "credits": 5, "topics": ["Тема 1", "Тема 2"] } ] }`,
  syllabusJsonPreview: "Разобранный предпросмотр",
  syllabusHistory: "История импортов",
  syllabusHistoryEmpty: "Импортов пока нет.",
  syllabusNoRowsPicked: "Ни одна строка не выбрана.",
  syllabusTitleRequired: "Сначала укажите колонку «Название».",
  syllabusRowCount: "строк",
  syllabusCoursesImported: "курсов импортировано",
  syllabusTopicsImported: "тем импортировано",
  syllabusTopicsSplitHelp: "Ячейки с темами разбиваются по переводу строки или «;».",
};

export const dicts: Record<Lang, Dict> = { en, ru };
export const t = dicts;
