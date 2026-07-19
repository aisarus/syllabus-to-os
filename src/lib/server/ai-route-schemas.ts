import { z } from "zod";
import type { AIGenerationInput } from "./ai-generation.ts";

const shortText = z.string().trim().max(500);
const longText = z.string().max(20_000);
const chunkSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    title: z.string().max(500).optional(),
    text: z.string().max(20_000),
    pageNumber: z.number().int().positive().max(100_000).optional(),
    section: z.string().max(500).optional(),
  })
  .strict();

export const aiGenerationInputSchema: z.ZodType<AIGenerationInput> = z
  .object({
    locale: z.enum(["ru", "en"]).optional(),
    targetLanguage: z.enum(["ru", "en", "he", "ar"]).optional(),
    course: z
      .object({
        id: shortText.optional(),
        title: shortText.optional(),
        number: shortText.optional(),
      })
      .strict()
      .nullable()
      .optional(),
    topic: z
      .object({ id: shortText.optional(), title: shortText.optional() })
      .strict()
      .nullable()
      .optional(),
    material: z
      .object({ id: shortText.optional(), title: shortText.optional(), type: shortText.optional() })
      .strict()
      .nullable()
      .optional(),
    chunks: z.array(chunkSchema).max(8).optional(),
    instructions: z.string().max(4_000).optional(),
    assignmentTitle: z.string().max(500).optional(),
    assignmentNotes: z.string().max(8_000).optional(),
    text: longText.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const total =
      (value.text?.length ?? 0) +
      (value.chunks ?? []).reduce((sum, chunk) => sum + chunk.text.length, 0);
    if (total > 20_000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Combined source text is too large.",
      });
    }
  });

export const conceptExtractionInputSchema = aiGenerationInputSchema.and(
  z.object({ existingConceptTitles: z.array(z.string().max(500)).max(200).optional() }).strict(),
);

export const openAnswerReviewInputSchema = aiGenerationInputSchema.and(
  z
    .object({
      concept: z
        .object({
          id: shortText.optional(),
          title: shortText.optional(),
          description: z.string().max(4_000).optional(),
        })
        .strict()
        .nullable()
        .optional(),
      kind: z.enum(["explanation", "application"]).optional(),
      prompt: z.string().max(4_000).optional(),
      response: z.string().max(12_000).optional(),
      repairContext: z
        .object({
          evidenceId: shortText.optional(),
          previousPrompt: z.string().max(4_000).optional(),
          previousResponse: z.string().max(12_000).optional(),
          previousMistakeKind: shortText.optional(),
          previousReviewSummary: z.string().max(4_000).optional(),
        })
        .strict()
        .nullable()
        .optional(),
    })
    .strict(),
);

export const ocrGenerationInputSchema = z
  .object({
    imageDataUrl: z
      .string()
      .max(12_000_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,/i, "Unsupported image payload."),
    sourceStyle: z.enum(["printed", "handwritten", "whiteboard", "mixed"]).optional(),
    locale: z.enum(["ru", "en"]).optional(),
  })
  .strict();

export const syllabusParseInputSchema = z
  .object({
    fileName: z.string().max(500).optional(),
    sheets: z
      .array(
        z
          .object({
            name: z.string().max(500),
            rows: z.array(z.array(z.string().max(4_000)).max(20)).max(400),
          })
          .strict(),
      )
      .max(40)
      .optional(),
    deterministicDraft: z.unknown().optional(),
    ignoredRows: z.unknown().optional(),
    locale: z.enum(["ru", "en"]).optional(),
  })
  .strict();
