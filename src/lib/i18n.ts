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
  emptyShelfTitle: string;
  emptyShelfHint: string;
  addFirstCourse: string;
  creditsInvalid: string;
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
  // syllabus v2 (auto-parse flow)
  syllabusUploadTitle: string;
  syllabusUploadHelp: string;
  syllabusAutoParse: string;
  syllabusParsing: string;
  syllabusStepReading: string;
  syllabusStepDetectSheets: string;
  syllabusStepDetectHeaders: string;
  syllabusStepDetectSections: string;
  syllabusStepDetectCourses: string;
  syllabusStepCleaning: string;
  syllabusStepBuildDraft: string;
  syllabusCleanReview: string;
  syllabusRawSpreadsheet: string;
  syllabusAdvancedMapping: string;
  syllabusDropHere: string;
  syllabusOr: string;
  syllabusChooseFile: string;
  syllabusDetectedSheet: string;
  syllabusParserConfidence: string;
  syllabusDetectedSemesters: string;
  syllabusDetectedCourses: string;
  syllabusWarnings: string;
  syllabusIgnoredRows: string;
  syllabusIgnoredRowsHelp: string;
  syllabusConvertToCourse: string;
  syllabusIgnorePermanently: string;
  syllabusViewCells: string;
  syllabusSourceRow: string;
  syllabusLowConfidence: string;
  syllabusRowsGroup: string;
  syllabusTotalCredits: string;
  syllabusDetectedProgramName: string;
  syllabusDetectedInstitution: string;
  syllabusDetectedDegree: string;
  syllabusReimportReplace: string;
  syllabusReimportMerge: string;
  syllabusReimportNew: string;
  syllabusDuplicateFound: string;
  syllabusDupSkip: string;
  syllabusDupUpdate: string;
  syllabusDupNew: string;
  syllabusAIImprove: string;
  syllabusAINotConnected: string;
  syllabusAIHint: string;
  syllabusAIRunning: string;
  syllabusAIFailed: string;
  syllabusNoCoursesDetected: string;
  syllabusUnsupportedFile: string;
  syllabusFileEmpty: string;
  syllabusParserDiag: string;
  syllabusParserVersion: string;
  syllabusSupportedFormats: string;
  syllabusReasonEmpty: string;
  syllabusReasonHeader: string;
  syllabusReasonSection: string;
  syllabusReasonTotal: string;
  syllabusReasonNotes: string;
  syllabusReasonUnknown: string;
  syllabusReasonNoTitle: string;
  // Gemini + diagnostics
  syllabusReviewAiDraft: string;
  syllabusUseDeterministic: string;
  syllabusUseGemini: string;
  syllabusCompareDrafts: string;
  syllabusParserComparison: string;
  syllabusDeterministicCourses: string;
  syllabusGeminiCourses: string;
  syllabusCoursesAdded: string;
  syllabusCoursesRemoved: string;
  syllabusCheckThisRow: string;
  syllabusRowExplain: string;
  syllabusConfirmImport: string;
  syllabusCoursesToImport: string;
  syllabusTopicsToImport: string;
  syllabusDuplicatesCount: string;
  syllabusSkippedRows: string;
  syllabusLowConfidenceRows: string;
  syllabusImportBtn: string;
  syllabusDupReviewTitle: string;
  syllabusDupExisting: string;
  syllabusDupIncoming: string;
  syllabusDupAction: string;
  syllabusDupActionSkip: string;
  syllabusDupActionUpdate: string;
  syllabusDupActionNew: string;
  syllabusDiagPanel: string;
  syllabusDiagClassifiedRows: string;
  syllabusDiagDetectedColumns: string;
  syllabusDiagLowConfRows: string;
  syllabusDiagGeminiStatus: string;
  syllabusDiagGeminiModel: string;
  syllabusDiagSelectedSheet: string;
  syllabusDiagTotalRows: string;
  aiProvider: string;
  aiConfigured: string;
  aiModel: string;
  aiActionsTitle: string;
  aiActionSyllabus: string;
  aiActionStudyGen: string;
  statusEnabled: string;
  statusDisabled: string;
  statusNotImplemented: string;
  // AI generation UI
  aiGenerate: string;
  aiThinking: string;
  aiError: string;
  aiWarnings: string;
  aiSources: string;
  aiRegenerate: string;
  aiSelectSource: string;
  aiSelectChunks: string;
  aiNoChunksSelected: string;
  aiUnavailable: string;
  aiGenerateNote: string;
  aiGenerateFlashcards: string;
  aiGenerateQuiz: string;
  aiGeneratePresentation: string;
  aiBreakDownAssignment: string;
  aiExplainTopic: string;
  aiSimplifyText: string;
  aiTranslateText: string;
  aiChooseMaterial: string;
  aiInstructionsOptional: string;
  aiTooManyChars: string;
  aiKeyTerms: string;
  aiShortExplanation: string;
  aiDetailedExplanation: string;
  aiSteps: string;
  aiChecklist: string;
  aiEstimatedTime: string;
  aiAppendToNotes: string;
  aiSaveAsNote: string;
  copyFailed: string;
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
  // study room shell
  navHome: string;
  navStudySession: string;
  navImportSyllabus: string;
  navMoreTools: string;
  studyRoomSubtitle: string;
  localWorkspace: string;
  sidebarQuote: string;
  mainNavigationAria: string;
  openNavigationAria: string;
  closeNavigationAria: string;
  closeMenuAria: string;
  lamdanHomeAria: string;
  // dashboard room
  dashRoomEyebrow: string;
  dashGreetingMorning: string;
  dashGreetingAfternoon: string;
  dashGreetingEvening: string;
  dashGreetingNight: string;
  dashGreetingTail: string;
  dashSubtitle: string;
  searchLibraryPlaceholder: string;
  searchLibraryAria: string;
  todayLabel: string;
  openCalendar: string;
  continueStudying: string;
  viewAllCourses: string;
  viewAllCoursesShort: string;
  studyToolsAria: string;
  shortcutOpenArchive: string;
  shortcutContinueWriting: string;
  shortcutReviewDeck: string;
  shortcutStart45: string;
  focusSession: string;
  // courses room
  yourLibraryEyebrow: string;
  libraryNoteLabel: string;
  libraryNoteBody: string;
  // materials room
  archiveEyebrow: string;
  materialsSubtitle: string;
  upload: string;
  foldersAria: string;
  folderLectureNotes: string;
  folderSlides: string;
  folderReadings: string;
  folderExams: string;
  folderArticles: string;
  folderOther: string;
  searchArchivePlaceholder: string;
  searchArchiveAria: string;
  listViewAria: string;
  gridViewAria: string;
  materialsListAria: string;
  colName: string;
  colCourse: string;
  colDate: string;
  colSize: string;
  generalFolder: string;
  ledgerKnowledgeLabel: string;
  ledgerKnowledgeBody: string;
  // notes room
  commonplaceEyebrow: string;
  newNote: string;
  notesIndexLabel: string;
  searchNotesPlaceholder: string;
  searchNotesAria: string;
  notebookQuote: string;
  classNotesCategory: string;
  untitledNote: string;
  keyIdeaHeading: string;
  diagramAria: string;
  stickyThought: string;
  pin: string;
  savedLocally: string;
  notesGatheredSuffix: string;
  // calendar room
  calendarEyebrow: string;
  calendarSubtitle: string;
  weekViewLabel: string;
  monthViewLabel: string;
  calendarQuote: string;
  weekdayMon: string;
  weekdayTue: string;
  weekdayWed: string;
  weekdayThu: string;
  weekdayFri: string;
  weekdaySat: string;
  weekdaySun: string;
  // study session room
  focusEyebrow: string;
  focusSubtitle: string;
  ambientSounds: string;
  currentSessionLabel: string;
  changeCourse: string;
  todaysGoalLabel: string;
  focusTimeLabel: string;
  focusRunning: string;
  focusReady: string;
  start: string;
  pause: string;
  finish: string;
  soundRain: string;
  soundRainDesc: string;
  soundCafe: string;
  soundCafeDesc: string;
  soundFireplace: string;
  soundFireplaceDesc: string;
  soundForest: string;
  soundForestDesc: string;
  soundVolumeAria: string;
  // quizzes room
  practicePaperEyebrow: string;
  quizzesSubtitle: string;
  quizzesGenerate: string;
  quizQuestionsLabel: string;
  quizNameLabel: string;
  quizDateLabel: string;
  checkAnswers: string;
  tryAgain: string;
  quizResultLabel: string;
  excellentRecall: string;
  reviewCorrections: string;
  examNoteLabel: string;
  examNoteBody: string;
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
  emptyShelfTitle: "Your shelf is empty",
  emptyShelfHint: "Add your first course to begin",
  addFirstCourse: "Add your first course",
  creditsInvalid: "Credits must be a number ≥ 0",
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
  syllabusUploadTitle: "Upload syllabus / program file",
  syllabusUploadHelp: "Upload a program file or syllabus. Lamdan will try to detect semesters, courses, credits, and instructors automatically.",
  syllabusAutoParse: "Auto-parse",
  syllabusParsing: "Parsing…",
  syllabusStepReading: "Reading workbook",
  syllabusStepDetectSheets: "Detecting sheets",
  syllabusStepDetectHeaders: "Detecting header rows",
  syllabusStepDetectSections: "Detecting semester sections",
  syllabusStepDetectCourses: "Detecting course rows",
  syllabusStepCleaning: "Cleaning ignored rows",
  syllabusStepBuildDraft: "Building draft",
  syllabusCleanReview: "Clean review",
  syllabusRawSpreadsheet: "Raw spreadsheet",
  syllabusAdvancedMapping: "Advanced mapping",
  syllabusDropHere: "Drop XLSX / CSV / JSON here",
  syllabusOr: "or",
  syllabusChooseFile: "Choose file",
  syllabusDetectedSheet: "Sheet",
  syllabusParserConfidence: "Confidence",
  syllabusDetectedSemesters: "Semesters",
  syllabusDetectedCourses: "Courses",
  syllabusWarnings: "Warnings",
  syllabusIgnoredRows: "Ignored rows",
  syllabusIgnoredRowsHelp: "Rows the parser skipped. Review anything that should have been imported.",
  syllabusConvertToCourse: "Convert to course",
  syllabusIgnorePermanently: "Ignore",
  syllabusViewCells: "View cells",
  syllabusSourceRow: "Source row",
  syllabusLowConfidence: "Low confidence",
  syllabusRowsGroup: "courses",
  syllabusTotalCredits: "total credits",
  syllabusDetectedProgramName: "Detected program name",
  syllabusDetectedInstitution: "Detected institution",
  syllabusDetectedDegree: "Detected degree",
  syllabusReimportReplace: "Replace course structure",
  syllabusReimportMerge: "Merge into program",
  syllabusReimportNew: "Create new program",
  syllabusDuplicateFound: "Possible duplicate",
  syllabusDupSkip: "Skip",
  syllabusDupUpdate: "Update existing",
  syllabusDupNew: "Import as new",
  syllabusAIImprove: "Improve parsing with AI",
  syllabusAINotConnected: "AI parsing is not available",
  syllabusAIHint: "AI can help fix complex tables, but import only happens after your confirmation.",
  syllabusAIRunning: "Asking AI…",
  syllabusAIFailed: "AI could not refine this draft",
  syllabusNoCoursesDetected: "No course rows detected. Try Advanced mapping.",
  syllabusUnsupportedFile: "Unsupported file format.",
  syllabusFileEmpty: "The file is empty.",
  syllabusParserDiag: "Syllabus parser",
  syllabusParserVersion: "Deterministic parser version",
  syllabusSupportedFormats: "Supported formats: XLSX, XLS, JSON",
  syllabusReasonEmpty: "empty row",
  syllabusReasonHeader: "header row",
  syllabusReasonSection: "semester / section row",
  syllabusReasonTotal: "total credits row",
  syllabusReasonNotes: "notes row",
  syllabusReasonUnknown: "not recognised as a course",
  syllabusReasonNoTitle: "no title detected",
  searchNav: "Search",
  overview: "Overview",
  chunks: "Chunks",
  studyBuilder: "Study Builder",
  outputs: "Outputs",
  wordCount: "Words",
  charCount: "Characters",
  chunkCount: "Chunks",
  pageCount: "Pages",
  extractionMethod: "Extraction",
  sourceLanguage: "Language",
  processingPartial: "Partially extracted",
  processingWarnings: "Warnings",
  regenerateChunks: "Regenerate chunks from text",
  clearRawText: "Clear text",
  addChunk: "Add chunk",
  editChunk: "Edit chunk",
  deleteChunk: "Delete chunk",
  searchInChunks: "Search inside chunks",
  useSelection: "Use selected chunk",
  selectionEmpty: "Select a chunk first",
  createNoteFromChunk: "Create note from chunk",
  createCardFromChunk: "Create flashcard from chunk",
  createQuestionFromChunk: "Create quiz question from chunk",
  createAssignmentNoteFromChunk: "Create assignment note from chunk",
  createSlideFromChunk: "Create presentation slide from chunk",
  sourceChunks: "Source",
  openSource: "Open source",
  chunksEmpty: "No chunks yet. Generate chunks from text.",
  materialsEmptyV2: "Upload a material or paste text to begin.",
  materialNoTextExtracted: "Text was not extracted. Paste it manually or try another format.",
  materialUnsupportedPaste: "This file format is not connected for extraction. Paste text below manually.",
  langRu: "Russian",
  langEn: "English",
  langHe: "Hebrew",
  langAr: "Arabic",
  langMixed: "Mixed",
  langUnknown: "Unknown",
  extMethodManual: "Manual",
  extMethodTxt: "Text",
  extMethodMarkdown: "Markdown",
  extMethodCsv: "CSV",
  extMethodJson: "JSON",
  extMethodHtml: "HTML",
  extMethodXml: "XML",
  extMethodYaml: "YAML",
  extMethodXlsx: "XLSX",
  extMethodDocx: "DOCX",
  extMethodPdf: "PDF",
  needsAttention: "Needs attention",
  unsupportedFiles: "Files needing manual text",
  materialsWithoutCourse: "Materials without a course",
  materialsWithChunksNoOutputs: "Chunks not yet used",
  continueLatestMaterial: "Continue from latest material",
  recentlyProcessed: "Recently processed",
  searchPlaceholderGlobal: "Search across courses, materials, notes, chunks…",
  searchNoResults: "No results.",
  searchAllScopes: "All",
  filterStatus: "Status",
  filterExtraction: "Extraction",
  filterCourse: "Course",
  filterTag: "Tag",
  statusReady: "Ready",
  statusUnsupported: "Unsupported",
  statusError: "Error",
  statusNoText: "No text",
  statusPartial: "Partial",
  regenerateChunksHelp: "Splits current text into chunks. Replaces existing chunks.",
  chunkAddedManually: "Chunk added",
  clearRawTextConfirm: "Delete extracted text? Chunks stay.",
  extractingFile: "Extracting…",
  pdfNoTextHint: "No text found. This may be a scanned PDF. Paste the text manually.",
  docxUnsupportedHint: "DOCX text extraction is not connected yet.",
  pdfUnsupportedHint: "PDF text extraction is not connected yet.",
  ingestionErrorHint: "Extraction failed. You can still paste text manually below.",
  syllabusReviewAiDraft: "Review the AI draft before importing",
  syllabusUseDeterministic: "Use deterministic draft",
  syllabusUseGemini: "Use AI draft",
  syllabusCompareDrafts: "Compare drafts",
  syllabusParserComparison: "Parser comparison",
  syllabusDeterministicCourses: "Deterministic courses",
  syllabusGeminiCourses: "AI courses",
  syllabusCoursesAdded: "Added by AI",
  syllabusCoursesRemoved: "Removed by AI",
  syllabusCheckThisRow: "Check this row",
  syllabusRowExplain: "Row details",
  syllabusConfirmImport: "Confirm import",
  syllabusCoursesToImport: "Courses to import",
  syllabusTopicsToImport: "Topics to import",
  syllabusDuplicatesCount: "Duplicates",
  syllabusSkippedRows: "Skipped rows",
  syllabusLowConfidenceRows: "Low-confidence rows",
  syllabusImportBtn: "Import",
  syllabusDupReviewTitle: "Duplicate review",
  syllabusDupExisting: "Existing course",
  syllabusDupIncoming: "Incoming course",
  syllabusDupAction: "Action",
  syllabusDupActionSkip: "Skip",
  syllabusDupActionUpdate: "Update existing",
  syllabusDupActionNew: "Import as new",
  syllabusDiagPanel: "Parser diagnostics",
  syllabusDiagClassifiedRows: "Classified rows",
  syllabusDiagDetectedColumns: "Detected columns",
  syllabusDiagLowConfRows: "Low-confidence rows",
  syllabusDiagGeminiStatus: "AI status",
  syllabusDiagGeminiModel: "AI model",
  syllabusDiagSelectedSheet: "Selected sheet",
  syllabusDiagTotalRows: "Total rows",
  aiProvider: "AI provider",
  aiConfigured: "AI configured",
  aiModel: "AI model",
  aiActionsTitle: "Supported AI actions",
  aiActionSyllabus: "Syllabus parsing",
  aiActionStudyGen: "Study generation",
  statusEnabled: "enabled",
  statusDisabled: "disabled",
  statusNotImplemented: "not implemented yet",
  aiGenerate: "Generate with AI",
  aiThinking: "AI is thinking…",
  aiError: "AI request failed",
  aiWarnings: "Warnings",
  aiSources: "Source chunks",
  aiRegenerate: "Regenerate",
  aiSelectSource: "Select a material",
  aiSelectChunks: "Select chunks (up to 8)",
  aiNoChunksSelected: "Select at least one chunk",
  aiUnavailable: "AI is not connected",
  aiGenerateNote: "Generate note with AI",
  aiGenerateFlashcards: "Generate flashcards with AI",
  aiGenerateQuiz: "Generate quiz with AI",
  aiGeneratePresentation: "Generate outline with AI",
  aiBreakDownAssignment: "Break down with AI",
  aiExplainTopic: "Explain with AI",
  aiSimplifyText: "Simplify with AI",
  aiTranslateText: "Translate with AI",
  aiChooseMaterial: "Choose a material",
  aiInstructionsOptional: "Instructions (optional)",
  aiTooManyChars: "Selected text exceeds the size limit. Select fewer chunks.",
  aiKeyTerms: "Key terms",
  aiShortExplanation: "Short explanation",
  aiDetailedExplanation: "Detailed explanation",
  aiSteps: "Steps",
  aiChecklist: "Checklist",
  aiEstimatedTime: "Estimated time",
  aiAppendToNotes: "Append to assignment notes",
  aiSaveAsNote: "Save as note",
  copyFailed: "Copy failed",
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
  emptyShelfTitle: "Полка пока пуста",
  emptyShelfHint: "Добавьте первый курс, чтобы начать",
  addFirstCourse: "Добавить первый курс",
  creditsInvalid: "Кредиты — число ≥ 0",
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
  syllabusUploadTitle: "Загрузите файл силабуса / программы",
  syllabusUploadHelp: "Загрузите файл программы или силлабус. Lamdan сам попробует найти семестры, курсы, кредиты и преподавателей.",
  syllabusAutoParse: "Автоматически разобрать",
  syllabusParsing: "Разбираем…",
  syllabusStepReading: "Чтение книги",
  syllabusStepDetectSheets: "Поиск листов",
  syllabusStepDetectHeaders: "Поиск строк заголовков",
  syllabusStepDetectSections: "Поиск разделов семестров",
  syllabusStepDetectCourses: "Поиск строк курсов",
  syllabusStepCleaning: "Отсеиваем служебные строки",
  syllabusStepBuildDraft: "Собираем черновик",
  syllabusCleanReview: "Чистый просмотр",
  syllabusRawSpreadsheet: "Сырой лист",
  syllabusAdvancedMapping: "Расширенная настройка",
  syllabusDropHere: "Перетащите XLSX / CSV / JSON сюда",
  syllabusOr: "или",
  syllabusChooseFile: "Выбрать файл",
  syllabusDetectedSheet: "Лист",
  syllabusParserConfidence: "Уверенность парсера",
  syllabusDetectedSemesters: "Семестров",
  syllabusDetectedCourses: "Курсов",
  syllabusWarnings: "Предупреждений",
  syllabusIgnoredRows: "Пропущенные строки",
  syllabusIgnoredRowsHelp: "Строки, которые парсер не импортировал. Проверьте, если что-то важное пропало.",
  syllabusConvertToCourse: "Сделать курсом",
  syllabusIgnorePermanently: "Пропустить",
  syllabusViewCells: "Показать ячейки",
  syllabusSourceRow: "Строка источника",
  syllabusLowConfidence: "Низкая уверенность",
  syllabusRowsGroup: "курсов",
  syllabusTotalCredits: "всего кредитов",
  syllabusDetectedProgramName: "Найденное имя программы",
  syllabusDetectedInstitution: "Найденное учебное заведение",
  syllabusDetectedDegree: "Найденная степень",
  syllabusReimportReplace: "Заменить структуру курсов",
  syllabusReimportMerge: "Добавить в программу",
  syllabusReimportNew: "Создать новую программу",
  syllabusDuplicateFound: "Возможный дубликат",
  syllabusDupSkip: "Пропустить",
  syllabusDupUpdate: "Обновить существующий",
  syllabusDupNew: "Импортировать как новый",
  syllabusAIImprove: "Улучшить разбор с ИИ",
  syllabusAINotConnected: "ИИ-разбор недоступен",
  syllabusAIHint: "ИИ может помочь исправить сложные таблицы, но импорт произойдёт только после вашего подтверждения.",
  syllabusAIRunning: "Спрашиваем ИИ…",
  syllabusAIFailed: "ИИ не смог улучшить черновик",
  syllabusNoCoursesDetected: "Курсы не найдены. Попробуйте «Расширенная настройка».",
  syllabusUnsupportedFile: "Формат файла не поддерживается.",
  syllabusFileEmpty: "Файл пуст.",
  syllabusParserDiag: "Парсер силабусов",
  syllabusParserVersion: "Версия детерминированного парсера",
  syllabusSupportedFormats: "Поддерживаемые форматы: XLSX, XLS, JSON",
  syllabusReasonEmpty: "пустая строка",
  syllabusReasonHeader: "строка заголовков",
  syllabusReasonSection: "разделитель семестра",
  syllabusReasonTotal: "строка итогов",
  syllabusReasonNotes: "строка примечаний",
  syllabusReasonUnknown: "не распознано как курс",
  syllabusReasonNoTitle: "не найдено название",
  searchNav: "Поиск",
  overview: "Обзор",
  chunks: "Чанки",
  studyBuilder: "Учебный конструктор",
  outputs: "Выходы",
  wordCount: "Слов",
  charCount: "Символов",
  chunkCount: "Чанков",
  pageCount: "Страниц",
  extractionMethod: "Извлечение",
  sourceLanguage: "Язык",
  processingPartial: "Извлечено частично",
  processingWarnings: "Предупреждения",
  regenerateChunks: "Пересоздать чанки из текста",
  clearRawText: "Очистить текст",
  addChunk: "Добавить чанк",
  editChunk: "Изменить чанк",
  deleteChunk: "Удалить чанк",
  searchInChunks: "Поиск внутри чанков",
  useSelection: "Использовать выбранный чанк",
  selectionEmpty: "Сначала выберите чанк",
  createNoteFromChunk: "Создать заметку из чанка",
  createCardFromChunk: "Создать карточку из чанка",
  createQuestionFromChunk: "Создать вопрос теста из чанка",
  createAssignmentNoteFromChunk: "Создать заметку задания из чанка",
  createSlideFromChunk: "Создать слайд из чанка",
  sourceChunks: "Источник",
  openSource: "Открыть источник",
  chunksEmpty: "Чанков пока нет. Сгенерируйте чанки из текста.",
  materialsEmptyV2: "Загрузите материал или вставьте текст, чтобы начать.",
  materialNoTextExtracted: "Текст не извлечён. Вставьте его вручную или попробуйте другой формат.",
  materialUnsupportedPaste: "Этот формат файла не подключён для извлечения. Вставьте текст ниже вручную.",
  langRu: "Русский",
  langEn: "Английский",
  langHe: "Иврит",
  langAr: "Арабский",
  langMixed: "Смешанный",
  langUnknown: "Неизвестно",
  extMethodManual: "Вручную",
  extMethodTxt: "Текст",
  extMethodMarkdown: "Markdown",
  extMethodCsv: "CSV",
  extMethodJson: "JSON",
  extMethodHtml: "HTML",
  extMethodXml: "XML",
  extMethodYaml: "YAML",
  extMethodXlsx: "XLSX",
  extMethodDocx: "DOCX",
  extMethodPdf: "PDF",
  needsAttention: "Требует внимания",
  unsupportedFiles: "Файлы, которым нужен ручной текст",
  materialsWithoutCourse: "Материалы без курса",
  materialsWithChunksNoOutputs: "Чанки без заметок и карточек",
  continueLatestMaterial: "Продолжить с последнего материала",
  recentlyProcessed: "Недавно обработанные",
  searchPlaceholderGlobal: "Поиск по курсам, материалам, заметкам, чанкам…",
  searchNoResults: "Ничего не найдено.",
  searchAllScopes: "Всё",
  filterStatus: "Статус",
  filterExtraction: "Извлечение",
  filterCourse: "Курс",
  filterTag: "Тег",
  statusReady: "Готово",
  statusUnsupported: "Не поддерживается",
  statusError: "Ошибка",
  statusNoText: "Нет текста",
  statusPartial: "Частично",
  regenerateChunksHelp: "Разбивает текущий текст на чанки. Существующие чанки будут заменены.",
  chunkAddedManually: "Чанк добавлен",
  clearRawTextConfirm: "Удалить извлечённый текст? Чанки останутся.",
  extractingFile: "Извлечение…",
  pdfNoTextHint: "Текст не найден. Возможно, это скан. Вставьте текст вручную.",
  docxUnsupportedHint: "Извлечение текста из DOCX ещё не подключено.",
  pdfUnsupportedHint: "Извлечение текста из PDF ещё не подключено.",
  ingestionErrorHint: "Извлечение не удалось. Вставьте текст вручную ниже.",
  syllabusReviewAiDraft: "Проверьте AI-черновик перед импортом",
  syllabusUseDeterministic: "Использовать детерминированный",
  syllabusUseGemini: "Использовать черновик ИИ",
  syllabusCompareDrafts: "Сравнить разборы",
  syllabusParserComparison: "Сравнение разборов",
  syllabusDeterministicCourses: "Детерминированный: курсов",
  syllabusGeminiCourses: "ИИ: курсов",
  syllabusCoursesAdded: "Добавлено ИИ",
  syllabusCoursesRemoved: "Убрано ИИ",
  syllabusCheckThisRow: "Проверьте эту строку",
  syllabusRowExplain: "Подробности строки",
  syllabusConfirmImport: "Подтвердите импорт",
  syllabusCoursesToImport: "Курсов к импорту",
  syllabusTopicsToImport: "Тем к импорту",
  syllabusDuplicatesCount: "Дубликатов",
  syllabusSkippedRows: "Строк пропущено",
  syllabusLowConfidenceRows: "Строк с низкой уверенностью",
  syllabusImportBtn: "Импортировать",
  syllabusDupReviewTitle: "Разбор дубликатов",
  syllabusDupExisting: "Существующий курс",
  syllabusDupIncoming: "Новый курс",
  syllabusDupAction: "Действие",
  syllabusDupActionSkip: "Пропустить",
  syllabusDupActionUpdate: "Обновить существующий",
  syllabusDupActionNew: "Импортировать как новый",
  syllabusDiagPanel: "Диагностика разбора",
  syllabusDiagClassifiedRows: "Классифицированные строки",
  syllabusDiagDetectedColumns: "Обнаруженные колонки",
  syllabusDiagLowConfRows: "Строк с низкой уверенностью",
  syllabusDiagGeminiStatus: "Статус ИИ",
  syllabusDiagGeminiModel: "Модель ИИ",
  syllabusDiagSelectedSheet: "Выбранный лист",
  syllabusDiagTotalRows: "Всего строк",
  aiProvider: "AI-провайдер",
  aiConfigured: "ИИ настроен",
  aiModel: "Модель ИИ",
  aiActionsTitle: "Поддерживаемые AI-действия",
  aiActionSyllabus: "Разбор силабуса",
  aiActionStudyGen: "Генерация учебных материалов",
  statusEnabled: "включено",
  statusDisabled: "выключено",
  statusNotImplemented: "пока не реализовано",
  aiGenerate: "Сгенерировать с ИИ",
  aiThinking: "ИИ думает…",
  aiError: "Ошибка запроса к ИИ",
  aiWarnings: "Предупреждения",
  aiSources: "Источники",
  aiRegenerate: "Сгенерировать заново",
  aiSelectSource: "Выберите материал",
  aiSelectChunks: "Выберите чанки (до 8)",
  aiNoChunksSelected: "Выберите хотя бы один чанк",
  aiUnavailable: "ИИ не подключён",
  aiGenerateNote: "Сгенерировать заметку с ИИ",
  aiGenerateFlashcards: "Сгенерировать карточки с ИИ",
  aiGenerateQuiz: "Сгенерировать тест с ИИ",
  aiGeneratePresentation: "Сгенерировать план презентации с ИИ",
  aiBreakDownAssignment: "Разбить задание с ИИ",
  aiExplainTopic: "Объяснить с ИИ",
  aiSimplifyText: "Упростить с ИИ",
  aiTranslateText: "Перевести с ИИ",
  aiChooseMaterial: "Выберите материал",
  aiInstructionsOptional: "Инструкции (необязательно)",
  aiTooManyChars: "Слишком много текста. Выберите меньше чанков.",
  aiKeyTerms: "Ключевые термины",
  aiShortExplanation: "Кратко",
  aiDetailedExplanation: "Подробно",
  aiSteps: "Шаги",
  aiChecklist: "Чек-лист",
  aiEstimatedTime: "Оценка времени",
  aiAppendToNotes: "Добавить в заметки задания",
  aiSaveAsNote: "Сохранить как заметку",
  copyFailed: "Не удалось скопировать",
};

export const dicts: Record<Lang, Dict> = { en, ru };
export const t = dicts;

export function coursesOnShelf(lang: Lang, n: number): string {
  if (lang === "ru") {
    const mod100 = n % 100;
    const mod10 = n % 10;
    let word: string;
    if (mod100 >= 11 && mod100 <= 14) word = "курсов";
    else if (mod10 === 1) word = "курс";
    else if (mod10 >= 2 && mod10 <= 4) word = "курса";
    else word = "курсов";
    return `${n} ${word} на полке`;
  }
  return `${n} ${n === 1 ? "course" : "courses"} on the shelf`;
}
