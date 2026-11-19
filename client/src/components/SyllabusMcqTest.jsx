import { useEffect, useMemo, useRef, useState } from 'react';
import { getMcqTestResult } from '../lib/mcqTest';
import Icon from './Icon';

function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const SECONDS_PER_QUESTION = 48;

export default function SyllabusMcqTest({ chapterName, title, questions, startedAt, now, onCancel, onFinish }) {
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const question = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const elapsedSeconds = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const durationSeconds = questions.length * SECONDS_PER_QUESTION;
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
  const completedRef = useRef(false);
  const optionTexts = useMemo(() => ({
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  }), [question]);

  function finishTest(autoSubmit = false) {
    if (completedRef.current) return;
    if (!autoSubmit && !window.confirm(`Submit this test with ${answeredCount} selected and ${questions.length - answeredCount} blank? Blank questions lose 1/3 mark each.`)) return;
    completedRef.current = true;
    onFinish(getMcqTestResult(questions, answers, Math.min(elapsedSeconds, durationSeconds)), answers);
  }

  useEffect(() => {
    if (remainingSeconds === 0) finishTest(true);
  }, [remainingSeconds]);

  return (
    <main className="syllabus-test-page">
      <header className="syllabus-test-header">
        <button type="button" className="notes-back-button" onClick={onCancel}>← <span>Exit test</span></button>
        <div className="syllabus-test-title">
          <p className="eyebrow">BPSC · {chapterName}</p>
          <h1>{title}</h1>
        </div>
        <div className="syllabus-test-clock" aria-label="Time remaining">
          <span>OVERALL TEST TIME LEFT · {formatElapsed(Math.floor(durationSeconds / 60))} TOTAL</span>
          <strong>{formatElapsed(remainingSeconds)}</strong>
        </div>
      </header>

      <div className="syllabus-test-layout">
        <section className="syllabus-test-question-panel">
          <header className="syllabus-test-paper-header">
            <div>
              <span className="syllabus-test-paper-label">QUESTION PAPER</span>
              <strong>Single correct answer</strong>
            </div>
            <div className="syllabus-test-progress">
              <span>Question <strong>{currentIndex + 1}</strong> of {questions.length}</span>
              <span>{answeredCount} marked</span>
            </div>
          </header>
          <div className="syllabus-test-progress-track">
            <span style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
          </div>
          <div className="syllabus-test-question-content">
            <div className="syllabus-test-question-number-label">Question {String(currentIndex + 1).padStart(2, '0')}</div>
            <h2>{question.question}</h2>
            <div className="syllabus-test-options">
              {OPTION_KEYS.map((key) => (
                <button
                  type="button"
                  key={key}
                  className={`syllabus-test-option ${answers[currentIndex] === key ? 'selected' : ''}`}
                  aria-pressed={answers[currentIndex] === key}
                  onClick={() => setAnswers((current) => ({ ...current, [currentIndex]: key }))}
                >
                  <span>{key}</span>
                  <strong>{optionTexts[key]}</strong>
                </button>
              ))}
              <button
                type="button"
                className={`syllabus-test-option ${answers[currentIndex] === 'E' ? 'selected' : ''}`}
                aria-pressed={answers[currentIndex] === 'E'}
                onClick={() => setAnswers((current) => ({ ...current, [currentIndex]: 'E' }))}
              >
                <span>E</span><strong>Not attempted (no penalty)</strong>
              </button>
            </div>
          </div>
          <footer className="syllabus-test-navigation">
            <button type="button" className="outline-btn" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}>
              Previous
            </button>
            {answers[currentIndex] && (
              <button type="button" className="outline-btn" onClick={() => setAnswers((current) => {
                const next = { ...current };
                delete next[currentIndex];
                return next;
              })}>
                Clear answer
              </button>
            )}
            {currentIndex < questions.length - 1 ? (
              <button type="button" className="primary-btn" onClick={() => setCurrentIndex((index) => index + 1)}>
                Save &amp; next
              </button>
            ) : (
              <button type="button" className="primary-btn" onClick={finishTest}>Submit test</button>
            )}
          </footer>
        </section>

        <aside className="syllabus-test-sidebar">
          <div className="syllabus-test-sidebar-heading">
            <div>
              <p className="eyebrow">Test overview</p>
              <h2>Question navigator</h2>
            </div>
            <span>{answeredCount}/{questions.length}</span>
          </div>
          <div className="syllabus-test-question-grid">
            {questions.map((_, index) => (
              <button
                type="button"
                key={index}
                className={[
                  'syllabus-test-question-number',
                  index === currentIndex ? 'current' : '',
              answers[index] && answers[index] !== 'E' ? 'answered' : '',
              answers[index] === 'E' ? 'not-attempted' : '',
                ].filter(Boolean).join(' ')}
                aria-label={`Go to question ${index + 1}${answers[index] === 'E' ? ', not attempted' : answers[index] ? ', answered' : ', blank'}`}
                onClick={() => setCurrentIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <div className="syllabus-test-legend">
            <span><i className="answered" /> Answered</span>
            <span><i className="not-attempted" /> Not attempted</span>
            <span><i /> Blank · −⅓ mark</span>
          </div>
          <button type="button" className="syllabus-test-submit" onClick={finishTest}>Submit test</button>
        </aside>
      </div>
    </main>
  );
}

export function SyllabusMcqReview({ title, questions, answers, result, onClose }) {
  const hasRecordedAnswers = answers !== null && answers !== undefined;
  const score = Number(result.score.toFixed(2));
  return (
    <main className="syllabus-review-page">
      <header className="syllabus-review-header">
        <div><p className="eyebrow">TESTBOOK STYLE REVIEW</p><h1>{title}</h1><span>Review your responses and the correct answers</span></div>
        <button type="button" className="primary-btn" onClick={onClose}><Icon name="close" size={17} /> Back to tests</button>
      </header>
      <section className="syllabus-review-summary">
        <div><span>Score</span><strong>{score} / {questions.length}</strong></div>
        <div><span>Correct</span><strong>{result.correct}</strong></div>
        <div><span>Wrong</span><strong>{result.wrong} <small>(−{(result.wrong / 3).toFixed(2)} marks)</small></strong></div>
        <div><span>Not attempted</span><strong>{result.notAttempted}</strong></div>
        <div><span>Blank</span><strong>{result.unanswered}</strong></div>
        <div><span>Time used</span><strong>{formatElapsed(result.elapsedSeconds)}</strong></div>
      </section>
      {!hasRecordedAnswers && <p className="syllabus-review-notice">This test was submitted before individual answers were saved. The answer key and overall score are available, but the selected answers for this attempt cannot be shown.</p>}
      <div className="syllabus-review-questions">
        {questions.map((question, index) => {
          const selected = answers?.[index];
          const isCorrect = selected === question.correctAnswer;
          return (
            <article className="syllabus-review-question" key={question.id || index}>
              <div className="syllabus-review-question-heading">
                <span>Question {String(index + 1).padStart(2, '0')}</span>
                <strong className={`syllabus-review-status ${!hasRecordedAnswers ? 'unavailable' : selected === 'E' ? 'skipped' : !selected ? 'blank' : isCorrect ? 'correct' : 'wrong'}`}>
                  {!hasRecordedAnswers ? 'Answer history unavailable' : selected === 'E' ? 'Not attempted' : !selected ? 'Blank · −⅓ mark' : isCorrect ? 'Correct · +1 mark' : 'Incorrect · −⅓ mark'}
                </strong>
              </div>
              <h2>{question.question}</h2>
              <div className="syllabus-review-options">
                {OPTION_KEYS.map((key) => {
                  const correctOption = key === question.correctAnswer;
                  const selectedOption = selected === key;
                  const optionClass = correctOption ? 'review-answer-correct' : selectedOption ? 'review-answer-wrong' : '';
                  return (
                    <div className={`syllabus-review-option ${optionClass}`} key={key}>
                      <span className="syllabus-review-option-key">{key}</span>
                      <strong>{question[`option${key}`]}</strong>
                      {correctOption && <span className="syllabus-review-option-label">Correct answer</span>}
                      {selectedOption && !correctOption && <span className="syllabus-review-option-label">Your answer</span>}
                    </div>
                  );
                })}
              </div>
              {!hasRecordedAnswers && <p className="syllabus-review-history">Your answer: not recorded for this attempt.</p>}
              {question.explanation && <p className="syllabus-review-explanation">{question.explanation}</p>}
            </article>
          );
        })}
      </div>
    </main>
  );
}
