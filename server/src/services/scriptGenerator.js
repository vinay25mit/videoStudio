import { createPhraseSchedule, QUESTION_INTRO_PHRASES, SOLUTION_INTRO_PHRASES, shufflePhrases } from './narrationPhrases.js';

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

export function toSpeechText(value) {
  const text = normalizeText(value);
  const equationPattern = /([A-Za-z][A-Za-z0-9]*(?:\^\d+|[²³⁴⁵⁶⁷⁸⁹])?)\s*=\s*([A-Za-z0-9]+(?:\^\d+|[²³⁴⁵⁶⁷⁸⁹])?(?:\s*[+\-*/^×÷]\s*[A-Za-z0-9]+(?:\^\d+|[²³⁴⁵⁶⁷⁸⁹])?)*)/g;

  return text.replace(equationPattern, (_, left, right) => {
    const speakExpression = (expression) => expression
      .replace(/(\d+)([A-Za-z]+)/g, (_, coefficient, variables) => `${coefficient}\\u0000${[...variables].join('\\u0000')}`)
      .replace(/([A-Za-z])([A-Za-z]+)/g, (_, first, rest) => `${first}\\u0000${[...rest].join('\\u0000')}`)
      .replace(/(\d+)\s*\/\s*(\d+)/g, (_, numerator, denominator) => {
        if (numerator === '1' && denominator === '2') return 'one half';
        if (numerator === '1' && denominator === '3') return 'one third';
        if (numerator === '1' && denominator === '4') return 'one quarter';
        return `${numerator} divided by ${denominator}`;
      })
      .replace(/\^\s*2|²/g, ' squared')
      .replace(/\^\s*3|³/g, ' cubed')
      .replace(/\^\s*(\d+)|([⁴⁵⁶⁷⁸⁹])/g, (_, exponent, superscript) => ` to the power of ${exponent || superscript}`)
      .replace(/\b1\b/g, 'one')
      .replace(/\b2\b/g, 'two')
      .replace(/\b3\b/g, 'three')
      .replace(/\b4\b/g, 'four')
      .replace(/\b5\b/g, 'five')
      .replace(/\s*\+\s*/g, ' plus ')
      .replace(/\s*-\s*/g, ' minus ')
      .replace(/\s*\/\s*/g, ' divided by ')
      .replace(/\s*[*×]\s*/g, ' times ')
      .replace(/\s*÷\s*/g, ' divided by ')
      .replace(/\\u0000/g, ' times ')
      .replace(/\s+/g, ' ')
      .trim();

    return `${speakExpression(left)} equals ${speakExpression(right)}`;
  });
}

export function generateNarrationScript({ title, questions = [], duration, slideTimings = [], explanationLanguage = 'english' }) {
  const safeTitle = normalizeText(title || 'MCQ Video') || 'MCQ Video';
  const safeQuestions = Array.isArray(questions) && questions.length > 0 ? questions : [{ question: 'No question available.' }];
  const language = ['english', 'hindi', 'hinglish'].includes(explanationLanguage) ? explanationLanguage : 'english';
  const explanationKey = {
    english: 'explanation',
    hindi: 'hindiExplanation',
    hinglish: 'hinglishExplanation',
  }[language];

  const opening = `Welcome to ${safeTitle}. Let's get started.`;
  const questionIntros = shufflePhrases(QUESTION_INTRO_PHRASES);
  const solutionIntros = shufflePhrases(SOLUTION_INTRO_PHRASES);
  const phraseSchedule = createPhraseSchedule(safeQuestions.length);
  let questionIntroIndex = 0;
  let solutionIntroIndex = 0;
  const questionSegments = safeQuestions.map((question, index) => {
    const prompt = toSpeechText(question.question || 'Untitled question');
    const answerLetter = normalizeText(question.correctAnswer || 'A').toUpperCase();
    const answerOption = toSpeechText(question[`option${answerLetter}`] || '');
    const selectedExplanation = normalizeText(question[explanationKey] || '');
    const useSelectedLanguage = language !== 'english' && Boolean(selectedExplanation);
    const localizedAnswer = language === 'hinglish'
      ? `Correct answer option ${answerLetter} hai.`
      : `सही उत्तर विकल्प ${answerLetter} है।`;
    const questionIntro = useSelectedLanguage && phraseSchedule.questionIntroIndices.has(index)
      ? `${questionIntros[questionIntroIndex++ % questionIntros.length]} `
      : '';
    const solutionIntro = useSelectedLanguage && phraseSchedule.solutionIntroIndices.has(index)
      ? `${solutionIntros[solutionIntroIndex++ % solutionIntros.length]} `
      : '';
    const answerText = useSelectedLanguage
      ? `${solutionIntro}${localizedAnswer} ${selectedExplanation}`
      : toSpeechText(`The answer is ${answerLetter}${answerOption ? `: ${answerOption}` : ''}. ${normalizeText(question.explanation || '') || 'Let us review the reasoning.'}`);

    return {
      questionText: `${index === 0 && !useSelectedLanguage ? `${opening} ` : ''}${questionIntro}${prompt}`,
      solutionText: answerText,
      questionLanguage: useSelectedLanguage ? 'hi-IN' : 'en-IN',
      solutionLanguage: useSelectedLanguage ? 'hi-IN' : 'en-IN',
    };
  });
  const slideNarration = questionSegments;
  const segments = slideNarration.flatMap(({ questionText, solutionText }) => [questionText, solutionText]);

  const script = segments.join(' ');

  const subtitleDuration = Number(duration) > 0 ? Number(duration) : safeQuestions.length * 6;
  const fallbackQuestionDuration = subtitleDuration / safeQuestions.length;
  const subtitleEntries = safeQuestions.flatMap((question, index) => {
    const fallbackStart = index * fallbackQuestionDuration;
    const fallbackAnswerStart = fallbackStart + fallbackQuestionDuration / 2;
    const fallbackEnd = fallbackStart + fallbackQuestionDuration;
    const timing = slideTimings[index];
    const answerLetter = normalizeText(question.correctAnswer || 'A').toUpperCase();
    const answerOption = normalizeText(question[`option${answerLetter}`] || '');
    const questionText = `${index === 0 ? `${opening} ` : ''}${normalizeText(question.question || 'Untitled question')}`;
    const answerText = `The answer is ${answerLetter}${answerOption ? `: ${answerOption}` : ''}. ${normalizeText(question.explanation || '') || 'Let us review the reasoning.'}`;
    const answerStart = timing?.answerStart ?? fallbackAnswerStart;
    const end = timing?.solutionEnd ?? fallbackEnd;

    return [
      { start: timing?.questionStart ?? fallbackStart, end: timing?.questionEnd ?? fallbackAnswerStart, text: questionText.slice(0, 180) },
      { start: answerStart, end, text: answerText.slice(0, 180) },
    ];
  });

  const srt = subtitleEntries
    .map((entry, i) => {
      const start = formatSrtTime(entry.start);
      const end = formatSrtTime(entry.end);
      return `${i + 1}\n${start} --> ${end}\n${entry.text}\n`;
    })
    .join('\n');

  return {
    title: safeTitle,
    script,
    segments,
    slideNarration,
    srt,
    questionCount: safeQuestions.length,
  };
}

function formatSrtTime(seconds) {
  const totalMs = Math.round(Math.max(0, Number(seconds) || 0) * 1000);
  const hrs = Math.floor(totalMs / 3600000);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
