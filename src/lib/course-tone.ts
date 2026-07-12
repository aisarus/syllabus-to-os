import type { BookTone } from "@/components/study-room-ui";

const TONES: BookTone[] = ["forest", "rust", "ochre", "navy", "umber", "moss", "wine"];

export function courseTone(id: string): BookTone {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}
