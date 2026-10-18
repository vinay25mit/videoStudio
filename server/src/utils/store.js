import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const storageRoot = config.storageDirectory;
const dataFile = path.join(storageRoot, 'data.json');

export function ensureStorage() {
  fs.mkdirSync(storageRoot, { recursive: true });
  fs.mkdirSync(path.join(storageRoot, 'presentations'), { recursive: true });
  fs.mkdirSync(path.join(storageRoot, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(storageRoot, 'tmp'), { recursive: true });
}

export function readStore() {
  ensureStorage();
  if (!fs.existsSync(dataFile)) {
    const initial = {
      users: [],
      questions: [],
      sets: [],
      presentations: [],
      videos: [],
    };
    fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2));
    return initial;
  }

  const raw = fs.readFileSync(dataFile, 'utf8');
  if (!raw.trim()) {
    const initial = { users: [], questions: [], sets: [], presentations: [], videos: [] };
    fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2));
    return initial;
  }

  const parsed = JSON.parse(raw);
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    sets: Array.isArray(parsed.sets) ? parsed.sets : [],
    presentations: Array.isArray(parsed.presentations) ? parsed.presentations : [],
    videos: Array.isArray(parsed.videos) ? parsed.videos : [],
  };
}

export function writeStore(nextStore) {
  ensureStorage();
  fs.writeFileSync(dataFile, JSON.stringify(nextStore, null, 2));
}
