# MCQ Video Studio

MCQ Video Studio is a full-stack MVP for generating educational MCQ presentations and videos from reusable question banks.

## Features implemented in this MVP

- User registration and login with JWT
- Question CRUD and bulk question import API
- Question set creation
- PPT generation using `pptxgenjs`
- Dashboard and question management UI
- File-based storage for generated presentations
- Docker and environment configuration scaffolding
- Test coverage for auth, question creation, set creation, and PPT generation

## Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Auth: JWT + bcrypt
- PowerPoint: PptxGenJS
- Database: local JSON storage in the MVP layer; ready for PostgreSQL migration

## Requirements

- Node.js 18+
- npm
- Docker (optional for local containerized run)
- FFmpeg (for video generation phase)
- LibreOffice (for full slide rendering pipeline in later phases)

## Getting started

1. Install dependencies:

   npm install

2. Copy environment variables:

   cp .env.example .env

3. Start the backend and frontend in development mode:

   npm run dev

4. Open the frontend at http://localhost:5173

5. API health check:

   http://localhost:5000/api/health

## English (India) Neural Narration

Video narration uses the free Microsoft Edge TTS endpoint through the MIT-licensed `node-edge-tts` library. It defaults to `en-IN-NeerjaNeural`; set `TTS_VOICE=en-IN-PrabhatNeural` in `.env` for the male voice. No API key or Azure subscription is needed, but video generation requires internet access. The online service may have usage limits or change availability. Set `TTS_PROVIDER=system` to use locally installed system voices instead.

## Optional Custom Voice Service

The separate `voice-service/` uses XTTS v2 to clone narration from microphone recordings. Voice Studio includes 40 recording topics per subject, grouped into subsubjects, with English and Hindi scripts. Profiles are stored by the Node API in `storage/voice-profiles/`, so recordings can be managed while the Python model is offline. After the one-time Python 3.10 environment setup in `voice-service/README.md`, opening Voice Studio starts the model service automatically. This is reference-based cloning, not model-weight fine-tuning; a complete bilingual topic set can use several gigabytes of storage, and the model license and resource requirements should be reviewed before use.
## Scripts

- npm run dev
- npm run build
- npm run start
- npm run test

## Docker

```bash
docker compose up --build
```

## Notes

This repository is intentionally structured as a working MVP foundation for the larger workflow described in the specification. The PowerPoint generation pipeline is operational, and the app is ready for the next iterative phases: advanced TTS, video rendering, template system, and YouTube integration.


```Check backend process
Get-NetTCPConnection -LocalPort 5000 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess

```
Kill backend process
```
Stop-Process -Id <PID> -Force
```
