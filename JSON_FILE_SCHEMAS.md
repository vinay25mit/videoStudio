# JSON File Sample Schemas

This document records representative JSON shapes used by the project. Timestamped files under `storage/videos/` and `server/storage/videos/` share the video metadata shape below. Dependency files in `node_modules/` and the Python virtual environment are third-party package data and are not project data schemas.

## `question.json` — quiz input

```json
{
  "questions": [
    {
      "question": "Which nutrient is the main source of energy?",
      "options": {
        "A": "Proteins",
        "B": "Carbohydrates",
        "C": "Vitamins",
        "D": "Minerals"
      },
      "correctAnswer": "B",
      "explanation": "Carbohydrates are a primary energy source."
    }
  ]
}
```

## `news-stories.json` — Breaking News reel input

Upload a JSON **data file** in the Breaking News TV template's news-headlines uploader. Use a top-level `news` array with one `headline` per story. The reel displays at most 30 stories, one after another. Extra fields are accepted but are not used in the reel; only the headline text is displayed. A ready-to-upload example is [sample_news_stories.json](./sample_news_stories.json).

```json
{
  "news": [
    {
      "headline": "Sample: A new public transport project is announced"
    },
    {
      "headline": "Sample: Students receive access to a scholarship program"
    },
    {
      "headline": "Sample: Scientists publish findings from a climate study"
    }
  ]
}
```

The following JSON Schema describes the recommended upload format. Save the example above as a `.json` file to upload it; do not upload the schema itself.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Breaking News Reel Stories",
  "type": "object",
  "required": ["news"],
  "properties": {
    "news": {
      "type": "array",
      "minItems": 1,
      "maxItems": 30,
      "items": {
        "type": "object",
        "required": ["headline"],
        "properties": {
          "headline": {
            "type": "string",
            "minLength": 1
          }
        },
        "additionalProperties": true
      }
    }
  },
  "additionalProperties": true
}
```

The importer also accepts a top-level array of headline strings or objects, and object arrays under `articles`, `headlines`, `stories`, `items`, `results`, or `data`. For objects, it reads the first available text from `headline`, `title`, `heading`, `content`, or `description`.

## `server/storage/data.json` — application store

```json
{
  "users": [
    {
      "id": "user-id",
      "name": "Sample User",
      "email": "user@example.com",
      "passwordHash": "bcrypt-hash",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "questions": [],
  "sets": [],
  "presentations": [
    {
      "id": "presentation-id",
      "userId": "user-id",
      "title": "Sample presentation",
      "filePath": "storage/presentations/sample.pptx",
      "fileName": "sample.pptx",
      "questionCount": 1,
      "sectionCount": 0,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "videos": [
    {
      "id": "video-id",
      "userId": "user-id",
      "title": "Sample video",
      "filePath": "storage/videos/sample.mp4",
      "fileName": "sample.mp4",
      "metadataFilePath": "storage/videos/sample.json",
      "metadataFileName": "sample.json",
      "subtitleFilePath": "storage/videos/sample.srt",
      "subtitleFileName": "sample.srt",
      "audioVoice": "Default voice",
      "duration": 60,
      "questionCount": 1,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

`questions` and `sets` are arrays; they are empty in the current store, so no populated record shape is available to sample. `sectionCount` appears on some presentation records.

## `storage/videos/*.json` and `server/storage/videos/*.json` — generated video metadata

```json
{
  "title": "Sample MCQ video",
  "description": "A short description of the video.",
  "tags": ["MCQ", "Quiz", "Education"],
  "questionCount": 1,
  "videoFile": "sample.mp4",
  "subtitleFile": "sample.srt",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "audioTrack": "narration",
  "audioVoice": "Default voice"
}
```

`audioTrack` and `audioVoice` are optional across existing files.

## `server/storage/voice-profiles/voices.json` — voice profiles

```json
[
  {
    "id": "profile-id",
    "name": "Sample voice",
    "owner_id": "user-id",
    "samples": [
      {
        "sample_path": "storage/voice-profiles/sample.wav",
        "language": "en-IN",
        "subject": "general",
        "transcript": "A sample recording transcript."
      }
    ]
  }
]
```

## Root `package.json` — workspace manifest

```json
{
  "name": "mcq-video-studio",
  "private": true,
  "version": "1.0.0",
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "concurrently ...",
    "build": "npm run build ...",
    "start": "npm run start ...",
    "test": "npm run test ..."
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  }
}
```

## `client/package.json` — frontend manifest

```json
{
  "name": "client",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "...",
    "react": "...",
    "react-dom": "...",
    "react-router-dom": "..."
  },
  "devDependencies": {
    "@vitejs/plugin-react": "...",
    "vite": "..."
  }
}
```

## `server/package.json` — backend manifest

```json
{
  "name": "server",
  "version": "1.0.0",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "build": "node --check src/index.js",
    "test": "node --test"
  },
  "dependencies": {
    "bcryptjs": "...",
    "cors": "...",
    "dotenv": "...",
    "express": "...",
    "ffmpeg-static": "...",
    "helmet": "...",
    "jsonwebtoken": "...",
    "multer": "..."
  },
  "devDependencies": {
    "supertest": "..."
  }
}
```

The `...` values above stand for package version strings; exact versions are listed in each manifest.

## Presentation content schemas

Presentation JSON files must have a non-empty top-level `title`. The `subject` field is optional. Select the matching mode in the presentation form: `mcq`, `educational`, or `coding`.

### 1. Educational Content Mode (`mode: "educational"`)

Requires a non-empty `sections` array. Each section needs a non-empty `title` and `description`. `bulletPoints` and `examples` are optional arrays of strings.

```json
{
  "title": "The Water Cycle",
  "subject": "Earth Science",
  "sections": [
    {
      "title": "Evaporation",
      "description": "Heat from the Sun changes liquid water into water vapor.",
      "bulletPoints": [
        "Occurs at the surface of oceans, lakes, and rivers",
        "Warmer conditions increase evaporation"
      ],
      "examples": ["A puddle drying after a sunny day"]
    }
  ]
}
```

### 2. MCQ Question Mode (`mode: "mcq"`)

Requires a non-empty `questions` array. Every question requires `question`, four string options (`A` through `D`), `correctAnswer` set to `A`, `B`, `C`, or `D`, and a non-empty `explanation`.

```json
{
  "title": "The Water Cycle Quiz",
  "subject": "Earth Science",
  "questions": [
    {
      "question": "What process changes liquid water into water vapor?",
      "options": {
        "A": "Condensation",
        "B": "Evaporation",
        "C": "Precipitation",
        "D": "Collection"
      },
      "correctAnswer": "B",
      "explanation": "Evaporation occurs when liquid water gains heat and becomes vapor."
    }
  ]
}
```

### 3. Coding Tutorial Mode (`mode: "coding"`)

Requires a non-empty `sections` array. Each section needs a non-empty `title` and at least one meaningful content field. Supported fields are `description`, `bulletPoints`, `examples`, `code`, `language`, `output`, and `explanation`; all are optional individually. `bulletPoints` and `examples` must be arrays of strings; other listed fields must be strings.

```json
{
  "title": "Python Variables",
  "subject": "Python Programming",
  "sections": [
    {
      "title": "Assigning a value",
      "description": "Use the assignment operator to store a value in a variable.",
      "bulletPoints": ["Variable names are case-sensitive"],
      "code": "name = \"Ada\"\nprint(name)",
      "language": "python",
      "output": "Ada",
      "explanation": "The name variable stores the string Ada, which print displays.",
      "examples": ["Store a number with count = 3"]
    }
  ]
}
```

These examples follow the validation rules in `server/src/index.js`; extra fields may be included in the JSON, but the fields above are the ones used to build the presentation content.
