export function getMcqTestResult(questions, answers, elapsedSeconds) {
  let correct = 0;
  let wrong = 0;
  let notAttempted = 0;
  questions.forEach((question, index) => {
    if (answers[index] === 'E') {
      notAttempted += 1;
      return;
    }
    if (!answers[index]) return;
    if (answers[index] === question.correctAnswer) correct += 1;
    else wrong += 1;
  });
  return {
    correct,
    wrong,
    notAttempted,
    unanswered: questions.length - correct - wrong - notAttempted,
    score: correct - (wrong + questions.length - correct - wrong - notAttempted) / 3,
    elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
  };
}
