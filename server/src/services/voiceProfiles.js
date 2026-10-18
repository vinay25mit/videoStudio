import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';

const voiceDirectory = config.voiceStorageDirectory;
const catalogPath = path.join(voiceDirectory, 'voices.json');

function readCatalog() {
  if (!fs.existsSync(catalogPath)) return [];
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return Array.isArray(catalog) ? catalog : [];
  } catch {
    return [];
  }
}

function writeCatalog(catalog) {
  fs.mkdirSync(voiceDirectory, { recursive: true });
  const temporaryPath = `${catalogPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(catalog, null, 2), 'utf8');
  fs.renameSync(temporaryPath, catalogPath);
}

function publicVoice(profile) {
  return {
    id: profile.id,
    name: profile.name,
    sample_count: profile.samples?.length || (profile.sample_path ? 1 : 0),
    sample_sections: (profile.samples || (profile.sample_path ? [{ language: 'en-IN', subject: 'general' }] : []))
      .map(({ language, subject }) => ({ language, subject })),
  };
}

function storeSample({ voiceId, sampleId, audio }) {
  if (!Buffer.isBuffer(audio) || audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Recording is not a valid WAV file. Stop the microphone recording and try again.');
  }
  fs.mkdirSync(voiceDirectory, { recursive: true });
  const samplePath = path.join(voiceDirectory, `${voiceId}-${sampleId}.wav`);
  fs.writeFileSync(samplePath, audio, { flag: 'wx' });
  return samplePath;
}

export function listVoiceProfiles(ownerId) {
  return readCatalog()
    .filter((profile) => profile.owner_id === ownerId)
    .map(publicVoice);
}

export function createVoiceProfile({ ownerId, name, language, subject, transcript, audio }) {
  const catalog = readCatalog();
  const id = uuidv4().replace(/-/g, '');
  const sampleId = uuidv4().replace(/-/g, '');
  const samplePath = storeSample({ voiceId: id, sampleId, audio });
  const profile = {
    id,
    name,
    owner_id: ownerId,
    samples: [{
      sample_path: samplePath,
      language,
      subject,
      transcript,
    }],
  };

  try {
    writeCatalog([...catalog, profile]);
  } catch (error) {
    fs.rmSync(samplePath, { force: true });
    throw error;
  }
  return publicVoice(profile);
}

export function addVoiceProfileSample({ ownerId, voiceId, language, subject, transcript, audio }) {
  const catalog = readCatalog();
  const profile = catalog.find((entry) => entry.id === voiceId && entry.owner_id === ownerId);
  if (!profile) throw new Error('Custom voice was not found for this account.');
  const samples = profile.samples || (profile.sample_path ? [{
    sample_path: profile.sample_path,
    language: 'en-IN',
    subject: 'general',
    transcript: '',
  }] : []);
  if (samples.length >= 600) throw new Error('A voice profile can contain at most 600 recordings.');

  const sampleId = uuidv4().replace(/-/g, '');
  const samplePath = storeSample({ voiceId, sampleId, audio });
  profile.samples = [...samples, { sample_path: samplePath, language, subject, transcript }];
  delete profile.sample_path;
  try {
    writeCatalog(catalog);
  } catch (error) {
    fs.rmSync(samplePath, { force: true });
    throw error;
  }
  return { id: sampleId, language, subject };
}

export function deleteVoiceProfile({ ownerId, voiceId }) {
  const catalog = readCatalog();
  const profile = catalog.find((entry) => entry.id === voiceId && entry.owner_id === ownerId);
  if (!profile) throw new Error('Custom voice was not found for this account.');
  const samples = profile.samples || (profile.sample_path ? [{ sample_path: profile.sample_path }] : []);
  const remaining = catalog.filter((entry) => entry.id !== voiceId);
  writeCatalog(remaining);
  for (const sample of samples) {
    const samplePath = path.resolve(sample.sample_path || '');
    if (path.dirname(samplePath) === voiceDirectory) fs.rmSync(samplePath, { force: true });
  }
  return { id: profile.id, name: profile.name };
}