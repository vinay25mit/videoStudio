import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const storageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-syllabus-'));
process.env.STORAGE_PATH = storageDirectory;
process.env.PORT = '0';
process.env.JWT_SECRET = 'syllabus-tracker-test-secret';

const [{ app, server }, { readStore, writeStore }, { config }] = await Promise.all([
  import('../src/index.js'),
  import('../src/utils/store.js'),
  import('../src/config.js'),
]);

const firstUser = { id: 'syllabus-user-1' };
const secondUser = { id: 'syllabus-user-2' };
const firstToken = jwt.sign({ userId: firstUser.id }, config.jwtSecret);
const secondToken = jwt.sign({ userId: secondUser.id }, config.jwtSecret);
const tracker = {
  globalStudySeconds: 42,
  globalTimerStartedAt: '2026-11-07T10:00:00.000Z',
  exams: [{
    id: 'prelims',
    name: 'BPSC Prelims',
    subjects: [{
      id: 'history',
      name: 'HISTORY',
      chapters: [{
        id: 'ancient',
        name: 'Ancient India',
        completed: { notes: true },
        seconds: 45,
        localFiles: [{
          id: 'local-study-file',
          name: 'Current affairs.pptx',
          path: 'C:\\Study\\Current affairs.pptx',
        }],
        notes: 'Review the Mauryan period.',
        classes: [
          { id: 'class-1', title: 'Class 1', notes: 'Mauryan administration' },
          { id: 'class-2', title: 'Class 2', notes: 'Ashoka and dhamma' },
        ],
        tests: [{
          id: 'test-1', title: 'Chapter quiz', obtained: 8, total: 10, link: 'https://example.com/quiz',
          correct: 8, wrong: 2, unanswered: 0, timeSeconds: 185, source: 'mcq-json',
        }],
        mcqQuestionSet: {
          title: 'Current Affairs Practice',
          sourceName: 'current-affairs.json',
          questions: [{
            question: 'Where was the programme inaugurated?',
            optionA: 'Kolkata',
            optionB: 'Mumbai',
            optionC: 'Bengaluru',
            optionD: 'New Delhi',
            correctAnswer: 'D',
            explanation: 'It was inaugurated in New Delhi.',
            hindiExplanation: '',
            hinglishExplanation: '',
            keyDetails: [],
          }],
        },
        questionSetsBySection: {
          lucent: [{
            id: 'lucent-set-1',
            title: 'Lucent practice 1',
            sourceName: 'lucent-test.json',
            questions: [{
              question: 'Where was the programme inaugurated?',
              optionA: 'Kolkata',
              optionB: 'Mumbai',
              optionC: 'Bengaluru',
              optionD: 'New Delhi',
              correctAnswer: 'D',
              explanation: 'It was inaugurated in New Delhi.',
              hindiExplanation: '',
              hinglishExplanation: '',
              keyDetails: [],
            }],
          }],
        },
      }],
    }],
  }],
};

test('syllabus tracker saves progress per authenticated user and rejects invalid data', async () => {
  const store = readStore();
  store.users.push(firstUser, secondUser);
  writeStore(store);

  const initial = await request(app)
    .get('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(initial.status, 200);
  assert.equal(initial.body.data, null);

  const saved = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`)
    .send(tracker);
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.data, tracker);

  const loaded = await request(app)
    .get('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`);
  assert.deepEqual(loaded.body.data, tracker);

  const isolated = await request(app)
    .get('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${secondToken}`);
  assert.equal(isolated.body.data, null);

  const invalid = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({ exams: 'not-an-array' });
  assert.equal(invalid.status, 400);

  const invalidGlobalTimer = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', ['Bearer', firstToken].join(' '))
    .send({ ...tracker, globalStudySeconds: -1 });
  assert.equal(invalidGlobalTimer.status, 400);

  const invalidGlobalTimerStart = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', ['Bearer', firstToken].join(' '))
    .send({ ...tracker, globalTimerStartedAt: 'not-a-date' });
  assert.equal(invalidGlobalTimerStart.status, 400);

  const invalidScore = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({
      ...tracker,
      exams: [{
        ...tracker.exams[0],
        subjects: [{
          ...tracker.exams[0].subjects[0],
          chapters: [{
            ...tracker.exams[0].subjects[0].chapters[0],
            tests: [{ id: 'bad-score', title: 'Invalid score', obtained: 12, total: 10 }],
          }],
        }],
      }],
    });
  assert.equal(invalidScore.status, 400);

  const invalidLocalFilePath = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', ['Bearer', firstToken].join(' '))
    .send({
      ...tracker,
      exams: [{
        ...tracker.exams[0],
        subjects: [{
          ...tracker.exams[0].subjects[0],
          chapters: [{
            ...tracker.exams[0].subjects[0].chapters[0],
            localFiles: [{ id: 'local-1', name: 'study.pptx', path: 'study.pptx' }],
          }],
        }],
      }],
    });
  assert.equal(invalidLocalFilePath.status, 400);

  const relativeLocalFileOpen = await request(app)
    .post('/api/syllabus-tracker/open-local-file')
    .set('Authorization', ['Bearer', firstToken].join(' '))
    .send({ path: 'study.pptx' });
  assert.equal(relativeLocalFileOpen.status, 400);

  const missingLocalFileOpen = await request(app)
    .post('/api/syllabus-tracker/open-local-file')
    .set('Authorization', ['Bearer', firstToken].join(' '))
    .send({ path: 'C:\\Users\\test\\missing-study.pptx' });
  assert.equal(missingLocalFileOpen.status, 404);

  const invalidMcqQuestionSet = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({
      ...tracker,
      exams: [{
        ...tracker.exams[0],
        subjects: [{
          ...tracker.exams[0].subjects[0],
          chapters: [{
            ...tracker.exams[0].subjects[0].chapters[0],
            mcqQuestionSet: {
              title: 'Invalid set',
              sourceName: 'invalid.json',
              questions: [{ question: 'Missing options?', correctAnswer: 'E' }],
            },
          }],
        }],
      }],
    });
  assert.equal(invalidMcqQuestionSet.status, 400);

  const invalidSectionTest = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({
      ...tracker,
      exams: [{
        ...tracker.exams[0],
        subjects: [{
          ...tracker.exams[0].subjects[0],
          chapters: [{
            ...tracker.exams[0].subjects[0].chapters[0],
            questionSetsBySection: {
              unsupported: [{
                id: 'test-invalid',
                title: 'Invalid section',
                sourceName: 'invalid.json',
                questions: [],
              }],
            },
          }],
        }],
      }],
    });
  assert.equal(invalidSectionTest.status, 400);

  const invalidClassNotes = await request(app)
    .put('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({
      ...tracker,
      exams: [{
        ...tracker.exams[0],
        subjects: [{
          ...tracker.exams[0].subjects[0],
          chapters: [{
            ...tracker.exams[0].subjects[0].chapters[0],
            classes: Array.from({ length: 101 }, (_, index) => ({
              id: `class-${index}`,
              title: `Class ${index + 1}`,
              notes: '',
            })),
          }],
        }],
      }],
    });
  assert.equal(invalidClassNotes.status, 400);

  const upload = await request(app)
    .post('/api/syllabus-tracker/chapters/ancient/files')
    .set('Authorization', `Bearer ${firstToken}`)
    .attach('file', Buffer.from('%PDF-1.4 test study material'), { filename: 'ancient-history.pdf', contentType: 'application/pdf' });
  assert.equal(upload.status, 201);
  assert.equal(upload.body.data.name, 'ancient-history.pdf');
  assert.equal(Object.hasOwn(upload.body.data, 'path'), false);
  assert.match(upload.body.data.storageName, /^[a-f\d-]{36}(?:\.[a-z\d]{1,11})?$/i);
  assert.equal(fs.existsSync(path.join(storageDirectory, 'syllabus-files', firstUser.id, upload.body.data.storageName)), true);

  const unsupportedFileUpload = await request(app)
    .post('/api/syllabus-tracker/chapters/ancient/files')
    .set('Authorization', ['Bearer', firstToken].join(' '))
    .attach('file', Buffer.from('study notes'), { filename: 'study-notes.txt', contentType: 'text/plain' });
  assert.equal(unsupportedFileUpload.status, 201);

  const unsupportedDesktopOpen = await request(app)
    .post(`/api/syllabus-tracker/open-file/${unsupportedFileUpload.body.data.id}`)
    .set('Authorization', ['Bearer', firstToken].join(' '));
  assert.equal(unsupportedDesktopOpen.status, 404);

  const privateStudyFileOpen = await request(app)
    .post(`/api/syllabus-tracker/open-file/${upload.body.data.id}`)
    .set('Authorization', ['Bearer', secondToken].join(' '));
  assert.equal(privateStudyFileOpen.status, 404);

  const taskUpload = await request(app)
    .post('/api/syllabus-tracker/chapters/ancient/files')
    .set('Authorization', `Bearer ${firstToken}`)
    .field('taskId', 'dpp')
    .attach('file', Buffer.from('%PDF-1.4 dpp questions'), { filename: 'dpp-questions.pdf', contentType: 'application/pdf' });
  assert.equal(taskUpload.status, 201);
  assert.equal(taskUpload.body.data.name, 'dpp-questions.pdf');

  const classTaskUpload = await request(app)
    .post('/api/syllabus-tracker/chapters/ancient/files')
    .set('Authorization', `Bearer ${firstToken}`)
    .field('classId', 'class-1')
    .field('taskId', 'notes')
    .attach('file', Buffer.from('%PDF-1.4 class notes'), { filename: 'class-notes.pdf', contentType: 'application/pdf' });
  assert.equal(classTaskUpload.status, 201);
  assert.equal(classTaskUpload.body.data.name, 'class-notes.pdf');

  const previousYearUpload = await request(app)
    .post('/api/syllabus-tracker/chapters/ancient/files')
    .set('Authorization', `Bearer ${firstToken}`)
    .field('taskId', 'previousYear')
    .attach('file', Buffer.from('%PDF-1.4 previous year questions'), { filename: 'previous-year.pdf', contentType: 'application/pdf' });
  assert.equal(previousYearUpload.status, 201);

  const invalidClassTaskUpload = await request(app)
    .post('/api/syllabus-tracker/chapters/ancient/files')
    .set('Authorization', `Bearer ${firstToken}`)
    .field('classId', 'missing-class')
    .field('taskId', 'notes')
    .attach('file', Buffer.from('%PDF-1.4 class notes'), { filename: 'orphan-notes.pdf', contentType: 'application/pdf' });
  assert.equal(invalidClassTaskUpload.status, 400);

  const invalidTaskUpload = await request(app)
    .post('/api/syllabus-tracker/chapters/ancient/files')
    .set('Authorization', `Bearer ${firstToken}`)
    .field('taskId', 'unknown')
    .attach('file', Buffer.from('unsupported'), { filename: 'notes.txt', contentType: 'text/plain' });
  assert.equal(invalidTaskUpload.status, 400);

  const afterTaskUpload = await request(app)
    .get('/api/syllabus-tracker')
    .set('Authorization', `Bearer ${firstToken}`);
  assert.deepEqual(afterTaskUpload.body.data.exams[0].subjects[0].chapters[0].taskFiles.dpp[0], taskUpload.body.data);
  assert.deepEqual(afterTaskUpload.body.data.exams[0].subjects[0].chapters[0].classes[0].taskFiles.notes[0], classTaskUpload.body.data);

  const downloaded = await request(app)
    .get(`/api/syllabus-tracker/files/${upload.body.data.id}`)
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers['content-disposition'], /ancient-history\.pdf/);

  const privateFile = await request(app)
    .get(`/api/syllabus-tracker/files/${upload.body.data.id}`)
    .set('Authorization', `Bearer ${secondToken}`);
  assert.equal(privateFile.status, 404);

  const removed = await request(app)
    .delete(`/api/syllabus-tracker/chapters/ancient/files/${upload.body.data.id}`)
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(removed.status, 200);

  const removedTaskFile = await request(app)
    .delete(`/api/syllabus-tracker/chapters/ancient/files/${taskUpload.body.data.id}`)
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(removedTaskFile.status, 200);

  const removedClassTaskFile = await request(app)
    .delete(`/api/syllabus-tracker/chapters/ancient/files/${classTaskUpload.body.data.id}`)
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(removedClassTaskFile.status, 200);

  const missingFile = await request(app)
    .get(`/api/syllabus-tracker/files/${upload.body.data.id}`)
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(missingFile.status, 404);
});

after(() => {
  server.close();
  fs.rmSync(storageDirectory, { recursive: true, force: true });
});
