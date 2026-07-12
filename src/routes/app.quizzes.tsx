import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Circle, Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import { RoomHeading, BrassButton, PaperButton } from "@/components/study-room-ui";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/app/quizzes")({
  component: QuizzesPage,
});

const questions = [
  {
    prompt: "Who coined the term ‘social fact’ and made it central to sociology?",
    options: ["Max Weber", "Émile Durkheim", "Karl Marx", "Georg Simmel"],
    correct: 1,
  },
  {
    prompt: "What does Verstehen refer to in social research?",
    options: ["Social control", "Interpretive understanding", "Division of labor", "Class conflict"],
    correct: 1,
  },
  {
    prompt: "Which concept describes normlessness in society?",
    options: ["Habitus", "Anomie", "Bureaucracy", "Solidarity"],
    correct: 1,
  },
];

function QuizzesPage() {
  const { t } = useApp();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const score = Object.entries(answers).filter(([question, answer]) => questions[Number(question)]?.correct === answer).length;

  return (
    <div className="room-page quiz-room">
      <RoomHeading
        eyebrow={t.practicePaperEyebrow}
        title={t.quizzes}
        subtitle={t.quizzesSubtitle}
        actions={<BrassButton><Sparkles size={14} /> {t.quizzesGenerate}</BrassButton>}
      />

      <div className="quiz-desk">
        <section className="exam-paper">
          <div className="exam-paper__clip" aria-hidden="true" />
          <header>
            <div><span>SOCIOLOGY · MIDTERM REVIEW</span><h2>Social theory and institutions</h2></div>
            <aside><small>{t.quizQuestionsLabel}</small><strong>03</strong></aside>
          </header>

          <div className="exam-paper__meta">
            <span>{t.quizNameLabel} <i>—</i></span><span>{t.quizDateLabel} <i>—</i></span>
          </div>

          <ol className="quiz-questions">
            {questions.map((question, questionIndex) => (
              <li key={question.prompt}>
                <h3><span>{questionIndex + 1}</span>{question.prompt}</h3>
                <div className="answer-grid">
                  {question.options.map((option, optionIndex) => {
                    const selected = answers[questionIndex] === optionIndex;
                    const correct = checked && question.correct === optionIndex;
                    const wrong = checked && selected && question.correct !== optionIndex;
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`${selected ? "is-selected" : ""} ${correct ? "is-correct" : ""} ${wrong ? "is-wrong" : ""}`}
                        onClick={() => !checked && setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                      >
                        {selected ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>

          <footer>
            {checked ? (
              <>
                <div className="quiz-result"><span>{t.quizResultLabel}</span><strong>{score}/{questions.length}</strong><small>{score === questions.length ? t.excellentRecall : t.reviewCorrections}</small></div>
                <PaperButton onClick={() => { setAnswers({}); setChecked(false); }}><RotateCcw size={14} /> {t.tryAgain}</PaperButton>
              </>
            ) : (
              <BrassButton onClick={() => setChecked(true)}>{t.checkAnswers} <ArrowRight size={15} /></BrassButton>
            )}
          </footer>
        </section>

        <aside className="quiz-marginalia">
          <span>{t.examNoteLabel}</span>
          <p>{t.examNoteBody}</p>
          <i>❧</i>
        </aside>
      </div>
    </div>
  );
}
