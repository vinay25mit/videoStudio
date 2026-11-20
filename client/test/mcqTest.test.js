import test from 'node:test';
import assert from 'node:assert/strict';
import { getMcqTestResult } from '../src/lib/mcqTest.js';

test('grades correct, incorrect, and unanswered questions with elapsed seconds', () => {
  const questions = [
    { correctAnswer: 'D' },
    { correctAnswer: 'D' },
    { correctAnswer: 'B' },
    { correctAnswer: 'A' },
  ];

  assert.deepEqual(getMcqTestResult(questions, { 0: 'D', 1: 'A', 2: 'B' }, 65.8), {
    correct: 2,
    wrong: 1,
    unanswered: 1,
    elapsedSeconds: 65,
  });
});
