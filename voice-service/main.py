import json
import os
import tempfile
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask


ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("VOICE_STORAGE_DIR", ROOT.parent / "server" / "storage" / "voice-profiles"))
VOICES_FILE = DATA_DIR / "voices.json"
MAX_SAMPLE_BYTES = 25 * 1024 * 1024
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"

app = FastAPI(title="MCQ Voice Service")
model = None
model_lock = threading.RLock()
catalog_lock = threading.Lock()
conditioning_cache = {}


class SynthesisRequest(BaseModel):
    owner_id: str = Field(min_length=1, max_length=128)
    voice_id: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1, max_length=5000)
    language: str = Field(pattern=r"^(en-IN|hi-IN)$")


def read_catalog():
    if not VOICES_FILE.exists():
        return []
    try:
        payload = json.loads(VOICES_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return payload if isinstance(payload, list) else []


def write_catalog(voices):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary_file = VOICES_FILE.with_suffix(".tmp")
    temporary_file.write_text(json.dumps(voices, ensure_ascii=True, indent=2), encoding="utf-8")
    temporary_file.replace(VOICES_FILE)


def profile_samples(entry):
    samples = entry.get("samples")
    if isinstance(samples, list) and samples:
        return samples
    sample_path = entry.get("sample_path")
    if sample_path:
        return [{"sample_path": sample_path, "language": "en-IN", "subject": "general", "transcript": ""}]
    return []


def get_model():
    global model
    if model is None:
        from TTS.api import TTS

        with model_lock:
            if model is None:
                device = os.getenv("VOICE_MODEL_DEVICE", "cpu")
                model = TTS(MODEL_NAME, progress_bar=False).to(device)
    return model


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.get("/voices")
def voices(owner_id: str):
    with catalog_lock:
        owned_voices = [
            {
                "id": entry["id"],
                "name": entry["name"],
                "sample_count": len(profile_samples(entry)),
                "sample_sections": [
                    {"language": sample.get("language", "en-IN"), "subject": sample.get("subject", "general")}
                    for sample in profile_samples(entry)
                ],
            }
            for entry in read_catalog()
            if entry.get("owner_id") == owner_id
        ]
    return {"voices": owned_voices}


@app.post("/voices", status_code=201)
async def enroll_voice(
    request: Request,
    owner_id: str,
    name: str,
    consent: bool = False,
    language: str = "en-IN",
    subject: str = "general",
    transcript: str = "",
):
    clean_name = name.strip()
    if not consent:
        raise HTTPException(status_code=400, detail="Voice-use permission confirmation is required.")
    if not clean_name or len(clean_name) > 60:
        raise HTTPException(status_code=400, detail="Voice name must be between 1 and 60 characters.")
    if language not in {"en-IN", "hi-IN"} or not subject.strip() or len(subject) > 100 or len(transcript) > 5000:
        raise HTTPException(status_code=400, detail="Invalid sample language, subject, or transcript.")

    sample = await request.body()
    if len(sample) < 4096 or len(sample) > MAX_SAMPLE_BYTES:
        raise HTTPException(status_code=400, detail="WAV sample must be between 4 KB and 25 MB.")
    if sample[:4] != b"RIFF" or sample[8:12] != b"WAVE":
        raise HTTPException(status_code=400, detail="The uploaded sample must be a valid WAV file.")

    voice_id = uuid.uuid4().hex
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    sample_path = DATA_DIR / f"{voice_id}.wav"
    sample_path.write_bytes(sample)
    entry = {
        "id": voice_id,
        "name": clean_name,
        "owner_id": owner_id,
        "sample_path": str(sample_path),
        "samples": [{
            "sample_path": str(sample_path),
            "language": language,
            "subject": subject.strip().lower(),
            "transcript": transcript,
        }],
    }
    with catalog_lock:
        catalog = read_catalog()
        catalog.append(entry)
        write_catalog(catalog)
    return {"voice": {"id": voice_id, "name": clean_name}}


@app.post("/voices/{voice_id}/samples", status_code=201)
async def add_voice_sample(
    voice_id: str,
    request: Request,
    owner_id: str,
    language: str,
    subject: str,
    transcript: str = "",
    consent: bool = False,
):
    if not consent:
        raise HTTPException(status_code=400, detail="Voice-use permission confirmation is required.")
    if language not in {"en-IN", "hi-IN"} or not subject.strip() or len(subject) > 100 or len(transcript) > 5000:
        raise HTTPException(status_code=400, detail="Invalid sample language, subject, or transcript.")
    sample = await request.body()
    if len(sample) < 4096 or len(sample) > MAX_SAMPLE_BYTES or sample[:4] != b"RIFF" or sample[8:12] != b"WAVE":
        raise HTTPException(status_code=400, detail="Sample must be a valid WAV file between 4 KB and 25 MB.")

    with catalog_lock:
        catalog = read_catalog()
        entry = next((
            voice for voice in catalog
            if voice.get("id") == voice_id and voice.get("owner_id") == owner_id
        ), None)
        if not entry:
            raise HTTPException(status_code=404, detail="Custom voice was not found for this account.")
        samples = profile_samples(entry)
        if len(samples) >= 600:
            raise HTTPException(status_code=400, detail="A voice profile can contain at most 600 recordings.")

        sample_id = uuid.uuid4().hex
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        sample_path = DATA_DIR / f"{voice_id}-{sample_id}.wav"
        sample_path.write_bytes(sample)
        samples.append({
            "sample_path": str(sample_path),
            "language": language,
            "subject": subject.strip().lower(),
            "transcript": transcript,
        })
        entry["samples"] = samples
        write_catalog(catalog)
    return {"sample": {"id": sample_id, "language": language, "subject": subject.strip().lower()}}


@app.delete("/voices/{voice_id}")
def delete_voice(voice_id: str, owner_id: str):
    with catalog_lock:
        catalog = read_catalog()
        entry = next((
            voice for voice in catalog
            if voice.get("id") == voice_id and voice.get("owner_id") == owner_id
        ), None)
        if not entry:
            raise HTTPException(status_code=404, detail="Custom voice was not found for this account.")

        for sample in profile_samples(entry):
            sample_path = Path(sample.get("sample_path", "")).resolve()
            if sample_path.parent == DATA_DIR.resolve():
                sample_path.unlink(missing_ok=True)
        write_catalog([voice for voice in catalog if voice.get("id") != voice_id])
    return {"voice": {"id": voice_id, "name": entry["name"]}}


@app.post("/synthesize")
def synthesize(payload: SynthesisRequest):
    with catalog_lock:
        entry = next((
            voice for voice in read_catalog()
            if voice.get("id") == payload.voice_id and voice.get("owner_id") == payload.owner_id
        ), None)
    samples = profile_samples(entry) if entry else []
    available_samples = [sample for sample in samples if Path(sample["sample_path"]).is_file()]
    if not entry or not available_samples:
        raise HTTPException(status_code=404, detail="Custom voice was not found for this account.")

    language = "hi" if payload.language == "hi-IN" else "en"
    matching_samples = [sample for sample in available_samples if sample.get("language") == payload.language]
    reference_paths = [sample["sample_path"] for sample in (matching_samples or available_samples)[-3:]]
    reference_signature = tuple(
        (sample_path, Path(sample_path).stat().st_size, Path(sample_path).stat().st_mtime_ns)
        for sample_path in reference_paths
    )
    cache_key = (payload.owner_id, payload.voice_id, reference_signature)
    output_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    output_path = Path(output_file.name)
    output_file.close()
    try:
        with model_lock:
            tts = get_model()
            xtts = tts.synthesizer.tts_model
            conditioning = conditioning_cache.get(cache_key)
            if conditioning is None:
                speaker_wav = reference_paths[0] if len(reference_paths) == 1 else reference_paths
                conditioning = xtts.get_conditioning_latents(audio_path=speaker_wav)
                conditioning_cache[cache_key] = conditioning

            audio = xtts.inference(
                text=payload.text,
                language=language,
                gpt_cond_latent=conditioning[0],
                speaker_embedding=conditioning[1],
            )["wav"]
            tts.synthesizer.save_wav(wav=audio, path=str(output_path))
    except Exception as error:
        output_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Voice synthesis failed: {error}") from error

    return FileResponse(
        output_path,
        media_type="audio/wav",
        filename="narration.wav",
        background=BackgroundTask(output_path.unlink, missing_ok=True),
    )