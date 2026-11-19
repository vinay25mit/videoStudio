import { useEffect, useState } from 'react';
import Icon from '../components/Icon';

const demoQuestions = [
  {
    id: 'q1',
    question: 'Which country hosted the meeting?',
    optionA: 'India',
    optionB: 'Japan',
    optionC: 'France',
    optionD: 'Germany',
    correctAnswer: 'B',
    explanation: 'Japan hosted the meeting.',
  },
  {
    id: 'q2',
    question: 'Which institution publishes the GDP data?',
    optionA: 'RBI',
    optionB: 'NITI Aayog',
    optionC: 'NSO',
    optionD: 'SEBI',
    correctAnswer: 'C',
    explanation: 'The National Statistical Office publishes GDP estimates.',
  },
];

export default function NarrationPage() {
  const [title, setTitle] = useState('Current Affairs Review');
  const [voice, setVoice] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [script, setScript] = useState('');
  const [srt, setSrt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;

    const updateVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    const token = localStorage.getItem('mcq_token');

    try {
      const response = await fetch('/api/narration/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, questions: demoQuestions }),
      });

      const payload = await response.json();
      if (payload?.success) {
        setScript(payload.data.script);
        setSrt(payload.data.srt);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = () => {
    if (!script || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const chosenVoice = voices.find((candidate) => candidate.voiceURI === voice) || voices[0];

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  const handleDownloadSrt = () => {
    if (!srt) return;

    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || 'narration').trim().replace(/\s+/g, '-').toLowerCase() || 'narration'}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Narration</p>
          <h1 className="page-title"><Icon name="narration" size={23} />Voiceover Script</h1>
        </div>
      </header>

      <div className="two-column-layout">
        <div className="card">
          <label className="field">
            <span>Video Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="field">
            <span>Voice</span>
            <select value={voice} onChange={(event) => setVoice(event.target.value)}>
              <option value="">Default voice</option>
              {availableVoices.map((candidate) => (
                <option key={candidate.voiceURI} value={candidate.voiceURI}>
                  {candidate.name} ({candidate.lang})
                </option>
              ))}
            </select>
          </label>

          <div className="inline-row">
            <button className="primary-btn" onClick={handleGenerate} disabled={loading}>
              <Icon name="sparkles" size={17} />
              {loading ? 'Generating...' : 'Generate Script'}
            </button>
            <button className="secondary-btn" onClick={handleSpeak} type="button" disabled={!script}>
              <Icon name="play" size={16} />
              Play Voice
            </button>
          </div>

          {srt && (
            <button className="secondary-btn" onClick={handleDownloadSrt} type="button" style={{ marginTop: '12px' }}>
              <Icon name="download" size={16} />
              Download SRT
            </button>
          )}
        </div>

        <div className="card">
          <h3 className="icon-heading"><Icon name="narration" />Generated narration</h3>
          {script ? (
            <div className="script-box">{script}</div>
          ) : (
            <div className="empty-state">
              <p>No script generated yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
