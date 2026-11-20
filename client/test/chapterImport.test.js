import test from 'node:test';
import assert from 'node:assert/strict';
import { getImportedChapterNames } from '../src/lib/chapterImport.js';

test('imports chapter names from a JSON string array and removes duplicates', () => {
  assert.deepEqual(
    getImportedChapterNames(['Ancient India', 'Medieval India', ' ancient india '], 'HISTORY'),
    ['Ancient India', 'Medieval India'],
  );
});

test('imports chapter objects and a subject-specific chapter list', () => {
  assert.deepEqual(
    getImportedChapterNames({
      subjects: {
        HISTORY: [{ name: 'Ancient India' }, { title: 'Modern India' }],
        GEOGRAPHY: ['Physical Geography'],
      },
    }, 'History'),
    ['Ancient India', 'Modern India'],
  );
  assert.deepEqual(
    getImportedChapterNames({ chapters: [{ chapter: 'Rivers of India' }] }, 'GEOGRAPHY'),
    ['Rivers of India'],
  );
});

test('rejects empty or malformed chapter lists without partial imports', () => {
  assert.throws(() => getImportedChapterNames([], 'HISTORY'), /1–500 chapters/);
  assert.throws(() => getImportedChapterNames(['Ancient India', ''], 'HISTORY'), /No chapters were imported/);
  assert.throws(() => getImportedChapterNames({ OTHER: ['Chapter'] }, 'HISTORY'), /for HISTORY/);
});
