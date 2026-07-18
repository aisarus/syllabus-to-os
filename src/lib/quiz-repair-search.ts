export function parseQuizRepairQuestionIds(value: unknown): string[] {
  const tokens = Array.isArray(value)
    ? value.flatMap((item) => (typeof item === "string" ? item.split(",") : []))
    : typeof value === "string"
      ? value.split(",")
      : [];
  return Array.from(
    new Set(
      tokens.map((token) => token.trim()).filter((token) => /^[A-Za-z0-9_-]{1,120}$/.test(token)),
    ),
  ).slice(0, 100);
}

export function serializeQuizRepairQuestionIds(questionIds: string[]): string {
  return parseQuizRepairQuestionIds(questionIds).join(",");
}
