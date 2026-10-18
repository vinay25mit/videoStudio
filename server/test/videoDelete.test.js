import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';

test('video deletion removes owned assets and rejects other users', async () => {
  const originalCwd = process.cwd();
  const originalPort = process.env.PORT;
  const originalJwtSecret = process.env.JWT_SECRET;
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcq-video-delete-'));
  const videoDirectory = path.join(testRoot, 'storage', 'videos');
  fs.mkdirSync(videoDirectory, { recursive: true });

  const ownedVideo = {
    id: 'owned-video',
    userId: 'owner',
    filePath: path.join(videoDirectory, 'owned.mp4'),
    subtitleFilePath: path.join(videoDirectory, 'owned.srt'),
    metadataFilePath: path.join(videoDirectory, 'owned.json'),
  };
  const otherVideo = {
    id: 'other-video',
    userId: 'other-user',
    filePath: path.join(videoDirectory, 'other.mp4'),
    subtitleFilePath: path.join(videoDirectory, 'other.srt'),
    metadataFilePath: path.join(videoDirectory, 'other.json'),
  };
  const olderVideo = { id: 'older-video', userId: 'owner', createdAt: '2025-01-01T00:00:00.000Z' };
  ownedVideo.createdAt = '2026-01-01T00:00:00.000Z';
  for (const filePath of [
    ownedVideo.filePath, ownedVideo.subtitleFilePath, ownedVideo.metadataFilePath,
    otherVideo.filePath, otherVideo.subtitleFilePath, otherVideo.metadataFilePath,
  ]) {
    fs.writeFileSync(filePath, 'test asset');
  }

  process.env.PORT = '0';
  process.env.JWT_SECRET = 'video-delete-test-secret';
  process.chdir(testRoot);
  fs.writeFileSync(path.join(testRoot, 'storage', 'data.json'), JSON.stringify({
    users: [{ id: 'owner' }, { id: 'other-user' }],
    questions: [],
    sets: [],
    presentations: [],
    videos: [olderVideo, ownedVideo, otherVideo],
  }));

  let server;
  try {
    const [{ app, server: apiServer }, { config }] = await Promise.all([
      import('../src/index.js'),
      import('../src/config.js'),
    ]);
    server = apiServer;
    const ownerToken = jwt.sign({ userId: 'owner' }, config.jwtSecret);

    const listed = await request(app)
      .get('/api/videos')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.data.map((video) => video.id), ['owned-video', 'older-video']);

    const deleted = await request(app)
      .delete('/api/videos/owned-video')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body.data, { id: 'owned-video' });
    for (const filePath of [ownedVideo.filePath, ownedVideo.subtitleFilePath, ownedVideo.metadataFilePath]) {
      assert.equal(fs.existsSync(filePath), false);
    }

    const forbidden = await request(app)
      .delete('/api/videos/other-video')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(forbidden.status, 404);
    for (const filePath of [otherVideo.filePath, otherVideo.subtitleFilePath, otherVideo.metadataFilePath]) {
      assert.equal(fs.existsSync(filePath), true);
    }

    const stored = JSON.parse(fs.readFileSync(path.join(testRoot, 'storage', 'data.json'), 'utf8'));
    assert.deepEqual(stored.videos.map((video) => video.id), ['older-video', 'other-video']);
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    process.chdir(originalCwd);
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
});