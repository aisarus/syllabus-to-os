# Lamdan AI API inventory

Verified against `src/routes/api/ai/*` during production-readiness task S3-001.

## Shared boundary

All POST endpoints use `src/lib/server/ai-api-contract.ts` for runtime parsing and errors.

Error responses keep the existing `ok: false` and `error` fields and add a stable `code`:

- `INVALID_JSON`
- `INVALID_FORM_DATA`
- `INVALID_INPUT`
- `PAYLOAD_TOO_LARGE`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_ERROR`
- `INVALID_PROVIDER_RESPONSE`
- `INTERNAL_ERROR`

Validation details contain only schema paths and issue codes. Provider details, stack traces, secrets and raw source content are not returned.

## Endpoint inventory

| Route | Method | Runtime input contract | Provider boundary | Success contract |
| --- | --- | --- | --- | --- |
| `/api/ai/status` | GET | none | Gemini configuration status | existing status object |
| `/api/ai/transcription-status` | GET | none | configured transcription provider status | existing status object |
| `/api/ai/generate-note` | POST JSON | `aiGenerationInputSchema` | `runAIGeneration("note")` | unchanged draft result |
| `/api/ai/generate-flashcards` | POST JSON | `aiGenerationInputSchema` | `runAIGeneration("flashcards")` | unchanged draft result |
| `/api/ai/generate-quiz` | POST JSON | `aiGenerationInputSchema` | `runGoldenQuizGeneration` | unchanged draft result |
| `/api/ai/generate-presentation-outline` | POST JSON | `aiGenerationInputSchema` | `runAIGeneration("presentation")` | unchanged draft result |
| `/api/ai/generate-study-pack` | POST JSON | `aiGenerationInputSchema` | `runStudyPackGeneration` | unchanged draft result |
| `/api/ai/generate-assignment-breakdown` | POST JSON | `aiGenerationInputSchema` | `runAIGeneration("assignment")` | unchanged draft result |
| `/api/ai/generate-topic-explanation` | POST JSON | `aiGenerationInputSchema` | `runAIGeneration("topic")` | unchanged draft result |
| `/api/ai/simplify-text` | POST JSON | `aiGenerationInputSchema` | `runAIGeneration("simplify")` | unchanged draft result |
| `/api/ai/translate-text` | POST JSON | `aiGenerationInputSchema` | `runAIGeneration("translate")` | unchanged draft result |
| `/api/ai/extract-concepts` | POST JSON | `conceptExtractionInputSchema` | `runConceptExtractionGeneration` | unchanged reviewable draft result |
| `/api/ai/review-open-answer` | POST JSON | `openAnswerReviewInputSchema` | `runOpenAnswerReviewGeneration` | unchanged advisory draft result |
| `/api/ai/ocr-image` | POST JSON | `ocrGenerationInputSchema` | `runOCRGeneration` | unchanged OCR review draft result |
| `/api/ai/parse-syllabus` | POST JSON | `syllabusParseInputSchema` | `generateGeminiJSON` | unchanged reviewed syllabus draft result |
| `/api/ai/transcribe-long-media` | POST multipart | shared form parser + `transcriptionMetadataSchema` + file validation | `transcribeWithConfiguredProvider` | unchanged transcription candidate result |

## Limits in this slice

- ordinary JSON bodies: 2,000,000 bytes;
- OCR JSON bodies: 12,500,000 bytes;
- transcription multipart requests: 26,000,000 declared bytes;
- shared source generation: at most 8 chunks and 20,000 combined text characters;
- OCR image data URL: at most 12,000,000 characters;
- syllabus: at most 40 sheets, 400 rows per sheet and 20 cells per row.

Request IDs, timeout/retry policy, concurrency/rate/cost controls, idempotency and cancellation propagation belong to S3-002/S3-003 and are intentionally excluded here.
