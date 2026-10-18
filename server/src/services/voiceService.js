import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from '../config.js';

let managedVoiceProcess = null;
let voiceServiceStartup = null;
let lastStartupError = '';

async function checkVoiceService() {
  try {
    const response = await fetch(`${config.voiceServiceUrl}/health`, { signal: AbortSignal.timeout(700) });
    return response.ok;
  } catch {
    return false;
  }
}

function launchVoiceService() {
  if (managedVoiceProcess && managedVoiceProcess.exitCode === null) return managedVoiceProcess;

  const windowsPython = path.join(config.voiceServiceDirectory, '.venv', 'Scripts', 'python.exe');
  const unixPython = path.join(config.voiceServiceDirectory, '.venv', 'bin', 'python');
  let executable;
  let args;
  if (config.voiceServicePython) {
    executable = config.voiceServicePython;
    args = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8001'];
  } else if (fs.existsSync(process.platform === 'win32' ? windowsPython : unixPython)) {
    executable = process.platform === 'win32' ? windowsPython : unixPython;
    args = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8001'];
  } else if (process.platform === 'win32') {
    executable = 'py';
    args = ['-3.10', '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8001'];
  } else {
    executable = 'python3.10';
    args = ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8001'];
  }

  lastStartupError = '';
  const child = spawn(executable, args, {
    cwd: config.voiceServiceDirectory,
    env: {
      ...process.env,
      VOICE_STORAGE_DIR: config.voiceStorageDirectory,
      PYTHONUNBUFFERED: '1',
    },
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  managedVoiceProcess = child;

  let errorOutput = '';
  child.stderr?.on('data', (chunk) => {
    errorOutput = `${errorOutput}${chunk}`.slice(-4000);
  });
  child.on('error', (error) => {
    lastStartupError = error.message;
  });
  child.on('exit', (code) => {
    if (managedVoiceProcess === child) managedVoiceProcess = null;
    if (code !== 0) lastStartupError = errorOutput.trim() || `Voice service process exited with code ${code}.`;
  });
  return child;
}

async function startAndCheckVoiceService() {
  const child = launchVoiceService();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await checkVoiceService()) return { available: true, message: '' };
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (lastStartupError.includes('No module named')) {
    return { available: false, message: 'Voice service dependencies are missing. Install voice-service/requirements.txt in its Python 3.10 environment.' };
  }
  if (lastStartupError.includes('Python') || lastStartupError.includes('not found') || lastStartupError.includes('No suitable')) {
    return { available: false, message: 'Python 3.10 was not found. Install Python 3.10 and voice-service/requirements.txt.' };
  }
  return {
    available: false,
    message: lastStartupError || 'Could not start the voice service. Check the Python 3.10 setup in voice-service/README.md.',
  };
}

export async function ensureVoiceService() {
  if (await checkVoiceService()) return { available: true, message: '' };
  if (!voiceServiceStartup) {
    voiceServiceStartup = startAndCheckVoiceService().finally(() => {
      voiceServiceStartup = null;
    });
  }
  return voiceServiceStartup;
}

function voiceServiceError(response, payload) {
  const message = payload?.detail || payload?.error || `Voice service request failed (${response.status}).`;
  return new Error(String(message));
}

export async function listCustomVoices(ownerId) {
  const response = await fetch(`${config.voiceServiceUrl}/voices?owner_id=${encodeURIComponent(ownerId)}`, {
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw voiceServiceError(response, payload);
  return Array.isArray(payload.voices) ? payload.voices : [];
}

export async function enrollCustomVoice({ ownerId, name, language = 'en-IN', subject = 'general', transcript = '', audio }) {
  const query = new URLSearchParams({
    owner_id: ownerId,
    name,
    language,
    subject,
    transcript,
    consent: 'true',
  });
  const response = await fetch(`${config.voiceServiceUrl}/voices?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: audio,
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw voiceServiceError(response, payload);
  return payload.voice;
}

export async function addVoiceSample({ ownerId, voiceId, language, subject, transcript, audio }) {
  const query = new URLSearchParams({
    owner_id: ownerId,
    language,
    subject,
    transcript,
    consent: 'true',
  });
  const response = await fetch(`${config.voiceServiceUrl}/voices/${encodeURIComponent(voiceId)}/samples?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: audio,
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw voiceServiceError(response, payload);
  return payload.sample;
}

export async function deleteCustomVoice({ ownerId, voiceId }) {
  const query = new URLSearchParams({ owner_id: ownerId });
  const response = await fetch(`${config.voiceServiceUrl}/voices/${encodeURIComponent(voiceId)}?${query}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw voiceServiceError(response, payload);
  return payload.voice;
}

export async function synthesizeCustomVoice({ ownerId, voiceId, text, language, outputPath }) {
  const response = await fetch(`${config.voiceServiceUrl}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner_id: ownerId, voice_id: voiceId, text, language }),
    signal: AbortSignal.timeout(300000),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw voiceServiceError(response, payload);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Voice service returned an invalid WAV audio file.');
  }
  fs.writeFileSync(outputPath, audio);
  return 'Custom voice';
}