import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { isIP } from 'node:net';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { readStore, writeStore } from './utils/store.js';
import { requireAuth } from './middleware/auth.js';
import { generatePptx } from './services/pptGenerator.js';
import { generateVideo } from './services/videoGenerator.js';
import { generateNarrationScript } from './services/scriptGenerator.js';
import { ensureVoiceService } from './services/voiceService.js';
import { addVoiceProfileSample, createVoiceProfile, deleteVoiceProfile, listVoiceProfiles } from './services/voiceProfiles.js';
import { fetchJamendoTrackDownload, fetchJamendoTrackPreview, JamendoMusicError, searchJamendoTracks } from './services/jamendoMusic.js';

const app = express();
const videoJobs = new Map();
const jamendoDownloadJobs = new Map();
const syllabusFileUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      const directory = path.join(config.storageDirectory, 'syllabus-files', req.user.id);
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    },
    filename(req, file, callback) {
      const extension = path.extname(file.originalname).toLowerCase().slice(0, 12).replace(/[^a-z0-9.]/g, '');
      callback(null, `${uuidv4()}${extension}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
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

app.get('/api/syllabus-tracker', requireAuth, (req, res) => {
  const store = readStore();
  const tracker = store.syllabusTrackers.find((entry) => entry.userId === req.user.id);
  res.json({ success: true, data: tracker?.data || null });
});

app.get('/api/current-affairs', requireAuth, (req, res) => {
  const store = readStore();
  const days = store.currentAffairs
    .filter((entry) => entry.userId === req.user.id)
    .sort((first, second) => second.date.localeCompare(first.date));
  res.json({ success: true, data: days });
});

app.post('/api/current-affairs/days', requireAuth, (req, res) => {
  const { date, sourceName, headlines } = req.body || {};
  const parsedDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_CURRENT_AFFAIRS_DATE', message: 'Choose a valid calendar date.' } });
  }
  if (typeof sourceName !== 'string' || !sourceName.trim() || sourceName.length > 180) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_CURRENT_AFFAIRS_SOURCE', message: 'Provide a source filename no longer than 180 characters.' } });
  }
  if (!Array.isArray(headlines) || headlines.length < 1 || headlines.length > 100
    || headlines.some((headline) => typeof headline !== 'string' || !headline.trim() || headline.length > 5000)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_CURRENT_AFFAIRS_HEADLINES', message: 'Provide 1 to 100 non-empty headlines, each no longer than 5,000 characters.' } });
  }

  const uniqueHeadlines = [...new Set(headlines.map((headline) => headline.trim()))];
  const store = readStore();
  const existingIndex = store.currentAffairs.findIndex((entry) => (
    entry.userId === req.user.id && entry.date === date
  ));
  const existingDay = existingIndex >= 0 ? store.currentAffairs[existingIndex] : null;
  const day = {
    id: existingDay?.id || uuidv4(),
    userId: req.user.id,
    date,
    sourceName: path.basename(sourceName.trim()).slice(0, 180),
    headlines: uniqueHeadlines,
    createdAt: existingDay?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) store.currentAffairs[existingIndex] = day;
  else store.currentAffairs.push(day);
  writeStore(store);
  res.status(existingIndex >= 0 ? 200 : 201).json({ success: true, data: day });
});

app.delete('/api/current-affairs/days/:date', requireAuth, (req, res) => {
  const store = readStore();
  const entryIndex = store.currentAffairs.findIndex((entry) => (
    entry.userId === req.user.id && entry.date === req.params.date
  ));
  if (entryIndex < 0) {
    return res.status(404).json({ success: false, error: { code: 'CURRENT_AFFAIRS_DAY_NOT_FOUND', message: 'No saved current affairs were found for that date.' } });
  }
  store.currentAffairs.splice(entryIndex, 1);
  writeStore(store);
  return res.json({ success: true });
});

function getSyllabusFileReferences(data) {
  return (data?.exams || []).flatMap((exam) => exam.subjects || [])
    .flatMap((subject) => subject.chapters || [])
    .flatMap((chapter) => [
      ...(Array.isArray(chapter.files) ? chapter.files : []),
      ...Object.values(chapter.taskFiles || {}).flatMap((files) => Array.isArray(files) ? files : []),
      ...(chapter.classes || []).flatMap((noteClass) => (
        Object.values(noteClass.taskFiles || {}).flatMap((files) => Array.isArray(files) ? files : [])
      )),
    ])
    .filter(Boolean);
}

function removeUnreferencedSyllabusFiles(previousData, nextData, userId) {
  const retainedFiles = new Set(getSyllabusFileReferences(nextData).map((file) => file.storageName));
  const userDirectory = path.join(config.storageDirectory, 'syllabus-files', userId);
  for (const file of getSyllabusFileReferences(previousData)) {
    if (!retainedFiles.has(file.storageName) && /^[a-f\d-]{36}(?:\.[a-z\d]{1,11})?$/i.test(file.storageName)) {
      fs.rmSync(path.join(userDirectory, file.storageName), { force: true });
    }
  }
}

function findSyllabusChapter(req) {
  const store = readStore();
  const tracker = store.syllabusTrackers.find((entry) => entry.userId === req.user.id);
  const chapter = tracker?.data.exams
    .flatMap((exam) => exam.subjects)
    .flatMap((subject) => subject.chapters)
    .find((entry) => entry.id === req.params.chapterId);
  return { store, tracker, chapter };
}

function isLoopbackAddress(address = '') {
  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address;
  const version = isIP(normalized);
  return version === 4 ? normalized.startsWith('127.') : normalized === '::1';
}

function isValidSyllabusQuestionSet(questionSet) {
  return Boolean(questionSet
    && typeof questionSet.id === 'string' && questionSet.id.length > 0 && questionSet.id.length <= 100
    && typeof questionSet.title === 'string'
    && questionSet.title.trim().length > 0 && questionSet.title.length <= 160
    && typeof questionSet.sourceName === 'string'
    && questionSet.sourceName.trim().length > 0 && questionSet.sourceName.length <= 180
    && Array.isArray(questionSet.questions)
    && questionSet.questions.length > 0 && questionSet.questions.length <= 1000
    && questionSet.questions.every((question) => question
      && typeof question.question === 'string' && question.question.length > 0 && question.question.length <= 10000
      && ['optionA', 'optionB', 'optionC', 'optionD'].every((key) => (
        typeof question[key] === 'string' && question[key].length > 0 && question[key].length <= 5000
      ))
      && typeof question.correctAnswer === 'string'
      && /^[ABCD]$/.test(question.correctAnswer)
      && ['explanation', 'hindiExplanation', 'hinglishExplanation'].every((key) => (
        typeof question[key] === 'string' && question[key].length <= 10000
      ))
      && Array.isArray(question.keyDetails)
      && question.keyDetails.length <= 50
      && question.keyDetails.every((detail) => typeof detail === 'string' && detail.length <= 1000)));
}

function isValidSyllabusChapter(chapter) {
  if (!chapter || typeof chapter.id !== 'string' || typeof chapter.name !== 'string'
    || chapter.name.length > 200 || (chapter.notes !== undefined && (typeof chapter.notes !== 'string' || chapter.notes.length > 70000))
    || (chapter.tests !== undefined && (!Array.isArray(chapter.tests) || chapter.tests.length > 100))
    || (chapter.files !== undefined && (!Array.isArray(chapter.files) || chapter.files.length > 30))
    || (chapter.localFiles !== undefined && (!Array.isArray(chapter.localFiles) || chapter.localFiles.length > 100))
    || (chapter.classes !== undefined && (!Array.isArray(chapter.classes) || chapter.classes.length > 100))
    || (chapter.taskFiles !== undefined && (!chapter.taskFiles || typeof chapter.taskFiles !== 'object' || Array.isArray(chapter.taskFiles)))
    || (chapter.mcqQuestionSet !== undefined && (!chapter.mcqQuestionSet
      || typeof chapter.mcqQuestionSet !== 'object' || Array.isArray(chapter.mcqQuestionSet)))
    || (chapter.questionSetsBySection !== undefined && (!chapter.questionSetsBySection
      || typeof chapter.questionSetsBySection !== 'object' || Array.isArray(chapter.questionSetsBySection)))) {
    return false;
  }

  const classesAreValid = (chapter.classes || []).every((noteClass) => noteClass
    && typeof noteClass.id === 'string' && noteClass.id.length > 0 && noteClass.id.length <= 100
    && typeof noteClass.title === 'string' && noteClass.title.length <= 100
    && typeof noteClass.notes === 'string' && noteClass.notes.length <= 70000
    && (noteClass.completed === undefined || (
      noteClass.completed && typeof noteClass.completed === 'object' && !Array.isArray(noteClass.completed)
      && Object.values(noteClass.completed).every((value) => typeof value === 'boolean')
    ))
    && (noteClass.taskFiles === undefined || (
      noteClass.taskFiles && typeof noteClass.taskFiles === 'object' && !Array.isArray(noteClass.taskFiles)
      && Object.entries(noteClass.taskFiles).every(([taskId, files]) => (
        ['notes', 'dpp'].includes(taskId)
        && Array.isArray(files)
        && files.length <= 30
        && files.every((file) => file
          && /^[a-f\d-]{36}$/i.test(file.id)
          && typeof file.name === 'string' && file.name.length <= 180
          && /^[a-f\d-]{36}(?:\.[a-z\d]{1,11})?$/i.test(file.storageName)
          && Number.isFinite(file.size) && file.size >= 0
          && typeof file.mimeType === 'string')
      ))
    )));
  const testsAreValid = (chapter.tests || []).every((test) => {
    if (!test || typeof test.title !== 'string' || !test.title.trim() || test.title.length > 100
      || !Number.isFinite(test.obtained) || !Number.isFinite(test.total)
      || test.obtained < 0 || test.total <= 0 || test.obtained > test.total) {
      return false;
    }
    if (['correct', 'wrong', 'unanswered', 'timeSeconds'].some((key) => (
      test[key] !== undefined && (!Number.isFinite(test[key]) || test[key] < 0)
    ))) {
      return false;
    }
    if (!test.link) return true;
    try {
      return ['http:', 'https:'].includes(new URL(test.link).protocol);
    } catch {
      return false;
    }
  });
  const filesAreValid = (chapter.files || []).every((file) => file
    && /^[a-f\d-]{36}$/i.test(file.id)
    && typeof file.name === 'string' && file.name.length <= 180
    && /^[a-f\d-]{36}(?:\.[a-z\d]{1,11})?$/i.test(file.storageName)
    && Number.isFinite(file.size) && file.size >= 0
    && typeof file.mimeType === 'string');
  const localFilesAreValid = (chapter.localFiles || []).every((file) => file
    && typeof file.id === 'string' && file.id.length > 0 && file.id.length <= 100
    && typeof file.name === 'string' && file.name.trim().length > 0 && file.name.length <= 180
    && typeof file.path === 'string' && file.path.length <= 1024 && path.win32.isAbsolute(file.path)
    && ['.pdf', '.ppt', '.pptx'].includes(path.win32.extname(file.path).toLowerCase())
    && (file.taskId === undefined || ['notes', 'dpp', 'mcq', 'lucent', 'previousYear'].includes(file.taskId))
    && (file.classId === undefined || (
      typeof file.classId === 'string' && file.classId.length > 0 && file.classId.length <= 100
      && ['notes', 'dpp'].includes(file.taskId)
      && (chapter.classes || []).some((noteClass) => noteClass.id === file.classId)
    )));
  const taskFilesAreValid = chapter.taskFiles === undefined || (
    chapter.taskFiles && typeof chapter.taskFiles === 'object' && !Array.isArray(chapter.taskFiles)
    && Object.entries(chapter.taskFiles).every(([taskId, files]) => (
      ['notes', 'dpp', 'mcq', 'lucent', 'previousYear'].includes(taskId)
      && Array.isArray(files)
      && files.length <= 30
      && files.every((file) => file
        && /^[a-f\d-]{36}$/i.test(file.id)
        && typeof file.name === 'string' && file.name.length <= 180
        && /^[a-f\d-]{36}(?:\.[a-z\d]{1,11})?$/i.test(file.storageName)
        && Number.isFinite(file.size) && file.size >= 0
        && typeof file.mimeType === 'string')
    ))
  );
  const mcqQuestionSetIsValid = chapter.mcqQuestionSet === undefined
    || isValidSyllabusQuestionSet({ id: 'legacy-mcq', ...chapter.mcqQuestionSet });
  const questionSetsBySectionIsValid = chapter.questionSetsBySection === undefined || (
    Object.entries(chapter.questionSetsBySection).every(([sectionId, questionSets]) => (
      ['mcq', 'lucent', 'previousYear'].includes(sectionId)
      && Array.isArray(questionSets)
      && questionSets.length <= 30
      && questionSets.every(isValidSyllabusQuestionSet)
    ))
  );
  return classesAreValid && testsAreValid && filesAreValid && localFilesAreValid && taskFilesAreValid
    && mcqQuestionSetIsValid && questionSetsBySectionIsValid;
}

app.post('/api/syllabus-tracker/chapters/:chapterId/files', requireAuth, (req, res, next) => {
  const { tracker, chapter } = findSyllabusChapter(req);
  if (!tracker || !chapter) {
    return res.status(404).json({ success: false, error: { code: 'SYLLABUS_CHAPTER_NOT_FOUND', message: 'Syllabus chapter not found.' } });
  }

  return syllabusFileUpload.single('file')(req, res, (error) => {
    if (error) {
      const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        success: false,
        error: {
          code: error.code === 'LIMIT_FILE_SIZE' ? 'SYLLABUS_FILE_TOO_LARGE' : 'SYLLABUS_FILE_UPLOAD_FAILED',
          message: error.code === 'LIMIT_FILE_SIZE' ? 'Chapter files must be 25 MB or smaller.' : 'Could not upload this chapter file.',
        },
      });
    }
    return next();
  });
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { code: 'SYLLABUS_FILE_REQUIRED', message: 'Choose a file to upload.' } });
  }

  const taskId = req.body.taskId || '';
  const classId = req.body.classId || '';
  if (taskId && !['notes', 'dpp', 'mcq', 'lucent', 'previousYear'].includes(taskId)) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ success: false, error: { code: 'INVALID_SYLLABUS_TASK', message: 'Choose a supported chapter study task.' } });
  }
  const isClassNoteImage = classId && taskId === 'notes'
    && /\.(png|jpe?g|webp|gif)$/i.test(req.file.originalname);
  if (taskId && !/\.(pdf|pptx)$/i.test(req.file.originalname) && !isClassNoteImage) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ success: false, error: { code: 'UNSUPPORTED_STUDY_FILE', message: 'Study task attachments must be PDF or PowerPoint (.pptx) files. Class notes also support PNG, JPEG, WebP, and GIF images.' } });
  }

  const { store, tracker, chapter } = findSyllabusChapter(req);
  if (!tracker || !chapter) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(404).json({ success: false, error: { code: 'SYLLABUS_CHAPTER_NOT_FOUND', message: 'Syllabus chapter not found.' } });
  }
  const noteClass = classId ? (chapter.classes || []).find((entry) => entry.id === classId) : null;
  if ((classId && (!noteClass || !['notes', 'dpp'].includes(taskId)))
    || (!taskId && classId)) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ success: false, error: { code: 'INVALID_SYLLABUS_CLASS_TASK', message: 'Choose a valid class notes or DPP task.' } });
  }
  const existingFiles = classId
    ? noteClass.taskFiles?.[taskId] || []
    : taskId ? chapter.taskFiles?.[taskId] || [] : chapter.files || [];
  const normalizedUploadName = String(req.file.originalname || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const duplicateFile = existingFiles.find((entry) => (
    String(entry.name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedUploadName
    && Number(entry.size) === Number(req.file.size)
  ));
  if (duplicateFile) {
    fs.rmSync(req.file.path, { force: true });
    return res.json({ success: true, data: duplicateFile, duplicate: true });
  }
  if (existingFiles.length >= 30) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ success: false, error: { code: 'SYLLABUS_FILE_LIMIT', message: 'A study section can have at most 30 files.' } });
  }

  const file = {
    id: uuidv4(),
    name: path.basename(req.file.originalname).replace(/[\r\n"]/g, '_').slice(0, 180) || 'Study material',
    storageName: req.file.filename,
    size: req.file.size,
    mimeType: req.file.mimetype,
    createdAt: new Date().toISOString(),
  };
  if (classId) {
    noteClass.taskFiles = noteClass.taskFiles || {};
    noteClass.taskFiles[taskId] = [...(noteClass.taskFiles[taskId] || []), file];
  } else if (taskId) {
    chapter.taskFiles = chapter.taskFiles || {};
    chapter.taskFiles[taskId] = [...(chapter.taskFiles[taskId] || []), file];
  } else {
    chapter.files = [...(chapter.files || []), file];
  }
  tracker.updatedAt = new Date().toISOString();
  writeStore(store);
  res.status(201).json({ success: true, data: file });
});

app.get('/api/syllabus-tracker/files/:fileId', requireAuth, (req, res) => {
  const store = readStore();
  const tracker = store.syllabusTrackers.find((entry) => entry.userId === req.user.id);
  const file = getSyllabusFileReferences(tracker?.data).find((entry) => entry.id === req.params.fileId);
  if (!file || !/^[a-f\d-]{36}(?:\.[a-z\d]{1,11})?$/i.test(file.storageName)) {
    return res.status(404).json({ success: false, error: { code: 'SYLLABUS_FILE_NOT_FOUND', message: 'Chapter file not found.' } });
  }

  const filePath = path.join(config.storageDirectory, 'syllabus-files', req.user.id, file.storageName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { code: 'SYLLABUS_FILE_MISSING', message: 'The saved chapter file is missing.' } });
  }
  return res.download(filePath, file.name);
});

app.post('/api/syllabus-tracker/open-file/:fileId', requireAuth, (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(403).json({ success: false, error: { code: 'LOCAL_DESKTOP_ONLY', message: 'Opening files in desktop apps is available only from this computer.' } });
  }

  const store = readStore();
  const tracker = store.syllabusTrackers.find((entry) => entry.userId === req.user.id);
  const file = getSyllabusFileReferences(tracker?.data).find((entry) => entry.id === req.params.fileId);
  const fileExtension = path.extname(file?.name || '').toLowerCase();
  if (!file || !/^[a-f\d-]{36}(?:\.[a-z\d]{1,11})?$/i.test(file.storageName)
    || !['.pdf', '.ppt', '.pptx'].includes(fileExtension)) {
    return res.status(404).json({ success: false, error: { code: 'STUDY_FILE_NOT_FOUND', message: 'Study file not found.' } });
  }

  const filePath = path.join(config.storageDirectory, 'syllabus-files', req.user.id, file.storageName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { code: 'SYLLABUS_FILE_MISSING', message: 'The saved study file is missing.' } });
  }
  if (process.platform !== 'win32') {
    return res.status(501).json({ success: false, error: { code: 'DESKTOP_OPEN_UNSUPPORTED', message: 'Opening study files in desktop apps is supported by the Windows desktop helper only.' } });
  }

  if (fileExtension === '.pdf') {
    const acrobatPath = findAcrobatExecutable();
    if (!acrobatPath) {
      return res.status(503).json({ success: false, error: { code: 'ACROBAT_NOT_FOUND', message: 'Adobe Acrobat was not found. Install Acrobat or Acrobat Reader to open PDFs directly.' } });
    }
    return launchDesktopFile(acrobatPath, res, [filePath]);
  }

  return launchDesktopFile(filePath, res);
});

app.post('/api/syllabus-tracker/open-local-file', requireAuth, (req, res) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(403).json({ success: false, error: { code: 'LOCAL_DESKTOP_ONLY', message: 'Opening local files is available only from this computer.' } });
  }
  if (process.platform !== 'win32') {
    return res.status(501).json({ success: false, error: { code: 'DESKTOP_OPEN_UNSUPPORTED', message: 'Opening local files is supported by the Windows desktop helper only.' } });
  }

  const filePath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
  if (filePath.length > 1024 || !path.win32.isAbsolute(filePath)
    || !['.pdf', '.ppt', '.pptx'].includes(path.win32.extname(filePath).toLowerCase())) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_LOCAL_STUDY_FILE', message: 'Choose an absolute path to a PDF or PowerPoint file.' } });
  }

  let localPath;
  try {
    localPath = fs.realpathSync(filePath);
    if (!fs.statSync(localPath).isFile()
      || !['.pdf', '.ppt', '.pptx'].includes(path.win32.extname(localPath).toLowerCase())) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_LOCAL_STUDY_FILE', message: 'Choose a PDF or PowerPoint file.' } });
    }
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return res.status(404).json({ success: false, error: { code: 'LOCAL_STUDY_FILE_MISSING', message: 'The saved file path is not available on this computer.' } });
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return res.status(403).json({ success: false, error: { code: 'LOCAL_STUDY_FILE_ACCESS_DENIED', message: 'Windows denied access to this file.' } });
    }
    throw error;
  }

  return launchDesktopFile(localPath, res);
});

function findAcrobatExecutable() {
  const registeredPaths = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Acrobat.exe',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcroRd32.exe',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Acrobat.exe',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcroRd32.exe',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Acrobat.exe',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\AcroRd32.exe',
  ];

  for (const registryPath of registeredPaths) {
    try {
      const output = execFileSync('reg.exe', ['query', registryPath, '/ve'], {
        encoding: 'utf8',
        windowsHide: true,
      });
      const executablePath = output.match(/REG_SZ\s+(.+)/i)?.[1].trim().replace(/^"(.*)"$/, '$1');
      if (executablePath && fs.existsSync(executablePath)) return executablePath;
    } catch (error) {
      if (error.status !== 1 && error.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

function launchDesktopFile(executable, res, args = [executable]) {
  const launcher = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: true });
  launcher.once('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: 'DESKTOP_OPEN_FAILED', message: 'Windows could not open this file. Check the default app for its file type.' } });
    }
  });
  launcher.once('spawn', () => {
    launcher.unref();
    if (!res.headersSent) res.json({ success: true });
  });
}

app.delete('/api/syllabus-tracker/chapters/:chapterId/files/:fileId', requireAuth, (req, res) => {
  const { store, tracker, chapter } = findSyllabusChapter(req);
  const file = getSyllabusFileReferences({ exams: [{ subjects: [{ chapters: chapter ? [chapter] : [] }] }] })
    .find((entry) => entry.id === req.params.fileId);
  if (!tracker || !chapter) {
    return res.status(404).json({ success: false, error: { code: 'SYLLABUS_FILE_NOT_FOUND', message: 'Chapter file not found.' } });
  }
  if (!file) return res.json({ success: true });
  if (!/^[a-f\d-]{36}(?:\.[a-z\d]{1,11})?$/i.test(file.storageName)) {
    return res.status(404).json({ success: false, error: { code: 'SYLLABUS_FILE_NOT_FOUND', message: 'Chapter file not found.' } });
  }

  chapter.files = (chapter.files || []).filter((entry) => entry.id !== file.id);
  chapter.taskFiles = Object.fromEntries(Object.entries(chapter.taskFiles || {}).map(([taskId, files]) => (
    [taskId, files.filter((entry) => entry.id !== file.id)]
  )));
  chapter.classes = (chapter.classes || []).map((noteClass) => ({
    ...noteClass,
    taskFiles: Object.fromEntries(Object.entries(noteClass.taskFiles || {}).map(([taskId, files]) => (
      [taskId, files.filter((entry) => entry.id !== file.id)]
    ))),
  }));
  tracker.updatedAt = new Date().toISOString();
  writeStore(store);
  const stillReferenced = getSyllabusFileReferences(tracker.data).some((entry) => entry.storageName === file.storageName);
  if (!stillReferenced) fs.rmSync(path.join(config.storageDirectory, 'syllabus-files', req.user.id, file.storageName), { force: true });
  return res.json({ success: true });
});

app.put('/api/syllabus-tracker', requireAuth, (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data.exams) || data.exams.length > 10
    || (data.globalStudySeconds !== undefined && (!Number.isFinite(data.globalStudySeconds) || data.globalStudySeconds < 0))
    || (data.globalTimerStartedAt !== undefined && data.globalTimerStartedAt !== null
      && (typeof data.globalTimerStartedAt !== 'string' || !Number.isFinite(Date.parse(data.globalTimerStartedAt))))
    || data.exams.some((exam) => !exam || typeof exam.id !== 'string' || typeof exam.name !== 'string'
      || !Array.isArray(exam.subjects) || exam.subjects.length > 100
      || exam.subjects.some((subject) => !subject || typeof subject.id !== 'string'
        || typeof subject.name !== 'string'
        || (subject.subsections !== undefined && (!Array.isArray(subject.subsections) || subject.subsections.length > 100
          || subject.subsections.some((subsection) => typeof subsection !== 'string'
            || !subsection.trim() || subsection.length > 100)))
        || !Array.isArray(subject.chapters) || subject.chapters.length > 500
        || subject.chapters.some((chapter) => !isValidSyllabusChapter(chapter))))) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_SYLLABUS_TRACKER', message: 'Provide a valid syllabus tracker with exam sections, subjects and chapters.' } });
  }

  const store = readStore();
  const index = store.syllabusTrackers.findIndex((entry) => entry.userId === req.user.id);
  const previousData = index >= 0 ? store.syllabusTrackers[index].data : null;
  const tracker = { userId: req.user.id, data, updatedAt: new Date().toISOString() };
  if (index >= 0) store.syllabusTrackers[index] = tracker;
  else store.syllabusTrackers.push(tracker);
  writeStore(store);
  removeUnreferencedSyllabusFiles(previousData, data, req.user.id);
  res.json({ success: true, data });
});

app.get('/api/reels/music', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const genre = String(req.query.genre || 'popular');
  const search = String(req.query.search || '');
  if (search.length > 80) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_MUSIC_SEARCH', message: 'Search must be 80 characters or fewer.' } });
  }

  try {
    const tracks = await searchJamendoTracks({
      clientId: config.jamendoClientId,
      genre,
      search,
    });
    return res.json({ success: true, data: tracks });
  } catch (error) {
    const musicError = error instanceof JamendoMusicError
      ? error
      : new JamendoMusicError('Could not load music from Jamendo. Please try again later.', 'MUSIC_PROVIDER_FAILED');
    const status = musicError.code === 'INVALID_MUSIC_CATEGORY'
      ? 400
      : musicError.code === 'MUSIC_NOT_CONFIGURED' || musicError.code === 'INVALID_JAMENDO_CLIENT_ID'
        ? 503
        : 502;
    return res.status(status).json({
      success: false,
      error: {
        code: musicError.code,
        message: musicError.message,
      },
    });
  }
});

app.get('/api/reels/music/:trackId/preview', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!/^\d+$/.test(req.params.trackId)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_MUSIC_TRACK', message: 'Choose a valid Jamendo track.' } });
  }

  try {
    const preview = await fetchJamendoTrackPreview({
      clientId: config.jamendoClientId,
      trackId: req.params.trackId,
      previewUrl: String(req.query.url || ''),
      range: req.get('Range') || '',
    });
    res.status(preview.status);
    res.set('Content-Type', preview.headers.get('content-type') || 'audio/mpeg');
    for (const headerName of ['accept-ranges', 'content-length', 'content-range']) {
      const value = preview.headers.get(headerName);
      if (value) res.set(headerName, value);
    }
    if (!preview.body) return res.end();
    await pipeline(Readable.fromWeb(preview.body), res);
    return undefined;
  } catch (error) {
    const musicError = error instanceof JamendoMusicError
      ? error
      : new JamendoMusicError('Could not load this Jamendo audio preview.', 'MUSIC_PREVIEW_FAILED');
    const status = musicError.code === 'MUSIC_NOT_CONFIGURED' || musicError.code === 'INVALID_JAMENDO_CLIENT_ID'
      ? 503
      : musicError.code === 'MUSIC_TRACK_NOT_FOUND' || musicError.code === 'MUSIC_PREVIEWS_UNAVAILABLE'
        ? 404
        : musicError.code === 'INVALID_MUSIC_TRACK' || musicError.code === 'INVALID_MUSIC_PREVIEW_URL'
          ? 400
          : 502;
    if (res.headersSent) {
      res.destroy();
      return undefined;
    }
    return res.status(status).json({
      success: false,
      error: { code: musicError.code, message: musicError.message },
    });
  }
});

app.get('/api/reels/music/:trackId/download', requireAuth, async (req, res) => {
  const { trackId } = req.params;
  if (!/^\d+$/.test(trackId)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_MUSIC_TRACK', message: 'Choose a valid Jamendo track.' } });
  }

  const cacheDirectory = path.join(config.storageDirectory, 'jamendo-audio');
  const cachedTrackPath = path.join(cacheDirectory, `${trackId}.mp3`);
  try {
    fs.mkdirSync(cacheDirectory, { recursive: true });
    if (!fs.existsSync(cachedTrackPath) || fs.statSync(cachedTrackPath).size === 0) {
      let downloadJob = jamendoDownloadJobs.get(trackId);
      if (!downloadJob) {
        downloadJob = (async () => {
          const download = await fetchJamendoTrackDownload({
            clientId: config.jamendoClientId,
            trackId,
          });
          const contentLength = Number(download.headers.get('content-length'));
          const maxDownloadBytes = 50 * 1024 * 1024;
          if (Number.isFinite(contentLength) && contentLength > maxDownloadBytes) {
            throw new JamendoMusicError('The Jamendo track is too large to cache.', 'MUSIC_DOWNLOAD_TOO_LARGE');
          }

          const temporaryPath = `${cachedTrackPath}.${uuidv4()}.tmp`;
          let bytesWritten = 0;
          const sizeLimit = new Transform({
            transform(chunk, encoding, callback) {
              bytesWritten += chunk.length;
              if (bytesWritten > maxDownloadBytes) {
                callback(new Error('The Jamendo track is too large to cache.'));
                return;
              }
              callback(null, chunk);
            },
          });
          try {
            await pipeline(
              Readable.fromWeb(download.body),
              sizeLimit,
              fs.createWriteStream(temporaryPath, { flags: 'wx' }),
            );
            fs.renameSync(temporaryPath, cachedTrackPath);
          } catch (downloadError) {
            fs.rmSync(temporaryPath, { force: true });
            throw downloadError;
          }
        })();
        jamendoDownloadJobs.set(trackId, downloadJob);
      }

      try {
        await downloadJob;
      } finally {
        if (jamendoDownloadJobs.get(trackId) === downloadJob) jamendoDownloadJobs.delete(trackId);
      }
    }

    res.set({
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline; filename="jamendo-track.mp3"',
    });
    return res.sendFile(cachedTrackPath, (sendError) => {
      if (sendError && !res.headersSent) {
        res.status(500).json({ success: false, error: { code: 'MUSIC_CACHE_READ_FAILED', message: 'Could not read the cached Jamendo track.' } });
      }
    });
  } catch (error) {
    const musicError = error instanceof JamendoMusicError
      ? error
      : new JamendoMusicError('Could not download and cache this Jamendo track.', 'MUSIC_DOWNLOAD_FAILED');
    const status = musicError.code === 'MUSIC_NOT_CONFIGURED' || musicError.code === 'INVALID_JAMENDO_CLIENT_ID'
      ? 503
      : musicError.code === 'INVALID_MUSIC_TRACK'
        ? 400
        : musicError.code === 'MUSIC_DOWNLOAD_UNAVAILABLE' || musicError.code === 'MUSIC_TRACK_NOT_FOUND'
          ? 404
          : 502;
    return res.status(status).json({
      success: false,
      error: { code: musicError.code, message: musicError.message },
    });
  }
});

app.post('/api/questions', requireAuth, (req, res) => {
  const { question, optionA, optionB, optionC, optionD, correctAnswer, explanation, hindiExplanation, hinglishExplanation, keyDetails, subject, topic, difficulty, tags } = req.body || {};
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
    keyDetails: Array.isArray(keyDetails) ? keyDetails : keyDetails ? [keyDetails] : [],
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
      keyDetails: Array.isArray(item.keyDetails) ? item.keyDetails : item.keyDetails ? [item.keyDetails] : [],
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
  const presentations = store.presentations
    .filter((entry) => entry.userId === req.user.id)
    .sort((first, second) => Date.parse(second.createdAt || '') - Date.parse(first.createdAt || ''));
  res.json({ success: true, data: presentations });
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
      // A finished MCQ video always gets a matching, downloadable slide deck.
      // Keep PPT failures separate so the successfully rendered video remains available.
      try {
        const pptResult = await generatePptx({
          title,
          questions,
          data: { title, questions },
          mode: 'mcq',
          explanationLanguage,
        });
        const presentation = {
          id: uuidv4(),
          userId: req.user.id,
          title,
          filePath: pptResult.filePath,
          fileName: pptResult.fileName,
          questionCount: pptResult.questionCount,
          sectionCount: pptResult.sectionCount,
          sourceVideoId: video.id,
          createdAt: new Date().toISOString(),
        };
        store.presentations.push(presentation);
        video.presentationId = presentation.id;
        video.presentationFileName = presentation.fileName;
        job.presentation = presentation;
      } catch (pptError) {
        job.presentationError = pptError?.message || 'Could not generate the presentation.';
      }
      store.videos.push(video);
      writeStore(store);
      job.video = video;
      job.status = 'completed';
      job.stage = 'completed';
      job.progress = 100;
      job.message = job.presentation
        ? 'Video and MCQ presentation are ready.'
        : job.presentationError
          ? 'Video is ready, but the presentation could not be generated.'
          : 'Video is ready.';
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
      presentation: job.presentation,
      presentationError: job.presentationError,
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
