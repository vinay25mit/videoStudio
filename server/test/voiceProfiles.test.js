import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addVoiceProfileSample, createVoiceProfile, deleteVoiceProfile, listVoiceProfiles } from '../src/services/voiceProfiles.js';

function makeWavSample() {
  const sample = Buffer.alloc(48);
  sample.write('RIFF', 0, 'ascii');
  sample.write('WAVE', 8, 'ascii');
  return sample;
}

test('voice profiles save and manage recordings without the synthesis service', () => {
  const ownerId = `voice-test-${Date.now()}`;
  let profile;

  try {
    profile = createVoiceProfile({
      ownerId,
      name: 'Test voice',
      language: 'en-IN',
      subject: 'general',
      transcript: 'This is my test recording.',
      audio: makeWavSample(),
    });

    assert.equal(listVoiceProfiles(ownerId).length, 1);
    assert.equal(listVoiceProfiles('another-owner').length, 0);

    addVoiceProfileSample({
      ownerId,
      voiceId: profile.id,
      language: 'hi-IN',
      subject: 'science',
      transcript: 'यह एक परीक्षण रिकॉर्डिंग है।',
      audio: makeWavSample(),
    });

    const [savedProfile] = listVoiceProfiles(ownerId);
    assert.equal(savedProfile.sample_count, 2);
    assert.deepEqual(savedProfile.sample_sections, [
      { language: 'en-IN', subject: 'general' },
      { language: 'hi-IN', subject: 'science' },
    ]);
    assert.equal(deleteVoiceProfile({ ownerId, voiceId: profile.id }).id, profile.id);
    assert.equal(listVoiceProfiles(ownerId).length, 0);
  } finally {
    if (profile) {
      try {
        deleteVoiceProfile({ ownerId, voiceId: profile.id });
      } catch {}
    }
  }
});