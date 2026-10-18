import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import { registerUser, createQuestion, createSet, generatePpt } from '../src/mvpTestHelpers.js';
import { buildVideoSlideText, generateVideo } from '../src/services/videoGenerator.js';
import { generateNarrationScript } from '../src/services/scriptGenerator.js';
import { createPhraseSchedule, QUESTION_INTRO_PHRASES, SOLUTION_INTRO_PHRASES } from '../src/services/narrationPhrases.js';

async function generateVideoWithTestVoice(options) {
  const originalVoice = process.env.MCQ_TTS_VOICE;
  const originalProvider = process.env.TTS_PROVIDER;
  process.env.TTS_PROVIDER = 'system';
  if (process.platform === 'win32' && !originalVoice) {
    const result = spawnSync('powershell.exe', [
      '-NoProfile', '-Command',
      'Add-Type -AssemblyName System.Speech; $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speaker.GetInstalledVoices() | Select-Object -First 1 -ExpandProperty VoiceInfo | Select-Object -ExpandProperty Name',
    ], { encoding: 'utf8' });
    process.env.MCQ_TTS_VOICE = result.stdout.trim();
  }

  try {
    return await generateVideo(options);
  } finally {
    if (originalVoice === undefined) delete process.env.MCQ_TTS_VOICE;
    else process.env.MCQ_TTS_VOICE = originalVoice;
    if (originalProvider === undefined) delete process.env.TTS_PROVIDER;
    else process.env.TTS_PROVIDER = originalProvider;
  }
}

test('video slides keep full question, every option, and full solution text', () => {
  const questionText = 'Which international conference is recognized for its extensive global participation and annual policy discussions across multiple sectors?';
  const optionD = 'Bharat International Rice Conference';
  const explanation = 'This explanation gives the context for the correct option and includes additional details that must remain visible on the solution slide.';
  const slides = buildVideoSlideText({
    question: questionText,
    options: {
      A: 'World Seafood Congress',
      B: 'PLASTINDIA',
      C: 'International Dharma Conference',
      D: optionD,
    },
    correctAnswer: 'D',
    explanation,
  }, 0);
  const normalizedQuestionSlide = slides.questionText.replace(/\s+/g, ' ');
  const normalizedSolutionSlide = slides.solutionText.replace(/\s+/g, ' ');

  assert.ok(normalizedQuestionSlide.includes(questionText));
  assert.ok(normalizedQuestionSlide.includes(`D. ${optionD}`));
  assert.ok(normalizedSolutionSlide.includes(`Correct answer: D. ${optionD}`));
  assert.ok(normalizedSolutionSlide.includes(explanation));
});

test('narration reads only the question before revealing its answer', () => {
  const narration = generateNarrationScript({
    title: 'Quick Quiz',
    questions: [
      { question: 'Which country has Tokyo as its capital?', optionA: 'India', optionB: 'Japan', correctAnswer: 'B', explanation: 'Tokyo is Japan’s capital.' },
      { question: 'Which planet is known as the Red Planet?', optionA: 'Earth', optionB: 'Mars', correctAnswer: 'B', explanation: 'Iron oxide gives Mars its color.' },
    ],
  });

  assert.match(narration.slideNarration[0].questionText, /Welcome to Quick Quiz/);
  assert.match(narration.slideNarration[0].questionText, /Which country has Tokyo as its capital/);
  assert.doesNotMatch(narration.slideNarration[0].questionText, /India|Japan|Option [A-D]/);
  assert.doesNotMatch(narration.slideNarration[1].questionText, /Welcome|India|Japan|Mars/);
  assert.match(narration.slideNarration[0].solutionText, /The answer is B: Japan/);
});

test('Hindi explanations are spoken in Hindi and stay out of visible text and subtitles', () => {
  const hindiExplanation = 'मंगल ग्रह की सतह पर आयरन ऑक्साइड है।';
  const question = {
    question: 'Why does Mars appear red?',
    optionA: 'Water',
    optionB: 'Iron oxide',
    optionC: 'Methane',
    optionD: 'Clouds',
    correctAnswer: 'B',
    explanation: 'Iron oxide gives Mars its red color.',
    hindiExplanation,
  };
  const narration = generateNarrationScript({ title: 'Planet Review', questions: [question], explanationLanguage: 'hindi' });
  const slideText = buildVideoSlideText(question, 0);

  assert.equal(narration.slideNarration[0].solutionLanguage, 'hi-IN');
  assert.match(narration.slideNarration[0].solutionText, new RegExp(hindiExplanation));
  assert.match(slideText.solutionText, /Iron oxide gives Mars its red color/);
  assert.doesNotMatch(slideText.solutionText, new RegExp(hindiExplanation));
  assert.match(narration.srt, /Iron oxide gives Mars its red color/);
  assert.doesNotMatch(narration.srt, new RegExp(hindiExplanation));
});

test('Hindi narration randomly adds separate question and solution phrases', () => {
  const narration = generateNarrationScript({
    title: 'Quick Quiz',
    questions: [{
      question: 'Which planet appears red?',
      correctAnswer: 'B',
      explanation: 'Iron oxide gives Mars its red color.',
      hindiExplanation: 'मंगल ग्रह की सतह पर आयरन ऑक्साइड है।',
    }],
    explanationLanguage: 'hindi',
  });
  const { questionText, solutionText } = narration.slideNarration[0];

  const phraseCount = QUESTION_INTRO_PHRASES.length + SOLUTION_INTRO_PHRASES.length;
  assert.ok(phraseCount >= 100 && phraseCount <= 150);
  assert.doesNotMatch(questionText, /चलिए|अगले question/);
  assert.doesNotMatch(solutionText, /उम्मीद है|चलिए,/);
  assert.doesNotMatch(questionText, /Welcome to Quick Quiz|Let's get started/);
  assert.doesNotMatch(narration.srt, /उम्मीद है|अब अगले question/);
});

test('randomized narration phrase events are spaced 2–5 questions apart', () => {
  const schedule = createPhraseSchedule(16, () => 0);
  const eventAfterQuestions = [
    ...[...schedule.questionIntroIndices],
    ...[...schedule.solutionIntroIndices].map((index) => index + 1),
  ].sort((first, second) => first - second);

  assert.deepEqual(eventAfterQuestions, [2, 4, 6, 8, 10, 12, 14, 16]);
  assert.ok([...schedule.questionIntroIndices].every((index) => !schedule.solutionIntroIndices.has(index)));
});

test('explanation language selects its matching field and falls back to English', () => {
  const question = {
    question: 'Why does Mars appear red?',
    correctAnswer: 'B',
    explanation: 'Iron oxide gives Mars its red color.',
    hindiExplanation: 'मंगल ग्रह iron oxide के कारण लाल दिखता है।',
    hinglishExplanation: 'Mars red dikhta hai because uski surface par iron oxide hota hai.',
  };
  const hinglishNarration = generateNarrationScript({
    title: 'Planet Review',
    questions: [question],
    explanationLanguage: 'hinglish',
  });
  const fallbackNarration = generateNarrationScript({
    title: 'Planet Review',
    questions: [{ ...question, hinglishExplanation: '' }],
    explanationLanguage: 'hinglish',
  });

  assert.equal(hinglishNarration.slideNarration[0].solutionLanguage, 'hi-IN');
  assert.match(hinglishNarration.slideNarration[0].solutionText, /Mars red dikhta hai because uski surface par iron oxide hota hai/);
  assert.doesNotMatch(hinglishNarration.slideNarration[0].solutionText, /iron oxide के कारण लाल दिखता है/);
  assert.equal(fallbackNarration.slideNarration[0].solutionLanguage, 'en-IN');
  assert.match(fallbackNarration.slideNarration[0].solutionText, /Iron oxide gives Mars its red color/);
});

test('narration speaks physics equations clearly while subtitles keep notation', () => {
  const narration = generateNarrationScript({
    title: 'Physics Review',
    questions: [{
      question: 'Use s=ut+1/at^2 and v^2=u^2+2as to calculate displacement.',
      optionA: 'One meter',
      optionB: 'Two meters',
      optionC: 'Three meters',
      optionD: 'Four meters',
      correctAnswer: 'A',
      explanation: 'The equation s=ut+1/at^2 describes displacement.',
    }],
  });

  assert.match(narration.slideNarration[0].questionText, /s equals u times t plus one divided by a times t squared/);
  assert.match(narration.slideNarration[0].questionText, /v squared equals u squared plus two times a times s/);
  assert.match(narration.slideNarration[0].solutionText, /s equals u times t plus one divided by a times t squared/);
  assert.match(narration.srt, /s=ut\+1\/at\^2/);
});

test('register creates a user', () => {
  const user = registerUser('demo@example.com', 'password123');
  assert.equal(user.email, 'demo@example.com');
  assert.ok(user.token);
});

test('question creation stores normalized fields', () => {
  const question = createQuestion({
    question: 'Which country hosted the meeting?',
    optionA: 'India',
    optionB: 'Japan',
    optionC: 'France',
    optionD: 'Germany',
    correctAnswer: 'B',
    explanation: 'Japan hosted the meeting.'
  });

  assert.equal(question.correctAnswer, 'B');
  assert.equal(question.optionA, 'India');
  assert.ok(question.id);
});

test('set creation keeps selected question ids', () => {
  const set = createSet('BPSC Current Affairs Set 01', ['q1', 'q2', 'q3']);
  assert.equal(set.name, 'BPSC Current Affairs Set 01');
  assert.deepEqual(set.questionIds, ['q1', 'q2', 'q3']);
});

test('ppt generation writes a pptx file', () => {
  const output = generatePpt({ title: 'BPSC MCQ', questions: [{ question: 'Test question?', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctAnswer: 'B', explanation: 'Because B is right.' }] });
  assert.ok(output.endsWith('.pptx'));
});

test('video generation writes an mp4 file', async () => {
  const output = await generateVideoWithTestVoice({
    title: 'BPSC MCQ',
    questions: [
      {
        question: 'Test question?',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        correctAnswer: 'B',
        explanation: 'Because B is right.'
      },
      {
        question: 'Second test question?',
        optionA: 'First',
        optionB: 'Second',
        optionC: 'Third',
        optionD: 'Fourth',
        correctAnswer: 'D',
        explanation: 'The second question ends with its own explanation.'
      },
    ]
  });

  assert.ok(output.filePath.endsWith('.mp4'));
  assert.ok(fs.existsSync(output.filePath));
  const mp4Bytes = fs.readFileSync(output.filePath);
  assert.equal(mp4Bytes.toString('ascii', 4, 8), 'ftyp');
  assert.ok(output.duration > 8);
  assert.equal(output.slideTimings.length, 2);
  assert.equal(output.slideTimings[0].answerStart - output.slideTimings[0].questionEnd, 3);
  assert.equal(output.slideTimings[0].solutionEnd, output.slideTimings[1].questionStart);
  assert.equal(output.slideTimings[1].solutionEnd, output.duration);
  assert.ok(output.audioVoice);
  const questionFrameTime = (output.slideTimings[0].questionStart + output.slideTimings[0].questionEnd) / 2;
  const questionFrame = spawnSync(ffmpegStatic, [
    '-v', 'error', '-ss', String(questionFrameTime), '-i', output.filePath,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
  ], { encoding: 'buffer', maxBuffer: 4 * 1024 * 1024 });
  assert.equal(questionFrame.status, 0, questionFrame.stderr?.toString());
  let brightPixelCount = 0;
  for (let index = 0; index < questionFrame.stdout.length; index += 3) {
    if (questionFrame.stdout[index] > 180 && questionFrame.stdout[index + 1] > 180 && questionFrame.stdout[index + 2] > 180) {
      brightPixelCount += 1;
    }
  }
  assert.ok(brightPixelCount > 100, `Expected visible question text, found ${brightPixelCount} bright pixels.`);
  const audioCheck = spawnSync(ffmpegStatic, ['-v', 'error', '-i', output.filePath, '-map', '0:a:0', '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(audioCheck.status, 0, audioCheck.stderr);
  const thinkingAudioCheck = spawnSync(ffmpegStatic, [
    '-v', 'info', '-ss', String(output.slideTimings[0].questionEnd + 1), '-t', '1.5',
    '-i', output.filePath, '-af', 'volumedetect', '-f', 'null', '-',
  ], { encoding: 'utf8' });
  assert.equal(thinkingAudioCheck.status, 0, thinkingAudioCheck.stderr);
  assert.match(thinkingAudioCheck.stderr, /mean_volume: -?\d/);
});

test('video generation also writes a subtitle file alongside the mp4', async () => {
  const output = await generateVideoWithTestVoice({
    title: 'Subtitle Check',
    questions: [{
      question: 'Which country is famous for the Eiffel Tower?',
      optionA: 'Italy',
      optionB: 'France',
      optionC: 'Spain',
      optionD: 'Germany',
      correctAnswer: 'B',
      explanation: 'The Eiffel Tower is in Paris, France.'
    }]
  });

  assert.ok(output.subtitleFilePath);
  assert.ok(fs.existsSync(output.subtitleFilePath));
  assert.ok(output.subtitleFilePath.endsWith('.srt'));
  const subtitleEntries = fs.readFileSync(output.subtitleFilePath, 'utf8').trim().split(/\r?\n\r?\n/);
  const finalTimestamp = subtitleEntries.at(-1).match(/ --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  const finalSubtitleSecond = Number(finalTimestamp[1]) * 3600
    + Number(finalTimestamp[2]) * 60
    + Number(finalTimestamp[3])
    + Number(finalTimestamp[4]) / 1000;
  assert.equal(finalSubtitleSecond, output.duration);
});

test('video generation writes a YouTube metadata file alongside the media bundle', async () => {
  const output = await generateVideoWithTestVoice({
    title: 'YouTube Export Check',
    questions: [{
      question: 'Which planet is known as the Red Planet?',
      optionA: 'Earth',
      optionB: 'Mars',
      optionC: 'Venus',
      optionD: 'Jupiter',
      correctAnswer: 'B',
      explanation: 'Mars appears red because of iron oxide on its surface.'
    }]
  });

  assert.ok(output.metadataFilePath);
  assert.ok(fs.existsSync(output.metadataFilePath));
  assert.ok(output.metadataFilePath.endsWith('.json'));
  const metadata = JSON.parse(fs.readFileSync(output.metadataFilePath, 'utf8'));
  assert.equal(metadata.title, 'YouTube Export Check');
  assert.equal(metadata.questionCount, 1);
  assert.equal(metadata.audioTrack, 'narration');
  assert.ok(metadata.audioVoice);
});
