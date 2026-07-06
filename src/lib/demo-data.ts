export type CourseType = "חובה" | "בחירה" | "סמינריון" | "פרויקט" | "מעבדה" | "תרגול";
export type CourseStatus = "not_started" | "studying" | "completed" | "risky" | "mastered";

export interface Topic {
  id: string;
  title: string;
  courseId: string;
  short: string;
  detailed: string;
  keyTerms: { he: string; en: string; ru?: string }[];
  confidence: number; // 0-100
  weak?: boolean;
}

export interface Exam {
  id: string;
  courseId: string;
  moed: "א" | "ב";
  date: string;
  weight: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  due: string;
  status: "todo" | "in_progress" | "submitted" | "graded";
  weight: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedHours: number;
}

export interface Course {
  id: string;
  number: string;
  titleHe: string;
  titleEn?: string;
  credits: number;
  type: CourseType;
  year: number;
  semester: "א" | "ב" | "קיץ";
  prerequisites: string[];
  status: CourseStatus;
  progress: number;
  instructor?: string;
  topics: Topic[];
  color?: string;
}

export interface Program {
  institution: string;
  program: string;
  faculty: string;
  department: string;
  degreeType: string;
  language: string;
  courses: Course[];
}

const c = (
  id: string,
  number: string,
  titleHe: string,
  year: number,
  semester: "א" | "ב",
  credits = 4,
  type: CourseType = "חובה",
  prerequisites: string[] = [],
  titleEn?: string,
): Course => ({
  id,
  number,
  titleHe,
  titleEn,
  credits,
  type,
  year,
  semester,
  prerequisites,
  status: "not_started",
  progress: 0,
  topics: [],
});

export const demoProgram: Program = {
  institution: "אוניברסיטת בר-אילן",
  program: "לימודי מידע",
  faculty: "מדעי החברה",
  department: "המחלקה ללימודי מידע",
  degreeType: "תואר ראשון",
  language: "עברית",
  courses: [
    // Year 1 Sem A
    c("159", "159", "מבנה המחשב ומערכות הפעלה", 1, "א", 4, "חובה", [], "Computer Architecture & OS"),
    c("160", "160", "יסודות מתמטיים ל-AI", 1, "א", 4, "חובה", [], "Math Foundations for AI"),
    c("615", "615", "יסודות התכנות", 1, "א", 5, "חובה", [], "Programming Fundamentals"),
    c("733", "733", "מבוא למסדי נתונים", 1, "א", 3, "חובה", [], "Intro to Databases"),
    c("707", "707", "מאגרי המידע במדעי החברה", 1, "א", 2, "חובה"),
    c("170", "170", "פסיכולוגיה של האינטרנט", 1, "א", 2, "בחירה"),
    // Year 1 Sem B
    c("979", "979", "תכנות מתקדם", 1, "ב", 4, "חובה", ["615"], "Advanced Programming"),
    c("161", "161", "מסדי נתונים מתקדמים", 1, "ב", 3, "חובה", ["733"]),
    c("123", "123", "מבוא לבניית אתרים באינטרנט", 1, "ב", 3, "חובה"),
    c("162", "162", "מבני נתונים", 1, "ב", 4, "חובה", ["615"], "Data Structures"),
    c("157", "157", "אינפורמטיקה משפטית ובינה מלאכותית", 1, "ב", 2, "בחירה"),
    c("193", "193", "מתמטיקה מתקדמים ל-AI", 1, "ב", 3, "חובה", ["160"]),
    c("522", "522", "תכנון מבוסס משתמש", 1, "ב", 2, "בחירה"),
    // Year 2 Sem A
    c("163", "163", "מבוא לפיתוח Full Stack", 2, "א", 4, "חובה", ["123", "979"]),
    c("164", "164", "תכנות בשפת פייתון", 2, "א", 3, "חובה", ["615"], "Python Programming"),
    c("440", "440", "אינטראקציית אדם-מחשב", 2, "א", 3, "חובה"),
    c("994a", "994", "ארגון מידע", 2, "א", 2, "חובה"),
    c("171", "171", "פיתוח צ'טבוטים בסביבת בינה מלאכותית", 2, "א", 3, "בחירה", ["164"]),
    c("150", "150", "Business Intelligence and Data Visualization", 2, "א", 3, "בחירה", [], "BI & Data Viz"),
    c("165", "165", "ביג דאטה ו-NoSQL", 2, "א", 3, "בחירה", ["161"]),
    c("215", "215", "מציאות מורחבת XR", 2, "א", 2, "בחירה"),
    c("169", "169", "תקשורת מחשבים", 2, "א", 3, "חובה"),
    c("156", "156", "מנהיגות וממשל בעידן ה-AI", 2, "א", 2, "בחירה"),
    // Year 2 Sem B
    c("166", "166", "פיתוח Full Stack מתקדם", 2, "ב", 4, "חובה", ["163"]),
    c("994b", "994", "מבוא לסטטיסטיקה ושיטות מחקר", 2, "ב", 3, "חובה"),
    c("167", "167", "מבוא לבינה מלאכותית", 2, "ב", 4, "חובה", ["164", "193"], "Intro to AI"),
    c("155", "155", "רובוטים וחברה", 2, "ב", 2, "בחירה"),
    c("168", "168", "Applied Artificial Intelligence", 2, "ב", 3, "בחירה", ["167"]),
    c("148", "148", "פיתוח מערכות ואוטומציות בגישת LOW CODE", 2, "ב", 2, "בחירה"),
    // Year 3 Sem A
    c("124", "124", "אבטחת מידע וסייבר – מתחילים", 3, "א", 3, "חובה"),
    c("152", "152", "מבוא לשיווק דיגיטלי", 3, "א", 2, "בחירה"),
    c("149", "149", "ניהול קוד ו-DevOps", 3, "א", 3, "חובה", ["166"]),
    c("700", "700", "מבוא למדעי המידע", 3, "א", 3, "חובה"),
    c("175", "175", "פרויקט גמר א'", 3, "א", 4, "פרויקט", ["166", "167"]),
    // Year 3 Sem B
    c("173", "173", "אבטחת מידע וסייבר – מתקדמים", 3, "ב", 3, "חובה", ["124"]),
    c("151", "151", "מבוא למודיעין תחרותי", 3, "ב", 2, "בחירה"),
    c("176", "176", "פרויקט גמר ב'", 3, "ב", 4, "פרויקט", ["175"]),
    c("153", "153", "יישומים מתודולוגיים במדעי המידע", 3, "ב", 3, "חובה"),
    c("158", "158", "מחשוב ענן", 3, "ב", 3, "בחירה", ["169"]),
    c("225", "225", "בינה מלאכותית אינטראקטיבית ב-Unity", 3, "ב", 2, "בחירה", ["167"]),
    c("172", "172", "חדשנות ויזמות בעידן ה-AI", 3, "ב", 2, "בחירה"),
    c("446", "446", "נושאים בניהול מידע אישי", 3, "ב", 2, "בחירה"),
    // Seminars
    c("947", "947", "כיווני מחקר באינטרנט", 3, "א", 3, "סמינריון"),
    c("378", "378", "מבוא לרשתות מורכבות", 3, "ב", 3, "סמינריון"),
    c("228", "228", "Seminar in Applied AI: Speech Processing", 3, "ב", 3, "סמינריון", ["167"]),
    c("191", "191", "אתיקה ובינה מלאכותית", 3, "א", 3, "סמינריון"),
    c("154", "154", "סוגיות עכשיוויות בטכנולוגיות חדשות", 3, "ב", 3, "סמינריון"),
  ],
};

// Seed some progress + topics for a lived-in feel
const seedTopics = (courseId: string, titles: [string, string][]): Topic[] =>
  titles.map(([he, en], i) => ({
    id: `${courseId}-t${i}`,
    courseId,
    title: he,
    short: `מבוא קצר לנושא ${he}. Concept overview of ${en}.`,
    detailed:
      `הסבר מעמיק בעברית אקדמית על הנושא "${he}". Explanation covers definitions, examples, and typical exam framing (${en}). ` +
      `כולל מונחי מפתח, דוגמאות ותרגילים.`,
    keyTerms: [
      { he: he.split(" ")[0], en: en.split(" ")[0], ru: "термин" },
      { he: "מודל", en: "Model", ru: "модель" },
    ],
    confidence: 30 + ((i * 17) % 60),
    weak: i % 3 === 0,
  }));

const topicMap: Record<string, [string, string][]> = {
  "615": [["משתנים וטיפוסים", "Variables & Types"], ["לולאות", "Loops"], ["פונקציות", "Functions"], ["מערכים", "Arrays"], ["רקורסיה", "Recursion"]],
  "162": [["מחסנית ותור", "Stack & Queue"], ["רשימה מקושרת", "Linked List"], ["עצים", "Trees"], ["גרפים", "Graphs"], ["טבלת גיבוב", "Hash Table"]],
  "167": [["חיפוש AI", "AI Search"], ["למידה מפוקחת", "Supervised Learning"], ["רשתות נוירונים", "Neural Networks"], ["אתיקה ב-AI", "AI Ethics"]],
  "733": [["מודל יחסי", "Relational Model"], ["SQL בסיסי", "Basic SQL"], ["נורמליזציה", "Normalization"], ["JOIN", "Joins"]],
  "164": [["Syntax בפייתון", "Python Syntax"], ["Pandas", "Pandas"], ["NumPy", "NumPy"], ["OOP", "OOP"]],
};

demoProgram.courses.forEach((course) => {
  const t = topicMap[course.id];
  if (t) course.topics = seedTopics(course.id, t);
  // seed progress
  const hash = course.number.charCodeAt(0);
  if (course.year === 1) {
    course.status = hash % 3 === 0 ? "mastered" : "completed";
    course.progress = 100;
  } else if (course.year === 2 && course.semester === "א") {
    course.status = "studying";
    course.progress = 40 + (hash % 40);
  } else if (course.year === 2) {
    course.status = hash % 4 === 0 ? "risky" : "studying";
    course.progress = 10 + (hash % 30);
  }
});

export const demoAssignments: Assignment[] = [
  { id: "a1", courseId: "167", title: "תרגיל 3 – חיפוש A*", due: "2026-07-15", status: "in_progress", weight: 10, difficulty: 4, estimatedHours: 6 },
  { id: "a2", courseId: "164", title: "מטלת Pandas – ניתוח דאטהסט", due: "2026-07-10", status: "todo", weight: 15, difficulty: 3, estimatedHours: 4 },
  { id: "a3", courseId: "166", title: "פרויקט Full Stack – שלב 2", due: "2026-07-22", status: "in_progress", weight: 25, difficulty: 5, estimatedHours: 12 },
  { id: "a4", courseId: "994b", title: "עבודת סטטיסטיקה", due: "2026-07-08", status: "todo", weight: 20, difficulty: 3, estimatedHours: 5 },
  { id: "a5", courseId: "440", title: "ניתוח שימושיות", due: "2026-07-30", status: "todo", weight: 10, difficulty: 2, estimatedHours: 3 },
];

export const demoExams: Exam[] = [
  { id: "e1", courseId: "167", moed: "א", date: "2026-07-28", weight: 60 },
  { id: "e2", courseId: "164", moed: "א", date: "2026-08-04", weight: 60 },
  { id: "e3", courseId: "162", moed: "א", date: "2026-08-11", weight: 70 },
  { id: "e4", courseId: "733", moed: "ב", date: "2026-09-01", weight: 60 },
  { id: "e5", courseId: "994b", moed: "א", date: "2026-08-15", weight: 55 },
];

export interface Flashcard {
  id: string;
  courseId: string;
  topicId?: string;
  front: string;
  back: string;
  status: "new" | "learning" | "review" | "mastered";
  dueToday?: boolean;
}

export const demoFlashcards: Flashcard[] = [
  { id: "f1", courseId: "167", front: "מהו A* Search?", back: "אלגוריתם חיפוש heuristic המשלב עלות ממשית ופונקציית ניחוש.", status: "review", dueToday: true },
  { id: "f2", courseId: "167", front: "Supervised Learning", back: "למידה מתוך דוגמאות מתויגות (label).", status: "learning", dueToday: true },
  { id: "f3", courseId: "162", front: "Big-O של הוספה ל-HashMap?", back: "O(1) בממוצע.", status: "mastered" },
  { id: "f4", courseId: "164", front: "מה עושה pandas.merge?", back: "מבצע JOIN בין שני DataFrames לפי מפתחות.", status: "new", dueToday: true },
  { id: "f5", courseId: "733", front: "3NF – הגדרה", back: "אין תלות טרנזיטיבית בין תכונות שאינן מפתח.", status: "review", dueToday: true },
  { id: "f6", courseId: "162", front: "DFS vs BFS", back: "DFS משתמש במחסנית, BFS בתור.", status: "learning" },
];

export const findCourse = (id: string) => demoProgram.courses.find((c) => c.id === id);
export const findTopic = (id: string) => {
  for (const c of demoProgram.courses) {
    const t = c.topics.find((t) => t.id === id);
    if (t) return { topic: t, course: c };
  }
  return null;
};
