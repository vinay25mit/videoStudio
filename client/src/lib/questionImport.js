function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeQuestionImport(payload) {
  const questionData = payload?.questions ?? payload;
  const records = Array.isArray(questionData)
    ? questionData
    : questionData && typeof questionData === 'object'
      ? questionData.question
        ? [questionData]
        : Object.values(questionData)
      : [];

  if (!records.length || records.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw new Error('JSON must contain a question array or an object of question objects.');
  }

  return records.map((record, index) => {
    const options = record.options || {};
    const optionList = Array.isArray(options) ? options : [];
    const normalized = {
      question: normalizeText(record.question ?? record.questionText ?? record.text ?? ''),
      optionA: normalizeText(record.optionA ?? options.A ?? options.a ?? optionList[0] ?? ''),
      optionB: normalizeText(record.optionB ?? options.B ?? options.b ?? optionList[1] ?? ''),
      optionC: normalizeText(record.optionC ?? options.C ?? options.c ?? optionList[2] ?? ''),
      optionD: normalizeText(record.optionD ?? options.D ?? options.d ?? optionList[3] ?? ''),
      correctAnswer: normalizeText(record.correctAnswer ?? record.correct_answer ?? record.answer ?? '').toUpperCase(),
      explanation: normalizeText(record.explanation ?? ''),
      hindiExplanation: normalizeText(record.hindiExplanation ?? ''),
      hinglishExplanation: normalizeText(record.hinglishExplanation ?? ''),
    };

    if (!normalized.question || !normalized.optionA || !normalized.optionB || !normalized.optionC || !normalized.optionD || !/^[ABCD]$/.test(normalized.correctAnswer)) {
      throw new Error(`Question ${index + 1} needs a question, four options, and a correct answer from A to D.`);
    }

    return normalized;
  });
}