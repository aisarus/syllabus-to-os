// AI provider abstraction.
// There is NO real AI backend connected. Every generator returns a clear
// "not connected" result. Wiring a real provider is done in a future phase
// via a server endpoint — never by embedding secret API keys in the browser.

import type { Material } from "./store";

export type AIResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_connected" | "error"; message: string };

const NOT_CONNECTED_EN =
  "AI generation is not connected yet. Use the manual tools available on this screen.";
const NOT_CONNECTED_RU =
  "AI-генерация ещё не подключена. Используйте ручные инструменты на этом экране.";

export function notConnectedMessage(lang: "ru" | "en" = "ru") {
  return lang === "ru" ? NOT_CONNECTED_RU : NOT_CONNECTED_EN;
}

export function isAIConnected(): boolean {
  return false;
}

function notConnected<T>(): AIResult<T> {
  return { ok: false, reason: "not_connected", message: NOT_CONNECTED_EN };
}

export async function generateNoteFromMaterial(_material: Material): Promise<AIResult<{ title: string; content: string }>> {
  return notConnected();
}

export async function generateQuizFromMaterial(_material: Material): Promise<
  AIResult<{ title: string; questions: { prompt: string; options: string[]; correctIndex: number; explanation?: string }[] }>
> {
  return notConnected();
}

export async function generateFlashcardsFromMaterial(
  _material: Material,
): Promise<AIResult<{ front: string; back: string }[]>> {
  return notConnected();
}

export async function generatePresentationOutline(
  _material: Material,
): Promise<AIResult<{ title: string; slides: { title: string; bullets: string[] }[] }>> {
  return notConnected();
}

export async function simplifyText(_text: string, _targetLanguage: string): Promise<AIResult<string>> {
  return notConnected();
}

export async function translateText(_text: string, _targetLanguage: string): Promise<AIResult<string>> {
  return notConnected();
}
