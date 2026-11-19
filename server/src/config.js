import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(repositoryRoot, '.env') });

const storagePath = process.env.STORAGE_PATH || './storage';
const storageDirectory = path.resolve(process.cwd(), storagePath);

export const config = {
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  storagePath,
  storageDirectory,
  voiceServiceUrl: (process.env.VOICE_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, ''),
  voiceServiceDirectory: path.resolve(repositoryRoot, 'voice-service'),
  voiceStorageDirectory: path.join(storageDirectory, 'voice-profiles'),
  voiceServicePython: process.env.VOICE_SERVICE_PYTHON || '',
  jamendoClientId: process.env.JAMENDO_CLIENT_ID || '',
};
