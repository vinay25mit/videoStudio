import { useEffect, useRef, useState } from 'react';
import { buildCurriculumScript, voiceCurriculum } from '../data/voiceCurriculum.js';
import Icon from '../components/Icon';

const defaultVoiceId = 'edge:default';

const languageOptions = [
  { id: 'en-IN', label: 'English' },
  { id: 'hi-IN', label: 'Hindi' },
];
const profileScripts = {
  'en-IN': [
    'I am recording this sample in my natural speaking voice.',
    'I will speak clearly and keep a steady pace, with a short pause between each sentence.',
    'This recording includes short words, longer phrases, and a few natural changes in pitch.',
    'Numbers and names are part of everyday speech: twenty-four, one hundred and fifty, and New Delhi.',
    'I will continue speaking comfortably, without trying to imitate another voice or change my usual accent.',
  ].join('\n'),
  'hi-IN': [
    'मैं यह नमूना अपनी स्वाभाविक आवाज़ में रिकॉर्ड कर रहा हूँ।',
    'मैं हर वाक्य के बीच थोड़ा रुककर साफ़ और सामान्य गति से बोलूँगा।',
    'इस रिकॉर्डिंग में छोटे शब्द, लंबे वाक्य और आवाज़ के स्वाभाविक उतार-चढ़ाव शामिल हैं।',
    'संख्याएँ और नाम रोज़मर्रा की बातचीत का हिस्सा हैं: चौबीस, एक सौ पचास और नई दिल्ली।',
    'मैं बिना किसी दूसरी आवाज़ की नकल किए अपने सामान्य लहजे में बोलता रहूँगा।',
  ].join('\n'),
};

async function convertRecordingToWav(recording) {
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await recording.arrayBuffer());
    const samples = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const channelSamples = decoded.getChannelData(channel);
      for (let sampleIndex = 0; sampleIndex < decoded.length; sampleIndex += 1) {
        samples[sampleIndex] += channelSamples[sampleIndex] / decoded.numberOfChannels;
      }
    }

    const wavBuffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wavBuffer);
    const writeText = (offset, value) => {
      for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
    };
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, decoded.sampleRate, true);
    view.setUint32(28, decoded.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      const value = Math.max(-1, Math.min(1, samples[sampleIndex]));
      view.setInt16(44 + sampleIndex * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    }
    return new File([wavBuffer], 'voice-recording.wav', { type: 'audio/wav' });
  } finally {
    await audioContext.close();
  }
}

export default function VoiceStudioPage() {
  const [voices, setVoices] = useState([]);
  const [serviceAvailable, setServiceAvailable] = useState(false);
  const [serviceMessage, setServiceMessage] = useState('');
  const [activeVoiceId, setActiveVoiceId] = useState(() => localStorage.getItem('mcq_default_voice') || defaultVoiceId);
  const [voiceName, setVoiceName] = useState('');
  const [profileLanguage, setProfileLanguage] = useState('en-IN');
  const [sample, setSample] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState('');
  const [sectionVoiceId, setSectionVoiceId] = useState('');
  const [sectionLanguage, setSectionLanguage] = useState('en-IN');
  const [sectionSubject, setSectionSubject] = useState('science');
  const [sectionSubsubject, setSectionSubsubject] = useState('physics');
  const [sectionTopicId, setSectionTopicId] = useState('science-physics-motion');
  const [sectionSample, setSectionSample] = useState(null);
  const [sectionConsent, setSectionConsent] = useState(false);
  const [savingSection, setSavingSection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingVoiceId, setDeletingVoiceId] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const refreshVoices = async () => {
    const token = localStorage.getItem('mcq_token');
    const response = await fetch('/api/tts/voices', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Could not load voices.');

    const nextVoices = payload.data?.voices || [];
    setVoices(nextVoices);
    setServiceAvailable(Boolean(payload.data?.serviceAvailable));
    setServiceMessage(payload.data?.serviceMessage || '');
    const firstCustomVoice = nextVoices.find((voice) => voice.id.startsWith('custom:'));
    setSectionVoiceId((current) => (
      nextVoices.some((voice) => voice.id === current) ? current : firstCustomVoice?.id || ''
    ));
    const preferredVoice = localStorage.getItem('mcq_default_voice') || defaultVoiceId;
    if (nextVoices.some((voice) => voice.id === preferredVoice)) {
      setActiveVoiceId(preferredVoice);
    } else {
      localStorage.setItem('mcq_default_voice', defaultVoiceId);
      setActiveVoiceId(defaultVoiceId);
    }
  };

  useEffect(() => {
    refreshVoices()
      .catch((loadError) => setError(loadError.message || 'Could not load voices.'))
      .finally(() => setLoading(false));
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const handleRecording = async (target = 'profile') => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Live recording is not supported by this browser. Try a current browser on localhost or HTTPS.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError('Microphone recording failed. Check browser microphone permissions.');
        setRecording(false);
        setRecordingTarget('');
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onstop = async () => {
        setRecording(false);
        setRecordingTarget('');
        stream.getTracks().forEach((track) => track.stop());
        try {
          const recordingBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const wavSample = await convertRecordingToWav(recordingBlob);
          if (target === 'section') setSectionSample(wavSample);
          else setSample(wavSample);
          setError('');
        } catch {
          setError('Could not prepare the recording. Check microphone access and try recording again.');
        }
      };
      recorder.start();
      setRecording(true);
      setRecordingTarget(target);
      setError('');
    } catch {
      setError('Microphone access was denied or is unavailable in this browser.');
    }
  };

  const handleCreateVoice = async (event) => {
    event.preventDefault();
    if (!voiceName.trim() || !sample || !consent) {
      setError('Add a name and recording, then confirm that you have permission to use this voice.');
      return;
    }
    if (sample.size > 25 * 1024 * 1024) {
      setError('Keep each voice sample below 25 MB.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('mcq_token');
      const query = new URLSearchParams({
        name: voiceName.trim(),
        language: profileLanguage,
        subject: 'general',
        transcript: profileScripts[profileLanguage],
      });
      const response = await fetch(`/api/voice-model/voices?${query}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/wav',
          'X-Voice-Consent': 'true',
        },
        body: sample,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Could not save the microphone recording.');

      await refreshVoices();
      const nextId = `custom:${payload.data.id}`;
      setSectionVoiceId(nextId);
      localStorage.setItem('mcq_default_voice', nextId);
      setActiveVoiceId(nextId);
      setVoiceName('');
      setSample(null);
      setConsent(false);
    } catch (saveError) {
      setError(saveError.message || 'Could not create this voice profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSectionSample = async (event) => {
    event.preventDefault();
    if (!sectionVoiceId || !sectionSample || !sectionConsent) {
      setError('Choose a custom voice, add a section recording, and confirm voice permission.');
      return;
    }
    if (sectionSample.size > 25 * 1024 * 1024) {
      setError('Keep each section recording below 25 MB.');
      return;
    }

    const selectedSubject = voiceCurriculum.find((subject) => subject.id === sectionSubject);
    const selectedSubsubject = selectedSubject?.subsubjects.find((subsubject) => subsubject.id === sectionSubsubject);
    const selectedTopic = selectedSubsubject?.topics.find((topic) => `${sectionSubject}-${sectionSubsubject}-${topic[0]}` === sectionTopicId);
    if (!selectedSubject || !selectedSubsubject || !selectedTopic) {
      setError('Select a valid subject, subsubject, and topic.');
      return;
    }
    const transcript = buildCurriculumScript({
      subjectId: sectionSubject,
      subject: selectedSubject.name,
      subsubject: selectedSubsubject.name,
      topic: { en: selectedTopic[1], hi: selectedTopic[2] },
      language: sectionLanguage,
    });
    const voiceId = sectionVoiceId.slice('custom:'.length);
    const query = new URLSearchParams({
      language: sectionLanguage,
      subject: sectionTopicId,
      transcript,
    });

    setSavingSection(true);
    setError('');
    try {
      const response = await fetch(`/api/voice-model/voices/${voiceId}/samples?${query}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('mcq_token')}`,
          'Content-Type': 'audio/wav',
          'X-Voice-Consent': 'true',
        },
        body: sectionSample,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Could not save this section recording.');
      await refreshVoices();
      setSectionSample(null);
    } catch (saveError) {
      setError(saveError.message || 'Could not save this section recording.');
    } finally {
      setSavingSection(false);
    }
  };

  const handleSelectVoice = (voiceId) => {
    localStorage.setItem('mcq_default_voice', voiceId);
    setActiveVoiceId(voiceId);
  };

  const handleDeleteVoice = async (voice) => {
    const voiceId = voice.id.slice('custom:'.length);
    if (!window.confirm(`Delete the voice profile "${voice.name}" and its recording?`)) return;

    setDeletingVoiceId(voiceId);
    setError('');
    try {
      const response = await fetch(`/api/voice-model/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('mcq_token')}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Could not delete this voice.');
      if (activeVoiceId === voice.id) handleSelectVoice(defaultVoiceId);
      await refreshVoices();
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this voice.');
    } finally {
      setDeletingVoiceId('');
    }
  };

  const builtInVoices = voices.filter((voice) => !voice.id.startsWith('custom:'));
  const customVoices = voices.filter((voice) => voice.id.startsWith('custom:'));
  const selectedCurriculumSubject = voiceCurriculum.find((subject) => subject.id === sectionSubject);
  const selectedCurriculumSubsubject = selectedCurriculumSubject?.subsubjects.find((subsubject) => subsubject.id === sectionSubsubject);
  const availableTopics = selectedCurriculumSubsubject?.topics || [];
  const selectedCurriculumTopic = availableTopics.find((topic) => `${sectionSubject}-${sectionSubsubject}-${topic[0]}` === sectionTopicId);
  const selectedCurriculumVoice = customVoices.find((voice) => voice.id === sectionVoiceId);
  const completedTopicIds = new Set(
    (selectedCurriculumVoice?.sampleSections || [])
      .filter((section) => section.language === sectionLanguage)
      .map((section) => section.subject),
  );
  const selectedScript = selectedCurriculumSubject && selectedCurriculumSubsubject && selectedCurriculumTopic
    ? buildCurriculumScript({
      subjectId: sectionSubject,
      subject: selectedCurriculumSubject.name,
      subsubject: selectedCurriculumSubsubject.name,
      topic: { en: selectedCurriculumTopic[1], hi: selectedCurriculumTopic[2] },
      language: sectionLanguage,
    })
    : '';
  const selectedLanguageLabel = languageOptions.find((language) => language.id === sectionLanguage)?.label || 'English';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Voice Studio</p>
          <h1 className="page-title"><Icon name="microphone" size={23} />Voice Library</h1>
        </div>
        <div className="voice-count">{customVoices.length} custom {customVoices.length === 1 ? 'voice' : 'voices'}</div>
      </header>

      {!serviceAvailable && (
        <div className="error-box">
          Voice Studio tried to start the model service automatically, but it is still offline. {serviceMessage || 'You can save recordings now; custom voice narration requires the Python service.'}
        </div>
      )}
      {error && <div className="error-box">{error}</div>}

      <section className="voice-library-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ready to use</p>
            <h2 className="icon-heading"><Icon name="microphone" />Built-in voices</h2>
          </div>
        </div>
        <div className="voice-grid">
          {builtInVoices.map((voice) => (
            <article className={`voice-profile ${activeVoiceId === voice.id ? 'active' : ''}`} key={voice.id}>
              <div className="voice-profile-copy">
                <span className="voice-type">Built in</span>
                <h3>{voice.name}</h3>
                <p>{activeVoiceId === voice.id ? 'Selected for video narration' : 'Available for video narration'}</p>
              </div>
              <button type="button" className={activeVoiceId === voice.id ? 'secondary-btn' : 'outline-btn'} onClick={() => handleSelectVoice(voice.id)}>
                <Icon name="microphone" size={16} />
                {activeVoiceId === voice.id ? 'Selected' : 'Use voice'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="voice-library-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your profiles</p>
            <h2 className="icon-heading"><Icon name="microphone" />Custom voices</h2>
          </div>
        </div>
        {loading ? <p className="list-subtitle">Loading voices...</p> : customVoices.length ? (
          <div className="voice-grid">
            {customVoices.map((voice) => (
              <article className={`voice-profile ${activeVoiceId === voice.id ? 'active' : ''}`} key={voice.id}>
                <div className="voice-profile-copy">
                  <span className="voice-type">Reference voice</span>
                  <h3>{voice.name}</h3>
                  <p>{voice.sampleCount || 0} recordings across {voice.sampleSections?.length || 0} sections</p>
                  <p>{activeVoiceId === voice.id ? 'Selected for video narration' : 'Saved to your voice library'}</p>
                </div>
                <div className="voice-profile-actions">
                  <button type="button" className={activeVoiceId === voice.id ? 'secondary-btn' : 'outline-btn'} onClick={() => handleSelectVoice(voice.id)}>
                    <Icon name="microphone" size={16} />
                    {activeVoiceId === voice.id ? 'Selected' : 'Use voice'}
                  </button>
                  <button type="button" className="danger-btn" disabled={deletingVoiceId === voice.id.slice('custom:'.length)} onClick={() => handleDeleteVoice(voice)}>
                    <Icon name="trash" size={16} />
                    {deletingVoiceId === voice.id.slice('custom:'.length) ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="empty-state"><p>No custom voices yet.</p></div>}
      </section>

      <section className="voice-create-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Add a profile</p>
            <h2 className="icon-heading"><Icon name="plus" />Create a custom voice</h2>
          </div>
        </div>
        <form className="voice-create-form" onSubmit={handleCreateVoice}>
          <label className="field">
            <span>Voice name</span>
            <input value={voiceName} maxLength={60} onChange={(event) => setVoiceName(event.target.value)} placeholder="My narration voice" />
          </label>
          <div className="training-language-picker" aria-label="Profile sample language">
            {languageOptions.map((language) => (
              <button key={language.id} type="button" className={profileLanguage === language.id ? 'active' : ''} onClick={() => setProfileLanguage(language.id)}>
                {language.label}
              </button>
            ))}
          </div>
          <div className="sample-prompt">
            <span>Initial voice script: {languageOptions.find((language) => language.id === profileLanguage)?.label}</span>
            <p className="sample-prompt-instruction">Read every line in your normal speaking voice, then stop the recording:</p>
            <div className="recording-script">
              {profileScripts[profileLanguage].split('\n').map((line, index) => (
                <p key={`profile-${profileLanguage}-${index}`}>
                  <span>Line {index + 1}</span>
                  {line}
                </p>
              ))}
            </div>
          </div>
          <div className="recording-row">
            <button type="button" className={recording && recordingTarget === 'profile' ? 'danger-btn' : 'outline-btn'} onClick={() => handleRecording('profile')} disabled={recording && recordingTarget !== 'profile'}>
              <Icon name="microphone" size={16} />
              {recording && recordingTarget === 'profile' ? 'Stop recording' : 'Record with microphone'}
            </button>
            <span className="list-subtitle">{sample ? `${sample.name} ready` : 'Use a quiet 10-30 second sample.'}</span>
          </div>
          <label className="voice-consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            I own this voice or have permission to use it.
          </label>
          <button className="primary-btn" type="submit" disabled={saving || recording || !voiceName.trim() || !sample || !consent}>
            <Icon name="save" size={17} />
            {saving ? 'Creating profile...' : 'Create voice profile'}
          </button>
          <p className="voice-note">Start with a reference sample, then add prompted recordings for each language and subject section below.</p>
        </form>
      </section>

      <section className="voice-create-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Voice dataset</p>
            <h2 className="icon-heading"><Icon name="book" />Record the subject curriculum</h2>
          </div>
        </div>
        {customVoices.length ? (
          <form className="voice-create-form" onSubmit={handleAddSectionSample}>
            <label className="field">
              <span>Voice profile</span>
              <select value={sectionVoiceId} onChange={(event) => setSectionVoiceId(event.target.value)}>
                {customVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
              </select>
            </label>
            <div className="training-language-picker" aria-label="Recording language">
              {languageOptions.map((language) => (
                <button key={language.id} type="button" className={sectionLanguage === language.id ? 'active' : ''} onClick={() => setSectionLanguage(language.id)}>
                  {language.label}
                </button>
              ))}
            </div>
            <div className="voice-section-grid">
              {voiceCurriculum.map((subject) => {
                const subjectTopicIds = subject.subsubjects.flatMap((subsubject) => (
                  subsubject.topics.map((topic) => `${subject.id}-${subsubject.id}-${topic[0]}`)
                ));
                const completedCount = subjectTopicIds.filter((topicId) => completedTopicIds.has(topicId)).length;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    className={`voice-section-option ${sectionSubject === subject.id ? 'active' : ''}`}
                    onClick={() => {
                      const firstSubsubject = subject.subsubjects[0];
                      setSectionSubject(subject.id);
                      setSectionSubsubject(firstSubsubject.id);
                      setSectionTopicId(`${subject.id}-${firstSubsubject.id}-${firstSubsubject.topics[0][0]}`);
                    }}
                  >
                    <span>{subject.name[sectionLanguage === 'hi-IN' ? 'hi' : 'en']}</span>
                    <small>{completedCount}/40 topics recorded</small>
                  </button>
                );
              })}
            </div>
            <label className="field">
              <span>Subsubject</span>
              <select
                value={sectionSubsubject}
                onChange={(event) => {
                  const nextSubsubject = selectedCurriculumSubject.subsubjects.find((subsubject) => subsubject.id === event.target.value);
                  setSectionSubsubject(nextSubsubject.id);
                  setSectionTopicId(`${sectionSubject}-${nextSubsubject.id}-${nextSubsubject.topics[0][0]}`);
                }}
              >
                {selectedCurriculumSubject?.subsubjects.map((subsubject) => (
                  <option key={subsubject.id} value={subsubject.id}>{subsubject.name[sectionLanguage === 'hi-IN' ? 'hi' : 'en']}</option>
                ))}
              </select>
            </label>
            <div className="voice-section-grid">
              {availableTopics.map((topic) => {
                const topicId = `${sectionSubject}-${sectionSubsubject}-${topic[0]}`;
                const completed = completedTopicIds.has(topicId);
                return (
                  <button key={topicId} type="button" className={`voice-section-option ${sectionTopicId === topicId ? 'active' : ''}`} onClick={() => setSectionTopicId(topicId)}>
                    <span>{topic[sectionLanguage === 'hi-IN' ? 2 : 1]}</span>
                    <small>{completed ? 'Recording saved' : 'Needs recording'}</small>
                  </button>
                );
              })}
            </div>
            <div className="sample-prompt">
              <span>Recording script: {selectedLanguageLabel} / {selectedCurriculumSubject?.name[sectionLanguage === 'hi-IN' ? 'hi' : 'en']} / {selectedCurriculumSubsubject?.name[sectionLanguage === 'hi-IN' ? 'hi' : 'en']} / {selectedCurriculumTopic?.[sectionLanguage === 'hi-IN' ? 2 : 1]}</span>
              <p className="sample-prompt-instruction">Read each line clearly and naturally while recording:</p>
              <div className="recording-script">
                {selectedScript.split('\n').map((line, index) => (
                  <p key={`${sectionSubject}-${sectionLanguage}-${index}`}>
                    <span>Line {index + 1}</span>
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <div className="recording-row">
              <button type="button" className={recording && recordingTarget === 'section' ? 'danger-btn' : 'outline-btn'} onClick={() => handleRecording('section')} disabled={recording && recordingTarget !== 'section'}>
                <Icon name="microphone" size={16} />
                {recording && recordingTarget === 'section' ? 'Stop section recording' : 'Record this section'}
              </button>
              <span className="list-subtitle">{sectionSample ? `${sectionSample.name} ready` : 'WAV, maximum 25 MB'}</span>
            </div>
            <label className="voice-consent">
              <input type="checkbox" checked={sectionConsent} onChange={(event) => setSectionConsent(event.target.checked)} />
              I own this voice or have permission to use it.
            </label>
            <button className="primary-btn" type="submit" disabled={savingSection || recording}>
              <Icon name="save" size={17} />
              {savingSection ? 'Saving recording...' : 'Save section recording'}
            </button>
            <p className="voice-note">Record both languages across subjects for stronger reference coverage. These clips are used for voice conditioning; true model fine-tuning is not included in this service yet.</p>
          </form>
        ) : (
          <div className="summary-box">Create a custom voice profile first, then record its language and subject sections here.</div>
        )}
      </section>
    </div>
  );
}
