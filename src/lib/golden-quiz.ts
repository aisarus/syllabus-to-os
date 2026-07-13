export const GOLDEN_QUIZ_MARKER = "[[LAM_DAN_GOLDEN_QUIZ_V1]]";

export interface GoldenQuizFeedback {
  correctExplanation: string;
  memoryHint: string;
  optionRationales: string[];
  promptTranslation?: string;
  optionTranslations?: string[];
}

export function formatGoldenQuizFeedback(
  feedback: GoldenQuizFeedback,
  locale: "ru" | "en" = "ru",
): string {
  const headings =
    locale === "ru"
      ? {
          correct: "Правильный ответ",
          hint: "Как запомнить",
          rationales: "Разбор вариантов",
          promptTranslation: "Перевод вопроса",
          optionTranslations: "Переводы вариантов",
        }
      : {
          correct: "Correct explanation",
          hint: "Memory hint",
          rationales: "Option rationales",
          promptTranslation: "Prompt translation",
          optionTranslations: "Option translations",
        };
  const sections = [
    GOLDEN_QUIZ_MARKER,
    `### ${headings.correct}\n${feedback.correctExplanation.trim()}`,
    `### ${headings.hint}\n${feedback.memoryHint.trim()}`,
    `### ${headings.rationales}\n${formatNumbered(feedback.optionRationales)}`,
  ];
  if (feedback.promptTranslation?.trim()) {
    sections.push(`### ${headings.promptTranslation}\n${feedback.promptTranslation.trim()}`);
  }
  if (feedback.optionTranslations?.some((value) => value.trim())) {
    sections.push(
      `### ${headings.optionTranslations}\n${formatNumbered(feedback.optionTranslations)}`,
    );
  }
  return sections.join("\n\n").trim();
}

export function parseGoldenQuizFeedback(
  explanation: string | undefined,
  optionCount: number,
): GoldenQuizFeedback {
  const value = explanation?.trim() ?? "";
  if (!value.includes(GOLDEN_QUIZ_MARKER)) {
    return {
      correctExplanation: value,
      memoryHint: "",
      optionRationales: Array.from({ length: optionCount }, () => ""),
    };
  }

  const correctExplanation = readSection(value, ["Правильный ответ", "Correct explanation"]);
  const memoryHint = readSection(value, ["Как запомнить", "Memory hint"]);
  const optionRationales = readNumberedSection(
    value,
    ["Разбор вариантов", "Option rationales"],
    optionCount,
  );
  const promptTranslation = readSection(value, ["Перевод вопроса", "Prompt translation"]);
  const optionTranslations = readNumberedSection(
    value,
    ["Переводы вариантов", "Option translations"],
    optionCount,
  );

  return {
    correctExplanation,
    memoryHint,
    optionRationales,
    promptTranslation: promptTranslation || undefined,
    optionTranslations: optionTranslations.some(Boolean) ? optionTranslations : undefined,
  };
}

export function hasQuizTranslation(feedback: GoldenQuizFeedback): boolean {
  return Boolean(
    feedback.promptTranslation?.trim() ||
    feedback.optionTranslations?.some((translation) => translation.trim()),
  );
}

function readSection(value: string, headings: string[]): string {
  for (const heading of headings) {
    const escaped = escapeRegExp(heading);
    const match = value.match(
      new RegExp(`###\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n\\n###\\s+|$)`, "i"),
    );
    if (match) return match[1].trim();
  }
  return "";
}

function readNumberedSection(value: string, headings: string[], count: number): string[] {
  const section = readSection(value, headings);
  const result = Array.from({ length: count }, () => "");
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\.\s*(.*)$/);
    if (!match) continue;
    const index = Number(match[1]) - 1;
    if (index >= 0 && index < result.length) result[index] = match[2].trim();
  }
  return result;
}

function formatNumbered(values: string[]): string {
  return values.map((value, index) => `${index + 1}. ${normalizeLine(value)}`).join("\n");
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
