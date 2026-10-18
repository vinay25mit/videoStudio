import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { readStore, writeStore } from './utils/store.js';
import { requireAuth } from './middleware/auth.js';
import { generatePptx } from './services/pptGenerator.js';
import { generateVideo } from './services/videoGenerator.js';
import { generateNarrationScript } from './services/scriptGenerator.js';
import { ensureVoiceService } from './services/voiceService.js';
import { addVoiceProfileSample, createVoiceProfile, deleteVoiceProfile, listVoiceProfiles } from './services/voiceProfiles.js';

const app = express();
const videoJobs = new Map();
app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MCQ Video Studio API is running.' });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Email and password are required.' } });
  }

  const store = readStore();
  const existing = store.users.find((user) => user.email.toLowerCase() === String(email).toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'USER_EXISTS', message: 'User already exists.' } });
  }

  const user = {
    id: uuidv4(),
    name: name || 'User',
    email: String(email).trim(),
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  writeStore(store);

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });
  res.status(201).json({ success: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const store = readStore();
  const user = store.users.find((entry) => entry.email.toLowerCase() === String(email).toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/questions', requireAuth, (req, res) => {
  const store = readStore();
  const questions = store.questions.filter((question) => question.userId === req.user.id);
  res.json({ success: true, data: questions });
});

app.post('/api/questions', requireAuth, (req, res) => {
  const { question, optionA, optionB, optionC, optionD, correctAnswer, explanation, hindiExplanation, hinglishExplanation, subject, topic, difficulty, tags } = req.body || {};
  if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_QUESTION', message: 'Question, four options and correct answer are required.' } });
  }

  const store = readStore();
  const item = {
    id: uuidv4(),
    userId: req.user.id,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctAnswer: String(correctAnswer).toUpperCase(),
    explanation: explanation || '',
    hindiExplanation: hindiExplanation || '',
    hinglishExplanation: hinglishExplanation || '',
    subject: subject || 'General',
    topic: topic || 'General',
    difficulty: difficulty || 'Medium',
    tags: Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.questions.push(item);
  writeStore(store);
  res.status(201).json({ success: true, data: item });
});

app.post('/api/questions/import', requireAuth, (req, res) => {
  const { questions = [] } = req.body || {};
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'NO_QUESTIONS', message: 'At least one question is required.' } });
  }

  const store = readStore();
  const imported = questions
    .filter((item) => item?.question && item?.optionA && item?.optionB && item?.optionC && item?.optionD && item?.correctAnswer)
    .map((item) => ({
      id: uuidv4(),
      userId: req.user.id,
      question: item.question,
      optionA: item.optionA,
      optionB: item.optionB,
      optionC: item.optionC,
      optionD: item.optionD,
      correctAnswer: String(item.correctAnswer).toUpperCase(),
      explanation: item.explanation || '',
      hindiExplanation: item.hindiExplanation || '',
      hinglishExplanation: item.hinglishExplanation || '',
      subject: item.subject || 'General',
      topic: item.topic || 'General',
      difficulty: item.difficulty || 'Medium',
      tags: Array.isArray(item.tags) ? item.tags : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  store.questions.push(...imported);
  writeStore(store);
  res.json({ success: true, importedCount: imported.length, totalReceived: questions.length });
});

app.get('/api/sets', requireAuth, (req, res) => {
  const store = readStore();
  res.json({ success: true, data: store.sets.filter((set) => set.userId === req.user.id) });
});

app.post('/api/sets', requireAuth, (req, res) => {
  const { name, description, questions = [] } = req.body || {};
  if (!name) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_SET', message: 'Set name is required.' } });
  }

  const store = readStore();
  const set = {
    id: uuidv4(),
    userId: req.user.id,
    name,
    description: description || '',
    questionIds: questions.map((question) => question.id || question),
    createdAt: new Date().toISOString(),
  };

  store.sets.push(set);
  writeStore(store);
  res.status(201).json({ success: true, data: set });
});

app.post('/api/presentations/generate', requireAuth, async (req, res) => {

  const { title, questions = [], mode = 'mcq', data, explanationLanguage = 'english' } = req.body || {};
  const content = data || { title, questions };
  const invalid = (message) => res.status(400).json({ success: false, error: { code: 'INVALID_PRESENTATION', message } });
  if (!['mcq', 'educational', 'coding'].includes(mode)) return invalid('Choose MCQ Question Mode, Educational Content Mode, or Coding Tutorial Mode.');
  if (!content || typeof content !== 'object' || Array.isArray(content) || typeof content.title !== 'string' || !content.title.trim()) return invalid('JSON must include a non-empty title.');
  if (mode === 'mcq') {
    if (!Array.isArray(content.questions) || !content.questions.length) return invalid('MCQ JSON must include a non-empty questions array.');
    for (let i = 0; i < content.questions.length; i += 1) {
      const q = content.questions[i]; const options = q?.options || { A: q?.optionA, B: q?.optionB, C: q?.optionC, D: q?.optionD };
      if (!q || typeof q.question !== 'string' || !q.question.trim() || !['A', 'B', 'C', 'D'].every((key) => typeof options[key] === 'string' && options[key].trim()) || !['A', 'B', 'C', 'D'].includes(String(q.correctAnswer || '').toUpperCase()) || typeof q.explanation !== 'string' || !q.explanation.trim()) return invalid(`Question ${i + 1} needs a question, four options, a correctAnswer (A-D), and an explanation.`);
    }
  } else {
    if (!Array.isArray(content.sections) || !content.sections.length) return invalid(`${mode === 'coding' ? 'Coding Tutorial' : 'Educational Content'} JSON must include a non-empty sections array.`);
    for (let i = 0; i < content.sections.length; i += 1) {
      const section = content.sections[i];
      const fields = ['description', 'explanation', 'code', 'output'];
      const meaningful = fields.some((key) => typeof section?.[key] === 'string' && section[key].trim()) || (Array.isArray(section?.bulletPoints) && section.bulletPoints.some((point) => typeof point === 'string' && point.trim())) || (Array.isArray(section?.examples) && section.examples.some((example) => typeof example === 'string' && example.trim()));
      if (!section || typeof section.title !== 'string' || !section.title.trim() || (mode === 'educational' && (typeof section.description !== 'string' || !section.description.trim())) || !meaningful) return invalid(`Section ${i + 1} needs a title and meaningful content${mode === 'educational' ? ', including a description' : ''}.`);
      if (section.bulletPoints !== undefined && (!Array.isArray(section.bulletPoints) || section.bulletPoints.some((point) => typeof point !== 'string'))) return invalid(`Section ${i + 1} bulletPoints must be an array of strings.`);
      if (section.examples !== undefined && (!Array.isArray(section.examples) || section.examples.some((example) => typeof example !== 'string'))) return invalid(`Section ${i + 1} examples must be an array of strings.`);
      for (const field of ['description', 'explanation', 'code', 'output', 'language']) if (section[field] !== undefined && typeof section[field] !== 'string') return invalid(`Section ${i + 1} ${field} must be text.`);
    }
  }

  try {
    const store = readStore();
    const result = await generatePptx({ title: content.title, questions: content.questions || [], data: content, mode, explanationLanguage });
    const presentation = {
      id: uuidv4(),
      userId: req.user.id,
      title,
      filePath: result.filePath,
      fileName: result.fileName,
      questionCount: result.questionCount,
      sectionCount: result.sectionCount,
      createdAt: new Date().toISOString(),
    };
    store.presentations.push(presentation);
    writeStore(store);
    res.status(201).json({ success: true, data: presentation });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'PPT_GENERATION_FAILED', message: error.message || 'Failed to generate PPT.' } });
  }
});

app.get('/api/presentations', requireAuth, (req, res) => {
  
  const store = readStore();
  res.json({ success: true, data: store.presentations.filter((entry) => entry.userId === req.user.id) });
});

app.post('/api/videos/generate', requireAuth, async (req, res) => {
  const { title, questions = [], duration = 8, explanationLanguage = 'english', voiceSelection = 'edge:default' } = req.body || {};
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_VIDEO', message: 'Title and at least one question are required.' } });
  }
  if (!['english', 'hindi', 'hinglish'].includes(explanationLanguage)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_EXPLANATION_LANGUAGE', message: 'Explanation language must be English, Hindi, or Hinglish.' } });
  }
  const builtInVoiceIds = ['edge:default', 'edge:en-IN-NeerjaNeural', 'edge:en-IN-PrabhatNeural', 'edge:hi-IN-SwaraNeural'];
  if (typeof voiceSelection !== 'string' || (!builtInVoiceIds.includes(voiceSelection) && !/^custom:[a-f\d]{32}$/.test(voiceSelection))) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TTS_VOICE', message: 'Choose a valid narration voice.' } });
  }

  const jobId = uuidv4();
  const job = {
    id: jobId,
    userId: req.user.id,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    message: 'Video queued for generation.',
    video: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  videoJobs.set(jobId, job);

  setImmediate(async () => {
    job.status = 'processing';
    job.stage = 'narration';
    job.message = 'Preparing narration.';
    try {
      const result = await generateVideo({
        title,
        questions,
        duration,
        explanationLanguage,
        voiceSelection,
        ownerId: req.user.id,
        onProgress: (update) => Object.assign(job, update),
      });
      const store = readStore();
      const video = {
        id: uuidv4(),
        userId: req.user.id,
        title,
        filePath: result.filePath,
        fileName: result.fileName,
        subtitleFilePath: result.subtitleFilePath,
        subtitleFileName: result.subtitleFileName,
        metadataFilePath: result.metadataFilePath,
        metadataFileName: result.metadataFileName,
        questionCount: result.questionCount,
        duration: result.duration,
        audioVoice: result.audioVoice,
        createdAt: new Date().toISOString(),
      };
      store.videos.push(video);
      writeStore(store);
      job.video = video;
      job.status = 'completed';
      job.stage = 'completed';
      job.progress = 100;
      job.message = 'Video is ready.';
    } catch (error) {
      const message = error?.message || 'Failed to generate video.';
      job.status = 'failed';
      job.stage = 'failed';
      job.error = message;
      job.message = message;
    }
  });

  res.status(202).json({ success: true, data: { jobId, status: job.status } });
});

app.get('/api/videos', requireAuth, (req, res) => {
  const store = readStore();
  const videos = (store.videos || [])
    .filter((entry) => entry.userId === req.user.id)
    .sort((first, second) => Date.parse(second.createdAt || '') - Date.parse(first.createdAt || ''));
  res.json({ success: true, data: videos });
});

app.delete('/api/videos/:id', requireAuth, (req, res) => {
  const store = readStore();
  const videoIndex = (store.videos || []).findIndex((entry) => entry.id === req.params.id && entry.userId === req.user.id);
  if (videoIndex === -1) {
    return res.status(404).json({ success: false, error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
  }

  const [video] = store.videos.splice(videoIndex, 1);
  const videosDirectory = path.resolve(process.cwd(), config.storagePath, 'videos');
  const assetPaths = [video.filePath, video.subtitleFilePath, video.metadataFilePath].filter(Boolean);
  for (const assetPath of assetPaths) {
    const absolutePath = path.resolve(assetPath);
    const relativePath = path.relative(videosDirectory, absolutePath);
    if (relativePath && !relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath)) {
      fs.rmSync(absolutePath, { force: true });
    }
  }

  writeStore(store);
  return res.json({ success: true, data: { id: video.id } });
});

app.get('/api/presentations/:id', requireAuth, (req, res) => {
  const store = readStore();
  const presentation = store.presentations.find((entry) => entry.id === req.params.id && entry.userId === req.user.id);
  if (!presentation) {
    return res.status(404).json({ success: false, error: { code: 'PRESENTATION_NOT_FOUND', message: 'Presentation not found.' } });
  }

  return res.json({ success: true, data: presentation });
});

app.get('/api/presentations/:id/download', requireAuth, (req, res) => {
  console.log("inside the api/presentation/download");
  const store = readStore();
  const presentation = store.presentations.find((entry) => entry.id === req.params.id && entry.userId === req.user.id);
  if (!presentation) {
    return res.status(404).json({ success: false, error: { code: 'PRESENTATION_NOT_FOUND', message: 'Presentation not found.' } });
  }

  const filePath = presentation.filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Generated presentation file is missing.' } });
  }

  return res.download(filePath, presentation.fileName || 'presentation.pptx');
});

app.get('/api/videos/:id/download', requireAuth, (req, res) => {
  const store = readStore();
  const video = (store.videos || []).find((entry) => entry.id === req.params.id && entry.userId === req.user.id);
  if (!video) {
    return res.status(404).json({ success: false, error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
  }

  const filePath = video.filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Generated video file is missing.' } });
  }

  res.setHeader('Content-Type', 'video/mp4');
  return res.download(filePath, video.fileName || 'video.mp4');
});

app.get('/api/videos/:id/download-srt', requireAuth, (req, res) => {
  const store = readStore();
  const video = (store.videos || []).find((entry) => entry.id === req.params.id && entry.userId === req.user.id);
  if (!video) {
    return res.status(404).json({ success: false, error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
  }

  const filePath = video.subtitleFilePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Generated subtitle file is missing.' } });
  }

  return res.download(filePath, video.subtitleFileName || 'video.srt');
});

app.get('/api/videos/:id/download-metadata', requireAuth, (req, res) => {
  const store = readStore();
  const video = (store.videos || []).find((entry) => entry.id === req.params.id && entry.userId === req.user.id);
  if (!video) {
    return res.status(404).json({ success: false, error: { code: 'VIDEO_NOT_FOUND', message: 'Video not found.' } });
  }

  const filePath = video.metadataFilePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Generated metadata file is missing.' } });
  }

  return res.download(filePath, video.metadataFileName || 'video-metadata.json');
});

app.get('/api/jobs/:id', requireAuth, (req, res) => {
  const job = videoJobs.get(req.params.id);
  if (!job || job.userId !== req.user.id) {
    return res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Video generation job not found.' } });
  }
  res.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      video: job.video,
      error: job.error,
    },
  });
});

const builtInTtsVoices = [
  { id: 'edge:default', name: 'Default neural voices (language-aware)' },
  { id: 'edge:en-IN-NeerjaNeural', name: 'Neerja (English, female)' },
  { id: 'edge:en-IN-PrabhatNeural', name: 'Prabhat (English, male)' },
  { id: 'edge:hi-IN-SwaraNeural', name: 'Swara (Hindi, female)' },
];

app.get('/api/tts/voices', requireAuth, async (req, res) => {
  const customVoices = listVoiceProfiles(req.user.id);
  const serviceState = await ensureVoiceService();
  res.json({
    success: true,
    data: {
      serviceAvailable: serviceState.available,
      serviceMessage: serviceState.message,
      voices: [
        ...builtInTtsVoices,
        ...customVoices.map((voice) => ({
          id: `custom:${voice.id}`,
          name: `${voice.name} (My voice)`,
          sampleCount: voice.sample_count || 0,
          sampleSections: voice.sample_sections || [],
        })),
      ],
    },
  });
});

app.post('/api/voice-model/voices', requireAuth, express.raw({ type: 'audio/wav', limit: '25mb' }), async (req, res) => {
  const name = String(req.query.name || '').trim();
  const language = String(req.query.language || 'en-IN');
  const subject = String(req.query.subject || 'general');
  const transcript = String(req.query.transcript || '');
  const consent = req.get('x-voice-consent') === 'true';
  if (!name || name.length > 60 || !['en-IN', 'hi-IN'].includes(language)
    || !/^[a-z-]{1,100}$/.test(subject) || transcript.length > 5000
    || !consent || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_VOICE_SAMPLE', message: 'Provide a name, a WAV sample, and confirmation that you have permission to use the voice.' },
    });
  }

  try {
    const voice = createVoiceProfile({ ownerId: req.user.id, name, language, subject, transcript, audio: req.body });
    res.status(201).json({ success: true, data: voice });
  } catch (error) {
    const status = error.message.includes('valid WAV') ? 400 : 500;
    res.status(status).json({ success: false, error: { code: 'VOICE_PROFILE_CREATE_FAILED', message: error.message || 'Could not save the microphone recording.' } });
  }
});

app.post('/api/voice-model/voices/:id/samples', requireAuth, express.raw({ type: 'audio/wav', limit: '25mb' }), async (req, res) => {
  const { language, subject, transcript = '' } = req.query;
  if (!/^[a-f\d]{32}$/.test(req.params.id)
    || !['en-IN', 'hi-IN'].includes(language)
    || typeof subject !== 'string'
    || !/^[a-z-]{1,100}$/.test(subject)
    || typeof transcript !== 'string'
    || transcript.length > 5000
    || req.get('x-voice-consent') !== 'true'
    || !Buffer.isBuffer(req.body)
    || req.body.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_VOICE_SAMPLE', message: 'Provide a valid WAV sample, language, subject, transcript, and permission confirmation.' } });
  }

  try {
    const sample = addVoiceProfileSample({
      ownerId: req.user.id,
      voiceId: req.params.id,
      language,
      subject,
      transcript,
      audio: req.body,
    });
    res.status(201).json({ success: true, data: sample });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : error.message.includes('valid WAV') ? 400 : 500;
    res.status(status).json({ success: false, error: { code: 'VOICE_SAMPLE_FAILED', message: error.message || 'Could not add this recording.' } });
  }
});

app.delete('/api/voice-model/voices/:id', requireAuth, async (req, res) => {
  if (!/^[a-f\d]{32}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_VOICE_ID', message: 'Choose a valid custom voice.' } });
  }

  try {
    const voice = deleteVoiceProfile({ ownerId: req.user.id, voiceId: req.params.id });
    res.json({ success: true, data: voice });
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: { code: 'VOICE_DELETE_FAILED', message: error.message || 'Could not delete the voice.' } });
  }
});

app.post('/api/tts/preview', requireAuth, (req, res) => {
  const { text = '', voice = 'Hindi Female' } = req.body || {};
  if (!text.trim()) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TTS_TEXT', message: 'TTS text is required.' } });
  }

  res.json({ success: true, data: { preview: `${voice}: ${text.slice(0, 60)}`, duration: Math.max(3, Math.ceil(text.length / 18)) } });
});

app.post('/api/narration/generate', requireAuth, (req, res) => {
  const { title, questions = [] } = req.body || {};

  if (!title) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TITLE', message: 'Title is required.' } });
  }

  const script = generateNarrationScript({ title, questions });
  res.json({ success: true, data: script });
});

const server = app.listen(config.port, () => {
  console.log(`MCQ Video Studio API running on http://localhost:${config.port}`);
});

export { app, server };
