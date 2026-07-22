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

export function evaluateTopicRecall(input: TopicRecallInput): TopicRecallResult {
  const expected = buildRecallTerms(input);
  const responseTerms = new Set(normalizeRecallText(input.response));
  const matchedTerms = expected.filter((term) => responseTerms.has(term));
  const missingTerms = expected.filter((term) => !responseTerms.has(term));
  const score = expected.length === 0 ? 0 : Math.round((matchedTerms.length / expected.length) * 100);
  const passed = expected.length >= 2 && matchedTerms.length >= 2 && score >= 50;

  return {
    passed,
    score,
    matchedTerms,
    missingTerms,
    explanation: passed
      ? `Ответ подтверждён: найдено ${matchedTerms.length} из ${expected.length} ключевых терминов.`
      : `Ответ пока не подтверждён: найдено ${matchedTerms.length} из ${expected.length} ключевых терминов. Добавь пропущенные идеи своими словами.`,
  };
}
