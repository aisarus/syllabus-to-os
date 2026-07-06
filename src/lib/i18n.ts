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
  // notes
  createNote: string;
  content: string;
  tags: string;
  linkedCourse: string;
  linkedTopic: string;
  generateNotes: string;
  // flashcards
  createCard: string;
  front: string;
  back: string;
  review: string;
  again: string;
  good: string;
  easy: string;
  new_: string;
  mastered: string;
  reviewMode: string;
  noDueCards: string;
  generateCards: string;
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
  totalCourses: "Total courses",
  inProgress: "In progress",
  completed: "Completed",
  assignmentsDue: "Assignments due",
  notesCount: "Notes",
  cardsDue: "Cards due",
  quizAvg: "Quiz average",
  welcome: "Welcome",
  emptyDashboard: "Create a program or import a JSON structure to get started.",
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
  createNote: "Create note",
  content: "Content",
  tags: "Tags (comma separated)",
  linkedCourse: "Course",
  linkedTopic: "Topic",
  generateNotes: "Generate notes — not connected yet",
  createCard: "Create card",
  front: "Front",
  back: "Back",
  review: "Review",
  again: "Again",
  good: "Good",
  easy: "Easy",
  new_: "New",
  mastered: "Mastered",
  reviewMode: "Review mode",
  noDueCards: "No cards due for review.",
  generateCards: "Generate flashcards — not connected yet",
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
  totalCourses: "Всего курсов",
  inProgress: "В процессе",
  completed: "Завершено",
  assignmentsDue: "Актуальных заданий",
  notesCount: "Заметок",
  cardsDue: "Карточек к повторению",
  quizAvg: "Средний балл",
  welcome: "Добро пожаловать",
  emptyDashboard: "Создайте программу или импортируйте JSON-структуру, чтобы начать.",
  createProgram: "Создать программу",
  institution: "Учебное заведение",
  degree: "Степень",
  years: "Годы обучения",
  semesters: "Семестры",
  programName: "Название программы",
  noProgram: "Программа ещё не создана.",
  createCourse: "Создать курс",
  courseNumber: "Номер курса",
  credits: "Кредиты (нац)",
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
  createNote: "Создать заметку",
  content: "Содержимое",
  tags: "Теги (через запятую)",
  linkedCourse: "Курс",
  linkedTopic: "Тема",
  generateNotes: "Сгенерировать конспект — ещё не подключено",
  createCard: "Создать карточку",
  front: "Лицевая сторона",
  back: "Обратная сторона",
  review: "Повторить",
  again: "Ещё раз",
  good: "Нормально",
  easy: "Легко",
  new_: "Новые",
  mastered: "Освоено",
  reviewMode: "Режим повторения",
  noDueCards: "Нет карточек к повторению.",
  generateCards: "Сгенерировать карточки — ещё не подключено",
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
};

export const dicts: Record<Lang, Dict> = { en, ru };
export const t = dicts;
