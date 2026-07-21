import type { ReactNode } from "react";
import { Clock3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudyPackActivity, StudyPackDraft } from "@/lib/ai";

export function StudyPackEditor({
  draft,
  onChange,
  isRu,
  failures,
}: {
  draft: StudyPackDraft;
  onChange: (draft: StudyPackDraft) => void;
  isRu: boolean;
  failures: string[];
}) {
  const update = (patch: Partial<StudyPackDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-5">
      {failures.length > 0 && (
        <p className="rounded border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-200">
          {isRu
            ? "Перед сохранением заполни пустые поля и проверь, что каждый вопрос имеет четыре уникальных варианта."
            : "Before saving, fill empty fields and make sure every question has four unique options."}
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <Label htmlFor="study-pack-title">{isRu ? "Название комплекта" : "Pack title"}</Label>
          <Input
            id="study-pack-title"
            className="mt-1"
            dir="auto"
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="study-pack-orientation">
            {isRu ? "Ориентация" : "Orientation"}
          </Label>
          <Textarea
            id="study-pack-orientation"
            className="mt-1 min-h-28"
            dir="auto"
            value={draft.orientation}
            onChange={(event) => update({ orientation: event.target.value })}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          <Label htmlFor="study-pack-estimated-minutes" className="sr-only">
            {isRu ? "Длительность учебного маршрута в минутах" : "Study route duration in minutes"}
          </Label>
          <Input
            id="study-pack-estimated-minutes"
            type="number"
            min={10}
            max={120}
            className="h-8 w-24"
            aria-describedby="study-pack-estimated-minutes-help"
            value={draft.estimatedMinutes}
            onChange={(event) =>
              update({ estimatedMinutes: Math.max(10, Number(event.target.value) || 10) })
            }
          />
          <span id="study-pack-estimated-minutes-help">
            {isRu ? "минут на весь маршрут" : "minutes for the full route"}
          </span>
        </div>
      </section>

      <EditableSection title={isRu ? "Маршрут занятия" : "Study route"} count={draft.steps.length}>
        {draft.steps.map((step, index) => (
          <div
            key={`${step.title}_${index}`}
            className="rounded-md border border-border bg-background p-3"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_82px_auto]">
              <Input
                value={step.title}
                onChange={(event) =>
                  update({
                    steps: draft.steps.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, title: event.target.value } : item,
                    ),
                  })
                }
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={step.activity}
                onChange={(event) =>
                  update({
                    steps: draft.steps.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, activity: event.target.value as StudyPackActivity }
                        : item,
                    ),
                  })
                }
              >
                {(["orient", "learn", "recall", "practice", "repair"] as const).map((activity) => (
                  <option key={activity} value={activity}>
                    {activity}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                max={45}
                value={step.durationMinutes}
                onChange={(event) =>
                  update({
                    steps: draft.steps.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, durationMinutes: Number(event.target.value) || 1 }
                        : item,
                    ),
                  })
                }
              />
              <RemoveButton
                label={isRu ? "Удалить шаг" : "Remove step"}
                onClick={() =>
                  update({ steps: draft.steps.filter((_, itemIndex) => itemIndex !== index) })
                }
              />
            </div>
            <Textarea
              className="mt-2 min-h-20"
              value={step.purpose}
              onChange={(event) =>
                update({
                  steps: draft.steps.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, purpose: event.target.value } : item,
                  ),
                })
              }
            />
          </div>
        ))}
      </EditableSection>

      <EditableSection title={isRu ? "Чистовой конспект" : "Clean study note"} count={1}>
        <Input
          value={draft.note.title}
          onChange={(event) => update({ note: { ...draft.note, title: event.target.value } })}
        />
        <Textarea
          dir="auto"
          className="mt-2 min-h-64"
          value={draft.note.content}
          onChange={(event) => update({ note: { ...draft.note, content: event.target.value } })}
        />
      </EditableSection>

      <EditableSection
        title={isRu ? "Ключевые термины" : "Key terms"}
        count={draft.keyTerms.length}
      >
        {draft.keyTerms.map((term, index) => (
          <div key={`${term.term}_${index}`} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <Input
              dir="auto"
              value={term.term}
              onChange={(event) =>
                update({
                  keyTerms: draft.keyTerms.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, term: event.target.value } : item,
                  ),
                })
              }
            />
            <Input
              dir="auto"
              value={term.explanation}
              onChange={(event) =>
                update({
                  keyTerms: draft.keyTerms.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, explanation: event.target.value } : item,
                  ),
                })
              }
            />
            <RemoveButton
              label={isRu ? "Удалить термин" : "Remove term"}
              onClick={() =>
                update({ keyTerms: draft.keyTerms.filter((_, itemIndex) => itemIndex !== index) })
              }
            />
          </div>
        ))}
      </EditableSection>

      <EditableSection title={isRu ? "Карточки" : "Flashcards"} count={draft.cards.length}>
        {draft.cards.map((card, index) => (
          <div
            key={`${card.front}_${index}`}
            className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2"
          >
            <Textarea
              dir="auto"
              className="min-h-24"
              value={card.front}
              onChange={(event) =>
                update({
                  cards: draft.cards.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, front: event.target.value } : item,
                  ),
                })
              }
            />
            <div className="flex gap-2">
              <Textarea
                dir="auto"
                className="min-h-24 flex-1"
                value={card.back}
                onChange={(event) =>
                  update({
                    cards: draft.cards.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, back: event.target.value } : item,
                    ),
                  })
                }
              />
              <RemoveButton
                label={isRu ? "Удалить карточку" : "Remove card"}
                onClick={() =>
                  update({ cards: draft.cards.filter((_, itemIndex) => itemIndex !== index) })
                }
              />
            </div>
          </div>
        ))}
      </EditableSection>

      <EditableSection
        title={isRu ? "Диагностические вопросы" : "Diagnostic questions"}
        count={draft.questions.length}
      >
        {draft.questions.map((question, index) => (
          <div
            key={`${question.prompt}_${index}`}
            className="rounded-md border border-border bg-background p-3"
          >
            <div className="flex gap-2">
              <Textarea
                dir="auto"
                className="min-h-20 flex-1"
                value={question.prompt}
                onChange={(event) =>
                  update({
                    questions: draft.questions.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, prompt: event.target.value } : item,
                    ),
                  })
                }
              />
              <RemoveButton
                label={isRu ? "Удалить вопрос" : "Remove question"}
                onClick={() =>
                  update({
                    questions: draft.questions.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`study-pack-question-${index}`}
                    checked={question.correctIndex === optionIndex}
                    onChange={() =>
                      update({
                        questions: draft.questions.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, correctIndex: optionIndex } : item,
                        ),
                      })
                    }
                  />
                  <Input
                    dir="auto"
                    value={option}
                    onChange={(event) =>
                      update({
                        questions: draft.questions.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                options: item.options.map((current, currentIndex) =>
                                  currentIndex === optionIndex ? event.target.value : current,
                                ),
                              }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <Textarea
              dir="auto"
              className="mt-2 min-h-20"
              value={question.explanation}
              onChange={(event) =>
                update({
                  questions: draft.questions.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, explanation: event.target.value } : item,
                  ),
                })
              }
              placeholder={isRu ? "Объяснение ответа" : "Answer explanation"}
            />
          </div>
        ))}
      </EditableSection>

      {draft.unclearAreas.length > 0 && (
        <EditableSection
          title={isRu ? "Что требует проверки" : "What needs review"}
          count={draft.unclearAreas.length}
        >
          {draft.unclearAreas.map((area, index) => (
            <div key={`${area.description}_${index}`} className="flex gap-2">
              <Textarea
                dir="auto"
                className="min-h-20 flex-1"
                value={area.description}
                onChange={(event) =>
                  update({
                    unclearAreas: draft.unclearAreas.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, description: event.target.value } : item,
                    ),
                  })
                }
              />
              <RemoveButton
                label={isRu ? "Удалить пункт" : "Remove item"}
                onClick={() =>
                  update({
                    unclearAreas: draft.unclearAreas.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              />
            </div>
          ))}
        </EditableSection>
      )}
    </div>
  );
}

function EditableSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
