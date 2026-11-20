import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { normalizeQuestionImport } from '../lib/questionImport.js';
import Icon from '../components/Icon';

const defaultForm = {
  title: 'Daily Current Affairs Video',
  duration: 8,
  explanationLanguage: 'english',
  voiceSelection: 'edge:default',
};

const builtInVoices = [
  { id: 'edge:default', name: 'Indian voices (Swara Hindi/Hinglish · Neerja English)' },
  { id: 'edge:en-IN-NeerjaNeural', name: 'Neerja (English, female)' },
  { id: 'edge:en-IN-PrabhatNeural', name: 'Prabhat (English, male)' },
  { id: 'edge:hi-IN-SwaraNeural', name: 'Swara (Hindi and Hinglish, female)' },
];

function getPreferredBuiltInVoice() {
  const savedVoice = localStorage.getItem('mcq_default_voice');
  return builtInVoices.some((voice) => voice.id === savedVoice)
    ? savedVoice
    : defaultForm.voiceSelection;
}

export default function VideosPage() {
  const [form, setForm] = useState(() => ({
    ...defaultForm,
    voiceSelection: getPreferredBuiltInVoice(),
  }));
  const [questions, setQuestions] = useState([]);
  const [questionFileName, setQuestionFileName] = useState('');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(null);
  const [deletingVideoId, setDeletingVideoId] = useState('');
  const [error, setError] = useState('');
  const [voices, setVoices] = useState(builtInVoices);

  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const downloadAsset = async (url, fileName) => {
    const token = localStorage.getItem('mcq_token');
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message || 'Download failed.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError.message || 'Download failed.');
      window.alert(downloadError.message || 'Download failed.');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('mcq_token');
    if (!token) return;

    fetch('/api/videos', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success && Array.isArray(payload.data)) {
          setVideos(payload.data);
        }
      })
      .catch(() => {});

    fetch('/api/questions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success && Array.isArray(payload.data)) {
          setQuestions(payload.data);
        }
      })
      .catch(() => {});

    fetch('/api/tts/voices', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success && Array.isArray(payload.data?.voices)) {
          setVoices(builtInVoices);
          const preferredVoice = getPreferredBuiltInVoice();
          setForm((current) => ({
            ...current,
            voiceSelection: preferredVoice,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleQuestionFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    try {
      const imported = normalizeQuestionImport(JSON.parse(await file.text()));
      setQuestions(imported);
      setQuestionFileName(file.name);
    } catch (importError) {
      setError(importError.message || 'Could not read the question JSON file.');
      setQuestionFileName('');
    } finally {
      event.target.value = '';
    }
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (!questions.length) {
      setError('Load questions from your question bank or choose a JSON file first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('mcq_token');
      if (!token) throw new Error('Sign in before generating a video.');

      const response = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          questions,
          duration: Number(form.duration || 8),
          explanationLanguage: form.explanationLanguage,
          voiceSelection: form.voiceSelection,
        }),
      });

      const responseText = await response.text();
      let payload;
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = {};
      }
      if (!response.ok || !payload?.success || !payload?.data?.jobId) {
        const message = payload?.error?.message
          || (responseText && !Object.keys(payload).length ? responseText.slice(0, 300) : '')
          || `Video generation failed (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`;
        throw new Error(message);
      }

      const jobId = payload.data.jobId;
      while (true) {
        const jobResponse = await fetch(`/api/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const jobPayload = await jobResponse.json().catch(() => ({}));
        if (!jobResponse.ok || !jobPayload?.success || !jobPayload?.data) {
          throw new Error(jobPayload?.error?.message || 'Could not check video generation progress.');
        }

        const job = jobPayload.data;
        setGenerationProgress(job);
        if (job.status === 'failed') throw new Error(job.error || 'Video generation failed.');
        if (job.status === 'completed' && job.video) {
          setVideos((current) => [job.video, ...current]);
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
      }
    } catch (generateError) {
      setError(generateError.message || 'Video generation failed.');
    } finally {
      setLoading(false);
      setGenerationProgress(null);
    }
  };

  const handleDeleteVideo = async (video) => {
    if (!window.confirm(`Delete "${video.title}" and its generated files?`)) return;

    setDeletingVideoId(video.id);
    setError('');
    try {
      const token = localStorage.getItem('mcq_token');
      const response = await fetch(`/api/videos/${video.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Could not delete video.');
      }
      setVideos((current) => current.filter((entry) => entry.id !== video.id));
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete video.');
    } finally {
      setDeletingVideoId('');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Videos</p>
          <h1 className="page-title"><Icon name="video" size={23} />Generate Video</h1>
        </div>
      </header>

      <div className="two-column-layout">
        <form className="card" onSubmit={handleGenerate}>
          <h3 className="icon-heading"><Icon name="plus" />Create Video</h3>

          <label className="field">
            <span>Video Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Daily Current Affairs Video"
            />
          </label>

          <label className="field">
            <span>Question JSON file</span>
            <input type="file" accept=".json,application/json" onChange={handleQuestionFile} />
          </label>

          <div className="summary-box">
            <strong>{questions.length}</strong> questions loaded{questionFileName ? ` from ${questionFileName}` : ' from your question bank'}
          </div>

          <label className="field">
            <span>Duration (seconds)</span>
            <input
              type="number"
              min="5"
              max="30"
              value={form.duration}
              onChange={(event) => setForm((current) => ({ ...current, duration: Number(event.target.value) }))}
            />
          </label>

          <label className="field">
            <span>Spoken Explanation Language</span>
            <select
              value={form.explanationLanguage}
              onChange={(event) => setForm((current) => ({ ...current, explanationLanguage: event.target.value }))}
            >
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </label>

          <label className="field">
            <span>Narration Voice</span>
            <select
              value={form.voiceSelection}
              onChange={(event) => {
                localStorage.setItem('mcq_default_voice', event.target.value);
                setForm((current) => ({ ...current, voiceSelection: event.target.value }));
              }}
            >
              {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
            </select>
          </label>

          <p className="voice-library-link"><Link to="/voice-studio">Manage built-in and custom voices</Link></p>

          <div className="summary-box">
            Narration included • minimum <strong>{form.duration}s</strong>
          </div>

          {error && (
            <div className="error-box" role="alert" style={{ marginTop: '12px', color: '#ef4444', fontSize: '14px' }}>
              {error}
            </div>
          )}

          {loading && (
            <div className="video-generation-status" role="status" aria-live="polite">
              <strong>{generationProgress?.message || 'Starting video generation...'}</strong>
              <div className="video-generation-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={generationProgress?.progress || 0}>
                <span style={{ width: `${generationProgress?.progress || 0}%` }} />
              </div>
              <span>{generationProgress?.progress || 0}% · {questions.length} questions · {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')} elapsed</span>
              <p>Custom voice audio is synthesized locally on CPU, then assembled into the MP4. The finished video appears in Recent Videos.</p>
            </div>
          )}

          <button className="primary-btn" type="submit" disabled={loading}>
            <Icon name="sparkles" size={17} />
            {loading ? 'Generating...' : 'Generate Video'}
          </button>
        </form>

        <div className="card">
          <h3 className="icon-heading"><Icon name="video" />Recent Videos</h3>

          {videos.length === 0 ? (
            <div className="empty-state">
              <h3>No videos generated yet</h3>
              <p>Create a short MCQ video to start the pipeline.</p>
            </div>
          ) : (
            <div className="stack-list">
              {videos.map((video) => (
                <div key={video.id} className="list-item video-item">
                  <div>
                    <div className="list-title">{video.title}</div>
                    <div className="list-subtitle">{video.fileName || 'Generated video'}</div>
                    {video.presentationId && (
                      <div className="list-subtitle">Matching MCQ PPT ready: {video.presentationFileName}</div>
                    )}
                  </div>
                  <div className="presentation-actions">
                    <div className="list-meta">{video.questionCount || 0} Qs • {video.duration || 0}s</div>
                    {video.filePath && (
                      <button
                        type="button"
                        className="download-btn"
                        onClick={() => downloadAsset(`/api/videos/${video.id}/download`, video.fileName || 'video.mp4')}
                      >
                        <Icon name="download" size={16} />
                        Download MP4
                      </button>
                    )}
                    {video.presentationId && (
                      <Link className="secondary-btn" to="/presentations">Open PPT section</Link>
                    )}
                    {video.subtitleFilePath && (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => downloadAsset(`/api/videos/${video.id}/download-srt`, video.subtitleFileName || 'video.srt')}
                      >
                        <Icon name="download" size={16} />
                        Download SRT
                      </button>
                    )}
                    {video.metadataFilePath && (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => downloadAsset(`/api/videos/${video.id}/download-metadata`, video.metadataFileName || 'video-metadata.json')}
                      >
                        <Icon name="download" size={16} />
                        YouTube Metadata
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => handleDeleteVideo(video)}
                      disabled={deletingVideoId === video.id}
                    >
                      <Icon name="trash" size={16} />
                      {deletingVideoId === video.id ? 'Deleting...' : 'Delete Video'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
