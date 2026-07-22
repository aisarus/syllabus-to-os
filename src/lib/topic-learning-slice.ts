export interface TopicRecallInput {
  title: string;
  aliases?: string[];
  explanation: string;
  response: string;
}

export interface TopicRecallResult {
  passed: boolean;
  score: number;
  matchedTerms: string[];
  exactMatches: string[];
  normalizedMatches: string[];
  missingTerms: string[];
  explanation: string;
}

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "that", "this", "from", "into", "are", "was", "were",
  "или", "это", "как", "что", "для", "при", "его", "ее", "они", "она", "оно", "между",
  "של", "את", "על", "עם", "הוא", "היא", "זה", "בין",
]);

export function normalizeRecallText(value: string): string[] {
  return value
    .normalize("NFKC")
    .replace(/[\u0591-\u05c7]/gu, "")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function buildRecallTerms(input: Omit<TopicRecallInput, "response">): string[] {
  const titleTerms = normalizeRecallText([input.title, ...(input.aliases ?? [])].join(" "));
  const explanationTerms = normalizeRecallText(input.explanation);
  const ordered = [...titleTerms, ...explanationTerms];
  return Array.from(new Set(ordered)).slice(0, 8);
}

export function buildTopicRecallAttemptKey(conceptId: string, response: string): string {
  const normalized = normalizeRecallText(response).join(" ");
  let hash = 2166136261;
  for (const character of `${conceptId}\u0000${normalized}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `topic-recall:${conceptId}:${(hash >>> 0).toString(36)}`;
}

function recallMatchKeys(token: string): string[] {
  const keys = new Set([token]);

  const english = token.match(/^[a-z]+$/) ? token : "";
  if (english.length >= 5) {
    if (english.endsWith("ies") && english.length > 5) keys.add(`${english.slice(0, -3)}y`);
    for (const suffix of ["ing", "ed", "es", "s"]) {
      if (english.endsWith(suffix) && english.length - suffix.length >= 4) {
        keys.add(english.slice(0, -suffix.length));
      }
    }
  }

  const russian = token.match(/^[а-яё]+$/u) ? token : "";
  if (russian.length >= 5) {
    for (const suffix of [
      "иями", "ями", "ами", "ого", "ему", "ому", "ыми", "ими", "ий", "ый", "ой",
      "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю", "ам", "ям", "ах", "ях",
      "ов", "ев", "ом", "ем", "ы", "и", "а", "я", "у", "ю", "е",
    ]) {
      if (russian.endsWith(suffix) && russian.length - suffix.length >= 4) {
        keys.add(russian.slice(0, -suffix.length));
        break;
      }
    }
  }

  const hebrew = token.match(/^[א-ת]+$/u) ? token : "";
  if (hebrew.length >= 4) {
    const withoutPrefix = /^[בכלמוהש]/u.test(hebrew) && hebrew.length >= 5 ? hebrew.slice(1) : hebrew;
    if (withoutPrefix.length >= 4) keys.add(withoutPrefix);
    for (const candidate of [hebrew, withoutPrefix]) {
      for (const suffix of ["ים", "ות"]) {
        if (candidate.endsWith(suffix) && candidate.length - suffix.length >= 3) {
          keys.add(candidate.slice(0, -suffix.length));
        }
      }
    }
  }

  return [...keys];
}

export function evaluateTopicRecall(input: TopicRecallInput): TopicRecallResult {
  const expected = buildRecallTerms(input);
  const responseTerms = normalizeRecallText(input.response);
  const responseTermSet = new Set(responseTerms);
  const responseKeys = new Set(responseTerms.flatMap(recallMatchKeys));
  const exactMatches = expected.filter((term) => responseTermSet.has(term));
  const exactSet = new Set(exactMatches);
  const normalizedMatches = expected.filter(
    (term) => !exactSet.has(term) && recallMatchKeys(term).some((key) => responseKeys.has(key)),
  );
  const matchedTerms = [...exactMatches, ...normalizedMatches];
  const matchedSet = new Set(matchedTerms);
  const missingTerms = expected.filter((term) => !matchedSet.has(term));
  const score = expected.length === 0 ? 0 : Math.round((matchedTerms.length / expected.length) * 100);
  const passed = expected.length >= 2 && matchedTerms.length >= 2 && score >= 50;
  const matchBreakdown = `Точно: ${exactMatches.length}; по словоформе: ${normalizedMatches.length}.`;

  return {
    passed,
    score,
    matchedTerms,
    exactMatches,
    normalizedMatches,
    missingTerms,
    explanation: passed
      ? `Ответ подтверждён: найдено ${matchedTerms.length} из ${expected.length} ключевых терминов. ${matchBreakdown}`
      : `Ответ пока не подтверждён: найдено ${matchedTerms.length} из ${expected.length} ключевых терминов. ${matchBreakdown} Добавь пропущенные идеи своими словами.`,
  };
}
