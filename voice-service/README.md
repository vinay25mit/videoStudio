# Voice Service

This standalone FastAPI service provides XTTS v2 voice cloning for MCQ Video Studio. It enrolls a WAV reference sample and uses that sample during synthesis; it does not fine-tune or train model weights. Use a clear recording of a voice you own or have explicit permission to use.

## Requirements

- Python 3.10
- FFmpeg available on `PATH` (required by the XTTS audio stack)
- A CPU for slower local inference, or a compatible PyTorch/CUDA setup for faster inference
- Review the XTTS v2 model license and its usage terms before downloading or using the model

## Run

From this folder, create a Python 3.10 virtual environment and install `requirements.txt` once:

```powershell
py -3.10 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

After setup, opening Voice Studio automatically starts the service from `voice-service/.venv`; it does not need to be launched manually. The model downloads when the first custom voice is used. Keep the service bound to localhost unless you add authentication and TLS. The Node server connects to `http://127.0.0.1:8001` by default; configure `VOICE_SERVICE_URL` if needed. Both services use `storage/voice-profiles/` for the profile catalog and recordings. Node can create and manage profiles while this Python service is offline; this service is required when generating audio with a custom profile.

## Enroll a voice

In the app's Voice Studio page, provide a name, choose the displayed script language, and record through your browser microphone. The library has 40 topics for each of seven subjects, grouped into five subsubjects, with an English and Hindi script for every topic. Read the complete on-screen script; its topic, text, and language are saved with the audio. Then confirm that you have permission to use the voice. The profile is stored under `storage/voice-profiles/` and is scoped to the signed-in MCQ Video Studio account. A complete 40-topic bilingual profile can contain up to 561 recordings including its initial sample, so plan for substantial disk space. Custom synthesis currently supports English and Hindi narration. Choose the saved profile in Voice Studio or from the Videos page's narration voice selector.