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

## Start the project without VS Code

After dependencies are installed and `.env` is configured, use the **Start Website** and **Stop Website** shortcuts on the Windows desktop to control the project without VS Code. Start launches the backend and frontend in the background and opens `http://localhost:5173/`; Stop ends the processes started by the launcher. Logs are written to `storage/logs/`.

To start automatically when you sign in to Windows, double-click `scripts/Enable-Project-Autostart.bat` once. The browser address alone cannot start a stopped server; one of these launchers must start it first.

To disable automatic startup, double-click `scripts/Disable-Project-Autostart.bat`. The task runs for the current Windows account and does not require VS Code.

## English (India) Neural Narration

Video narration uses the free Microsoft Edge TTS endpoint through the MIT-licensed `node-edge-tts` library. It defaults to `en-IN-NeerjaNeural`; set `TTS_VOICE=en-IN-PrabhatNeural` in `.env` for the male voice. No API key or Azure subscription is needed, but video generation requires internet access. The online service may have usage limits or change availability. Set `TTS_PROVIDER=system` to use locally installed system voices instead.

## Reels Music Library

The Reels Maker has a **Your motivational Hindi songs** uploader for audio you own or are licensed to use, plus a separate Jamendo Hindi catalog. Jamendo does not classify tracks by motivational mood and does not provide commercial Bollywood songs; its Hindi-tagged results should not be assumed to be motivational. Select an uploaded or catalog track, preview a 3–15 second excerpt, and adjust its start point; the exported clip fades out while the video continues. Check each catalog track's license before publishing. Create a Jamendo developer app to obtain a client ID, then set `JAMENDO_CLIENT_ID` in the repository `.env` file and restart the API. Do not put the client ID or account password in frontend code.

The Reels Maker also includes a TV-style **Breaking News TV** template. Enter one story per line or import a `.txt`/`.json` list of headlines; the reel animates each story in the main card in sequence and continuously scrolls the complete list in the lower ticker. Stories display for 3.5 seconds, and the exported video duration grows with the story count (up to 30 stories). Browse Jamendo's cinematic instrumental tracks for news background music, preview the selected track, and include it for the full reel duration. The catalog exposes track-specific license information; check the terms before publishing. The optional six-second breaking-news sting is synthesized in the browser. Do not copy or use TV channel audio without permission.

## Current Affairs Archive and Stickers

The **Current Affairs** service accepts JSON files shaped as `{ "news": [{ "headline": "..." }] }`. Choose the archive date when uploading; each date is grouped into its calendar month, and uploading that date again replaces its headline list. After saving, the Reels Maker opens a prefilled draft using Breaking News TV template #1 for English-dominant headlines or Emerald Breaking News TV template #60 for Hindi-dominant headlines. The draft searches for Jamendo's **Dark Eye — Marc Teichert** soundtrack; when Jamendo permits its download, the server caches it once for reuse. Check the linked track license before publishing. The separate **CA Stickers** service randomly selects one saved headline from a chosen archived week, month, or the complete archive and can download it as a PNG sticker.

## Optional Custom Voice Service

The separate `voice-service/` uses XTTS v2 to clone narration from microphone recordings. Voice Studio includes 40 recording topics per subject, grouped into subsubjects, with English and Hindi scripts. Profiles are stored by the Node API in `storage/voice-profiles/`, so recordings can be managed while the Python model is offline. After the one-time Python 3.10 environment setup in `voice-service/README.md`, opening Voice Studio starts the model service automatically. This is reference-based cloning, not model-weight fine-tuning; a complete bilingual topic set can use several gigabytes of storage, and the model license and resource requirements should be reviewed before use.
## Scripts

- npm run dev
- npm run build
- npm run start
- npm run test

## Docker

Docker is not configured yet: this repository does not include a `Dockerfile` or a Compose file, so `docker compose up --build` will not start the app.

For local development, use the Node.js setup above. Install dependencies with `npm install`, create `.env` from `.env.example`, then run `npm run dev`. This starts the frontend at `http://localhost:5173` and the API at `http://localhost:5000`.

The optional XTTS voice service has its own Python environment and setup instructions in [`voice-service/README.md`](./voice-service/README.md); it is not included in a Docker setup.

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
