import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import { config } from '../config.js';
import { generateNarrationScript } from './scriptGenerator.js';
import { synthesizeCustomVoice } from './voiceService.js';

const THINKING_DURATION_SECONDS = 3;

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

function findFfmpegBinary() {
  if (ffmpegStatic && typeof ffmpegStatic === 'string' && ffmpegStatic.trim()) {
    return ffmpegStatic;
  }

  const candidates = process.platform === 'win32'
    ? ['ffmpeg.exe', 'ffmpeg']
    : ['ffmpeg'];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
    if (result.status === 0) {
      return candidate;
    }
  }

  const which = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(which, ['ffmpeg'], { encoding: 'utf8' });
  if (result.status === 0) {
    const out = String(result.stdout || '').trim();
    return out.split(/\r?\n/)[0] || 'ffmpeg';
  }

  return null;
}

function findFontFile() {
  const candidates = process.platform === 'win32'
    ? [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf')]
    : process.platform === 'darwin'
      ? ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf']
      : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'];

  return candidates.find((fontPath) => fs.existsSync(fontPath));
}

function escapeFilterValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/[\r\n]+/g, ' ');
}

function ffmpegTextFilePath(filePath) {
  return escapeFilterValue(path.relative(process.cwd(), filePath).split(path.sep).join('/'));
}

function wrapText(text, maxLength = 54) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function readQuestionOption(question, letter) {
  const options = question.options;
  const optionIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
  const value = question[`option${letter}`]
    ?? (Array.isArray(options) ? options[optionIndex] : options?.[letter] ?? options?.[letter.toLowerCase()]);
  return normalizeText(value || '');
}

function normalizeVideoQuestion(question) {
  return {
    ...question,
    question: normalizeText(question.question ?? question.questionText ?? question.text ?? ''),
    optionA: readQuestionOption(question, 'A'),
    optionB: readQuestionOption(question, 'B'),
    optionC: readQuestionOption(question, 'C'),
    optionD: readQuestionOption(question, 'D'),
    correctAnswer: normalizeText(question.correctAnswer ?? question.correct_answer ?? question.answer ?? 'A').toUpperCase(),
    explanation: normalizeText(question.explanation || ''),
  };
}

export function buildVideoSlideText(question, index) {
  const prompt = normalizeText(question.question || 'Untitled question');
  const options = ['A', 'B', 'C', 'D'].map((letter) => (
    `${letter}. ${readQuestionOption(question, letter)}`
  ));
  const correctAnswer = normalizeText(question.correctAnswer || 'A').toUpperCase();
  const correctOption = readQuestionOption(question, correctAnswer);
  const explanation = normalizeText(question.explanation || 'Review the correct option carefully.');
  const questionLines = [
    `QUESTION ${index + 1}`,
    '',
    ...wrapText(prompt),
    '',
    ...options.flatMap((option) => wrapText(option)),
  ];
  const solutionLines = [
    `SOLUTION ${index + 1}`,
    '',
    ...wrapText(`Correct answer: ${correctAnswer}. ${correctOption}`),
    '',
    ...wrapText(`Explanation: ${explanation}`),
  ];

  return {
    questionText: questionLines.join('\n'),
    solutionText: solutionLines.join('\n'),
    questionWeight: [prompt, ...options].join(' ').trim().split(/\s+/).length,
    solutionWeight: `Correct answer: ${correctAnswer}. ${correctOption} Explanation: ${explanation}`.trim().split(/\s+/).length,
  };
}

function slideFontSize(text) {
  const lineCount = text.split('\n').length;
  return Math.max(22, Math.min(34, Math.floor(590 / (lineCount * 1.15))));
}

function readWavDuration(filePath) {
  const wav = fs.readFileSync(filePath);
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  let byteRate = 0;
  let audioBytes = 0;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const chunkSize = wav.readUInt32LE(offset + 4);
    if (wav.toString('ascii', offset, offset + 4) === 'fmt ' && chunkSize >= 16) {
      byteRate = wav.readUInt32LE(offset + 16);
    } else if (wav.toString('ascii', offset, offset + 4) === 'data') {
      audioBytes = chunkSize;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return byteRate && audioBytes ? audioBytes / byteRate : null;
}

function runProcess(binary, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, ...options });
    let stderr = '';
    let stdout = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `${binary} exited with code ${code}`));
      }
    });
  });
}

function getEdgeTtsCommand() {
  if (config.voiceServicePython) return { binary: config.voiceServicePython, args: [] };
  const virtualEnvPython = path.join(
    config.voiceServiceDirectory,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  );
  if (fs.existsSync(virtualEnvPython)) return { binary: virtualEnvPython, args: [] };
  if (process.platform === 'win32') return { binary: 'py', args: ['-3.10'] };
  return { binary: 'python3.10', args: [] };
}

async function synthesizeEdgeNarration(slides, ffmpegBinary, voiceSelection, onProgress) {
  const englishVoice = 'en-IN-NeerjaNeural';
  const hindiVoice = 'hi-IN-SwaraNeural';
  const selectedEdgeVoice = voiceSelection.startsWith('edge:') ? voiceSelection.slice(5) : 'default';
  const voicesUsed = new Set();

  const speak = async (text, audioFilePath, voice, lang) => {
    const mp3FilePath = `${audioFilePath}.mp3`;
    try {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const command = getEdgeTtsCommand();
        try {
          await runProcess(command.binary, [
            ...command.args,
            '-m', 'edge_tts',
            '--voice', voice,
            '--text', text,
            '--write-media', mp3FilePath,
          ], { timeout: 300000, cwd: config.voiceServiceDirectory });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (!/Unexpected server response:\s*403|403.*(?:handshake|response status)/i.test(error?.message || '') || attempt === 2) break;
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (lastError) {
        if (/Unexpected server response:\s*403|403.*(?:handshake|response status)/i.test(lastError.message || '')) {
          throw new Error('Microsoft Edge TTS rejected the connection (HTTP 403) after 3 attempts. Swara narration needs the Edge TTS service; check the server connection and retry.');
        }
        if (/No module named edge_tts/i.test(lastError.message || '')) {
          throw new Error('Edge TTS is missing from the Python environment. Install voice-service/requirements.txt in voice-service/.venv.');
        }
        throw lastError;
      }
      await runProcess(ffmpegBinary, [
        '-y', '-i', mp3FilePath,
        '-acodec', 'pcm_s16le', '-ar', '24000', '-ac', '1', audioFilePath,
      ], { timeout: 300000 });
      voicesUsed.add(voice);
    } finally {
      fs.rmSync(mp3FilePath, { force: true });
    }
  };

  const concurrency = Math.min(4, slides.length);
  let nextSlideIndex = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextSlideIndex < slides.length) {
      const slide = slides[nextSlideIndex++];
      onProgress({ stage: 'narration', message: `Generating question audio ${nextSlideIndex} of ${slides.length}.`, progress: Math.round(((nextSlideIndex - 1) / slides.length) * 65) });
      const questionIsHindi = slide.questionLanguage === 'hi-IN';
      const questionDefaultVoice = questionIsHindi ? hindiVoice : englishVoice;
      const questionVoice = selectedEdgeVoice.startsWith(`${questionIsHindi ? 'hi' : 'en'}-IN-`)
        ? selectedEdgeVoice
        : questionDefaultVoice;
      await speak(
        slide.questionText,
        slide.questionAudioFilePath,
        questionVoice,
        questionIsHindi ? 'hi-IN' : 'en-IN',
      );
      const solutionIsHindi = slide.solutionLanguage === 'hi-IN';
      onProgress({ stage: 'narration', message: `Generating solution audio ${nextSlideIndex} of ${slides.length}.`, progress: Math.round(((nextSlideIndex - 0.5) / slides.length) * 65) });
      const solutionDefaultVoice = solutionIsHindi ? hindiVoice : englishVoice;
      const solutionVoice = selectedEdgeVoice.startsWith(`${solutionIsHindi ? 'hi' : 'en'}-IN-`)
        ? selectedEdgeVoice
        : solutionDefaultVoice;
      await speak(
        slide.solutionText,
        slide.solutionAudioFilePath,
        solutionVoice,
        solutionIsHindi ? 'hi-IN' : 'en-IN',
      );
    }
  }));

  return [...voicesUsed].join(', ');
}

async function synthesizeNarration(slides, ffmpegBinary, voiceSelection, ownerId, onProgress) {
  if (voiceSelection.startsWith('custom:')) {
    const voiceId = voiceSelection.slice('custom:'.length);
    if (!voiceId) throw new Error('Choose a valid custom voice.');
    for (const [index, slide] of slides.entries()) {
      const questionNumber = index + 1;
      onProgress({ stage: 'narration', message: `Generating question audio ${questionNumber} of ${slides.length}.`, progress: Math.round((index / slides.length) * 65) });
      await synthesizeCustomVoice({
        ownerId,
        voiceId,
        text: slide.questionText,
        language: slide.questionLanguage,
        outputPath: slide.questionAudioFilePath,
      });
      onProgress({ stage: 'narration', message: `Generating solution audio ${questionNumber} of ${slides.length}.`, progress: Math.round(((index + 0.5) / slides.length) * 65) });
      await synthesizeCustomVoice({
        ownerId,
        voiceId,
        text: slide.solutionText,
        language: slide.solutionLanguage,
        outputPath: slide.solutionAudioFilePath,
      });
    }
    return 'Custom voice';
  }

  const provider = process.env.TTS_PROVIDER || 'edge';
  if (provider === 'edge' || voiceSelection.startsWith('edge:')) {
    return synthesizeEdgeNarration(slides, ffmpegBinary, voiceSelection, onProgress);
  }
  if (provider !== 'system') {
    throw new Error(`Unsupported TTS_PROVIDER '${provider}'. Use 'edge' or 'system'.`);
  }

  let speechBinary = null;
  if (process.platform === 'linux') {
    speechBinary = ['espeak-ng', 'espeak'].find((candidate) => (
      spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0
    ));
    if (!speechBinary) {
      throw new Error('Install espeak-ng or espeak to generate narrated videos on Linux.');
    }
  }

  const concurrency = Math.min(4, slides.length);
  let nextSlideIndex = 0;
  let selectedVoice = '';
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextSlideIndex < slides.length) {
      const slide = slides[nextSlideIndex++];
      fs.writeFileSync(slide.questionTextFilePath, slide.questionText, 'utf8');
      fs.writeFileSync(slide.solutionTextFilePath, slide.solutionText, 'utf8');

      if (process.platform === 'win32') {
        const script = [
          'Add-Type -AssemblyName System.Speech',
          '$questionText = [System.IO.File]::ReadAllText($env:MCQ_QUESTION_TEXT_FILE, [System.Text.Encoding]::UTF8)',
          '$solutionText = [System.IO.File]::ReadAllText($env:MCQ_SOLUTION_TEXT_FILE, [System.Text.Encoding]::UTF8)',
          '$voiceName = $null',
          'function Write-Speech($text, $audioFile) {',
          '  $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer',
          '  $speaker.Rate = 2',
          '  $installedVoices = $speaker.GetInstalledVoices()',
          '  if ($env:MCQ_TTS_VOICE) {',
          '    $voice = $installedVoices | Where-Object { $_.VoiceInfo.Name -eq $env:MCQ_TTS_VOICE } | Select-Object -First 1',
          '    if (-not $voice) { $available = ($installedVoices | ForEach-Object { $_.VoiceInfo.Name }) -join \, \'; \'; throw \'TTS voice not installed: \' + $env:MCQ_TTS_VOICE + \'. Available voices: \' + $available }',
          '  } else {',
          '    $voice = $installedVoices | Where-Object { $_.VoiceInfo.Culture.Name -eq $env:MCQ_TTS_CULTURE } | Select-Object -First 1',
          '    if (-not $voice) { $voice = $installedVoices | Where-Object { $_.VoiceInfo.Name -match \'Indian|Heera|Ravi\' } | Select-Object -First 1 }',
          '    if (-not $voice) { $voice = $installedVoices | Select-Object -First 1 }',
          '    if (-not $voice) { throw \'No Windows speech voices are installed. Install a Windows text-to-speech voice or set MCQ_TTS_VOICE.\' }',
          '  }',
          '  $speaker.SelectVoice($voice.VoiceInfo.Name)',
          '  try { $speaker.SetOutputToWaveFile($audioFile); $speaker.Speak($text); $speaker.Voice.Name } finally { $speaker.Dispose() }',
          '}',
          '$voiceName = Write-Speech $questionText $env:MCQ_QUESTION_AUDIO_FILE',
          'Write-Speech $solutionText $env:MCQ_SOLUTION_AUDIO_FILE | Out-Null',
          '[Console]::Out.WriteLine(\'MCQ_TTS_VOICE=\' + $voiceName)',
        ].join('; ');
        const output = await runProcess('powershell.exe', [
          '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script,
        ], {
          timeout: 300000,
          env: {
            ...process.env,
            MCQ_TTS_CULTURE: process.env.MCQ_TTS_CULTURE || 'en-IN',
            MCQ_TTS_VOICE: process.env.MCQ_TTS_VOICE || '',
            MCQ_QUESTION_TEXT_FILE: slide.questionTextFilePath,
            MCQ_SOLUTION_TEXT_FILE: slide.solutionTextFilePath,
            MCQ_QUESTION_AUDIO_FILE: slide.questionAudioFilePath,
            MCQ_SOLUTION_AUDIO_FILE: slide.solutionAudioFilePath,
          },
        });
        const voiceLine = output.split(/\r?\n/).find((line) => line.startsWith('MCQ_TTS_VOICE='));
        if (voiceLine) selectedVoice ||= voiceLine.slice('MCQ_TTS_VOICE='.length).trim();
      } else if (process.platform === 'darwin') {
        await runProcess('say', ['-o', slide.questionAudioFilePath, '-f', slide.questionTextFilePath], { timeout: 300000 });
        await runProcess('say', ['-o', slide.solutionAudioFilePath, '-f', slide.solutionTextFilePath], { timeout: 300000 });
        selectedVoice ||= 'macOS system voice';
      } else {
        await runProcess(speechBinary, ['-w', slide.questionAudioFilePath, '-f', slide.questionTextFilePath], { timeout: 300000 });
        await runProcess(speechBinary, ['-w', slide.solutionAudioFilePath, '-f', slide.solutionTextFilePath], { timeout: 300000 });
        selectedVoice ||= 'eSpeak system voice';
      }

      for (const audioFilePath of [slide.questionAudioFilePath, slide.solutionAudioFilePath]) {
        if (!fs.existsSync(audioFilePath) || fs.statSync(audioFilePath).size < 44) {
          throw new Error('Speech synthesis did not produce a usable audio file.');
        }
      }
    }
  }));

  return selectedVoice || 'System default voice';
}

export function buildYoutubeMetadata({ title, questions = [] }) {
  const safeTitle = String(title || 'MCQ Video').trim() || 'MCQ Video';
  const safeQuestions = Array.isArray(questions) && questions.length > 0 ? questions : [{ question: 'No question available.' }];
  const descriptionLines = [
    `${safeTitle}`,
    '',
    'This video was generated by MCQ Video Studio.',
    '',
    'Key topics:',
    ...safeQuestions.slice(0, 5).map((question, index) => `${index + 1}. ${String(question.question || 'Untitled question').trim()}`),
    '',
    'Learn more with short MCQ reviews, exam prep explanations, and quick concept checks.',
  ];

  return {
    title: safeTitle,
    description: descriptionLines.join('\n'),
    tags: ['MCQ', 'Quiz', 'CurrentAffairs', 'Education', 'ExamPrep', 'Learning', 'YouTube'],
    questionCount: safeQuestions.length,
  };
}

export async function generateVideo({ title, questions = [], duration = 8, explanationLanguage = 'english', voiceSelection = 'edge:default', ownerId, onProgress = () => {} }) {
  const outputDir = path.resolve(process.cwd(), config.storagePath, 'videos');
  fs.mkdirSync(outputDir, { recursive: true });

  const safeTitle = String(title || 'MCQ Video').trim() || 'MCQ Video';
  const slug = safeTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mcq-video';
  const stamp = Date.now();
  const filePath = path.join(outputDir, `${stamp}-${slug}.mp4`);
  const subtitleFilePath = path.join(outputDir, `${stamp}-${slug}.srt`);
  const metadataFilePath = path.join(outputDir, `${stamp}-${slug}.json`);
  const slideFiles = [];
  const narrationFiles = [];
  const safeQuestions = (Array.isArray(questions) && questions.length > 0
    ? questions
    : [{ question: 'No question provided.' }]
  ).map(normalizeVideoQuestion);
  const narration = generateNarrationScript({ title: safeTitle, questions: safeQuestions, explanationLanguage });
  const narrationSlides = narration.slideNarration.map((slide, index) => {
    const files = {
      ...slide,
      questionTextFilePath: path.join(outputDir, `${stamp}-${slug}-${index}-question.narration.txt`),
      solutionTextFilePath: path.join(outputDir, `${stamp}-${slug}-${index}-solution.narration.txt`),
      questionAudioFilePath: path.join(outputDir, `${stamp}-${slug}-${index}-question.${process.platform === 'darwin' ? 'aiff' : 'wav'}`),
      solutionAudioFilePath: path.join(outputDir, `${stamp}-${slug}-${index}-solution.${process.platform === 'darwin' ? 'aiff' : 'wav'}`),
    };
    narrationFiles.push(
      files.questionTextFilePath,
      files.solutionTextFilePath,
      files.questionAudioFilePath,
      files.solutionAudioFilePath,
    );
    return files;
  });

  const ffmpegBinary = findFfmpegBinary();
  if (!ffmpegBinary) {
    throw new Error('FFmpeg is not installed or not on PATH. Install FFmpeg to generate valid MP4 videos.');
  }

  const fontFile = findFontFile();
  if (!fontFile) {
    throw new Error('A supported system font is required to render question text in the video.');
  }

  const youtubeMetadata = buildYoutubeMetadata({ title: safeTitle, questions: safeQuestions });

  try {
    const audioVoice = await synthesizeNarration(narrationSlides, ffmpegBinary, voiceSelection, ownerId, onProgress);
    onProgress({ stage: 'rendering', message: 'Narration is ready. Rendering the MP4 now.', progress: 75 });
    for (const slide of narrationSlides) {
      slide.questionAudioDuration = readWavDuration(slide.questionAudioFilePath)
        || slide.questionText.trim().split(/\s+/).length / 2.2;
      slide.solutionAudioDuration = readWavDuration(slide.solutionAudioFilePath)
        || slide.solutionText.trim().split(/\s+/).length / 2.2;
    }
    const audioDuration = narrationSlides.reduce((total, slide) => (
      total + slide.questionAudioDuration + THINKING_DURATION_SECONDS + slide.solutionAudioDuration
    ), 0);
    const videoDuration = Math.ceil(Math.max(Number(duration) || 5, audioDuration));

    const slides = safeQuestions.map((question, index) => ({
      ...buildVideoSlideText(question, index),
      questionAudioDuration: narrationSlides[index].questionAudioDuration,
      solutionAudioDuration: narrationSlides[index].solutionAudioDuration,
    }));
    let slideStart = 0;
    const slideTimings = [];
    const overlaySegments = slides.flatMap((slide, index) => {
      const questionFilePath = path.join(outputDir, `${stamp}-${slug}-${index}-question.txt`);
      const solutionFilePath = path.join(outputDir, `${stamp}-${slug}-${index}-solution.txt`);
      slideFiles.push(questionFilePath, solutionFilePath);
      fs.writeFileSync(questionFilePath, slide.questionText, 'utf8');
      fs.writeFileSync(solutionFilePath, slide.solutionText, 'utf8');

      const questionStart = slideStart;
      const questionEnd = questionStart + slide.questionAudioDuration;
      const answerStart = questionEnd + THINKING_DURATION_SECONDS;
      const solutionEnd = index === slides.length - 1
        ? videoDuration
        : answerStart + slide.solutionAudioDuration;
      slideTimings.push({ questionStart, questionEnd, answerStart, solutionEnd });
      const questionEnable = `:enable='between(t,${slideStart.toFixed(3)},${answerStart.toFixed(3)})'`;
      const thinkingEnable = `:enable='between(t,${questionEnd.toFixed(3)},${answerStart.toFixed(3)})'`;
      const solutionEnable = `:enable='between(t,${answerStart.toFixed(3)},${solutionEnd.toFixed(3)})'`;
      slideStart = solutionEnd;

      return [
        `drawtext=textfile='${ffmpegTextFilePath(questionFilePath)}'` +
          `:fontcolor=white:fontsize=${slideFontSize(slide.questionText)}:x=100:y=70:line_spacing=10:box=1:boxcolor=0x0b1220@0.78:boxborderw=24${questionEnable}`,
        `drawtext=text='THINK IT THROUGH':fontcolor=0xfde68a:fontsize=24:x=100:y=625:box=1:boxcolor=0x0b1220@0.78:boxborderw=12${thinkingEnable}`,
        `drawtext=text='%{eif\\:ceil(${THINKING_DURATION_SECONDS}-(t-${questionEnd.toFixed(3)}))\\:d}':fontcolor=0xfde68a:fontsize=54:x=1120:y=600:box=1:boxcolor=0x0b1220@0.78:boxborderw=16${thinkingEnable}`,
        `drawtext=textfile='${ffmpegTextFilePath(solutionFilePath)}'` +
          `:fontcolor=0x93c5fd:fontsize=${slideFontSize(slide.solutionText)}:x=100:y=70:line_spacing=10:box=1:boxcolor=0x0b1220@0.78:boxborderw=24${solutionEnable}`,
      ];
    });

    const audioFilters = [];
    const audioLabels = [];
    narrationSlides.forEach((_, index) => {
      const questionInput = index * 3 + 1;
      const thinkingInput = questionInput + 1;
      const solutionInput = questionInput + 2;
      audioFilters.push(`[${questionInput}:a:0]aresample=44100,aformat=channel_layouts=mono[question${index}]`);
      audioFilters.push(`[${thinkingInput}:a:0]volume=0.8[thinking${index}]`);
      audioFilters.push(`[${solutionInput}:a:0]aresample=44100,aformat=channel_layouts=mono[solution${index}]`);
      audioLabels.push(`[question${index}]`, `[thinking${index}]`, `[solution${index}]`);
    });
    const audioGraph = `${audioFilters.join(';')};${audioLabels.join('')}concat=n=${narrationSlides.length * 3}:v=0:a=1,apad[audio]`;
    const filterGraphFilePath = path.join(outputDir, `${stamp}-${slug}-filters.txt`);
    slideFiles.push(filterGraphFilePath);
    fs.writeFileSync(filterGraphFilePath, `[0:v:0]${overlaySegments.join(',')}[video];${audioGraph}`, 'utf8');

    const command = [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=0x0f172a:s=1280x720:r=10:d=${videoDuration}`,
      ...narrationSlides.flatMap((slide) => [
        '-i', slide.questionAudioFilePath,
        '-f', 'lavfi', '-i', `aevalsrc=(0.22*sin(2*PI*1200*t)+0.12*sin(2*PI*2200*t))*exp(-45*mod(t\\,1))*lt(mod(t\\,1)\\,0.08):s=44100:d=${THINKING_DURATION_SECONDS}`,
        '-i', slide.solutionAudioFilePath,
      ]),
      '-filter_complex_script', filterGraphFilePath,
      '-map', '[video]', '-map', '[audio]',
      '-t', String(videoDuration),
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '26',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      filePath,
    ];

    try {
      await runProcess(ffmpegBinary, command, { timeout: 30 * 60 * 1000 });
    } catch (error) {
      fs.rmSync(filePath, { force: true });
      throw new Error(`FFmpeg failed to create the MP4: ${error.message || error}`);
    }

    const mp4Header = fs.existsSync(filePath) ? fs.openSync(filePath, 'r') : null;
    if (mp4Header === null) {
      throw new Error('FFmpeg was unable to create the MP4 file.');
    }

    const signature = Buffer.alloc(12);
    try {
      fs.readSync(mp4Header, signature, 0, signature.length, 0);
    } finally {
      fs.closeSync(mp4Header);
    }

    if (signature.toString('ascii', 4, 8) !== 'ftyp') {
      fs.rmSync(filePath, { force: true });
      throw new Error('FFmpeg output is not a valid MP4 container.');
    }

    const timedNarration = generateNarrationScript({
      title: safeTitle,
      questions: safeQuestions,
      duration: videoDuration,
      slideTimings,
    });
    fs.writeFileSync(subtitleFilePath, timedNarration.srt || '', 'utf8');
    fs.writeFileSync(metadataFilePath, JSON.stringify({
      ...youtubeMetadata,
      videoFile: path.basename(filePath),
      subtitleFile: path.basename(subtitleFilePath),
      generatedAt: new Date().toISOString(),
      audioTrack: 'narration',
      audioVoice,
    }, null, 2), 'utf8');

    return {
      filePath,
      fileName: path.basename(filePath),
      subtitleFilePath,
      subtitleFileName: path.basename(subtitleFilePath),
      metadataFilePath,
      metadataFileName: path.basename(metadataFilePath),
      title: safeTitle,
      duration: videoDuration,
      questionCount: safeQuestions.length,
      audioVoice,
      slideTimings,
    };
  } finally {
    for (const slideFile of slideFiles) {
      fs.rmSync(slideFile, { force: true });
    }
    for (const narrationFile of narrationFiles) {
      fs.rmSync(narrationFile, { force: true });
    }
  }
}
