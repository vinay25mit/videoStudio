import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuestionImport } from '../src/lib/questionImport.js';

const sampleQuestion = {
  question: 'Which planet is known as the Red Planet?',
  options: { A: 'Earth', B: 'Mars', C: 'Venus', D: 'Jupiter' },
  correctAnswer: 'b',
  explanation: 'Mars appears red.',
  hindiExplanation: 'मंगल ग्रह की सतह पर आयरन ऑक्साइड है।',
  hinglishExplanation: 'Mars red dikhta hai kyunki uski surface par iron oxide hota hai.',
};

test('normalizes a question array and option objects', () => {
  const questions = normalizeQuestionImport([sampleQuestion]);

  assert.equal(questions.length, 1);
  assert.equal(questions[0].optionB, 'Mars');
  assert.equal(questions[0].correctAnswer, 'B');
  assert.equal(questions[0].hindiExplanation, 'मंगल ग्रह की सतह पर आयरन ऑक्साइड है।');
  assert.equal(questions[0].hinglishExplanation, 'Mars red dikhta hai kyunki uski surface par iron oxide hota hai.');
});

test('loads every question from a wrapped keyed object', () => {
  const questions = normalizeQuestionImport({
    title: 'Planets',
    questions: { first: sampleQuestion, second: { ...sampleQuestion, question: 'Another question?' } },
  });

  assert.equal(questions.length, 2);
});

test('accepts the syllabus MCQ JSON format with a title and questions array', () => {
  const questions = normalizeQuestionImport({
    title: 'Current Affairs Practice',
    questions: [{
      question: 'Where was the programme inaugurated?',
      options: { A: 'Kolkata', B: 'Mumbai', C: 'Bengaluru', D: 'New Delhi' },
      correctAnswer: 'D',
      explanation: 'It was inaugurated in New Delhi.',
      hindiExplanation: 'इसका उद्घाटन नई दिल्ली में हुआ।',
      hinglishExplanation: 'Iska inauguration New Delhi mein hua.',
    }],
  });

  assert.equal(questions.length, 1);
  assert.equal(questions[0].optionD, 'New Delhi');
  assert.equal(questions[0].correctAnswer, 'D');
  assert.equal(questions[0].explanation, 'It was inaugurated in New Delhi.');
  assert.equal(questions[0].hindiExplanation, 'इसका उद्घाटन नई दिल्ली में हुआ।');
  assert.equal(questions[0].hinglishExplanation, 'Iska inauguration New Delhi mein hua.');
});

test('normalizes Unicode dashes and punctuation before rendering', () => {
  const questions = normalizeQuestionImport([
    {
      question: 'Which sequence is correct? 1–2–3–4',
      options: { A: 'A–B', B: 'C–D', C: 'E–F', D: 'G–H' },
      correctAnswer: 'a',
      explanation: 'The answer is 1–3.',
    },
  ]);

  assert.equal(questions[0].question, 'Which sequence is correct? 1-2-3-4');
  assert.equal(questions[0].optionA, 'A-B');
  assert.equal(questions[0].optionB, 'C-D');
  assert.equal(questions[0].explanation, 'The answer is 1-3.');
  assert.equal(questions[0].correctAnswer, 'A');
});

test('rejects malformed question objects instead of silently dropping them', () => {
  assert.throws(() => normalizeQuestionImport([{ question: 'Incomplete?' }]), /Question 1 needs/);
});