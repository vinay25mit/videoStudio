import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const storageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-current-affairs-'));
process.env.STORAGE_PATH = storageDirectory;
process.env.PORT = '0';
process.env.JWT_SECRET = 'current-affairs-test-secret';
process.env.JAMENDO_CLIENT_ID = 'current-affairs-test-jamendo-client-id';

const [{ app, server }, { readStore, writeStore }, { config }] = await Promise.all([
  import('../src/index.js'),
  import('../src/utils/store.js'),
  import('../src/config.js'),
]);

const firstUser = { id: 'current-affairs-user-1' };
const secondUser = { id: 'current-affairs-user-2' };
const firstToken = jwt.sign({ userId: firstUser.id }, config.jwtSecret);
const secondToken = jwt.sign({ userId: secondUser.id }, config.jwtSecret);

test('daily current affairs are saved per user and replaced by date', async () => {
  const store = readStore();
  store.users.push(firstUser, secondUser);
  writeStore(store);

  const saved = await request(app)
    .post('/api/current-affairs/days')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({
      date: '2026-11-07',
      sourceName: 'daily.json',
      headlines: ['बहामास ISA का 116वां सदस्य बना।', 'नई नीति घोषित हुई।', 'नई नीति घोषित हुई।'],
    });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.body.data.headlines, ['बहामास ISA का 116वां सदस्य बना।', 'नई नीति घोषित हुई।']);

  const replaced = await request(app)
    .post('/api/current-affairs/days')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({
      date: '2026-11-07',
      sourceName: 'revised.json',
      headlines: ['Updated headline'],
    });
  assert.equal(replaced.status, 200);
  assert.equal(replaced.body.data.id, saved.body.data.id);
  assert.deepEqual(replaced.body.data.headlines, ['Updated headline']);

  const loaded = await request(app)
    .get('/api/current-affairs')
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.data.length, 1);
  assert.equal(loaded.body.data[0].sourceName, 'revised.json');

  const isolated = await request(app)
    .get('/api/current-affairs')
    .set('Authorization', `Bearer ${secondToken}`);
  assert.deepEqual(isolated.body.data, []);

  const deleted = await request(app)
    .delete('/api/current-affairs/days/2026-11-07')
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(deleted.status, 200);

  const missing = await request(app)
    .delete('/api/current-affairs/days/2026-11-07')
    .set('Authorization', `Bearer ${firstToken}`);
  assert.equal(missing.status, 404);
});

test('daily current affairs rejects invalid dates and headline payloads', async () => {
  const invalidDate = await request(app)
    .post('/api/current-affairs/days')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({ date: '2026-02-30', sourceName: 'daily.json', headlines: ['Headline'] });
  assert.equal(invalidDate.status, 400);

  const invalidHeadline = await request(app)
    .post('/api/current-affairs/days')
    .set('Authorization', `Bearer ${firstToken}`)
    .send({ date: '2026-11-07', sourceName: 'daily.json', headlines: [''] });
  assert.equal(invalidHeadline.status, 400);
});

test('downloadable Jamendo tracks are cached and reused by track ID', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).includes('api.jamendo.com')) {
      return new Response(JSON.stringify({
        headers: { status: 'success' },
        results: [{
          id: 7001,
          name: 'Dark Eye',
          artist_name: 'Marc Teichert',
          audio: 'https://prod-1.storage.jamendo.com/?trackid=7001&format=mp32',
          audiodownload: 'https://www.jamendo.com/download/7001.mp3',
          audiodownload_allowed: true,
        }],
      }), { headers: { 'content-type': 'application/json' } });
    }
    if (options.method === 'HEAD') return { ok: true };
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      headers: { 'content-type': 'audio/mpeg' },
    });
  };

  try {
    const firstDownload = await request(app)
      .get('/api/reels/music/7001/download')
      .set('Authorization', `Bearer ${firstToken}`);
    assert.equal(firstDownload.status, 200);
    assert.deepEqual([...firstDownload.body], [1, 2, 3, 4]);
    assert.equal(requests.length, 3);

    const secondDownload = await request(app)
      .get('/api/reels/music/7001/download')
      .set('Authorization', `Bearer ${firstToken}`);
    assert.equal(secondDownload.status, 200);
    assert.deepEqual([...secondDownload.body], [1, 2, 3, 4]);
    assert.equal(requests.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

after(() => {
  server.close();
  fs.rmSync(storageDirectory, { recursive: true, force: true });
});
