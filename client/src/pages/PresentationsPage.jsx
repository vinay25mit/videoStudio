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
  {
    id: 'q3',
    question: 'Who chairs the Rajya Sabha?',
    optionA: 'Prime Minister',
    optionB: 'President',
    optionC: 'Vice President',
    optionD: 'Speaker',
    correctAnswer: 'C',
    explanation: 'The Vice President chairs the Rajya Sabha.',
  },
];

const defaultForm = {
  title: 'BPSC Current Affairs MCQ',
  questionCount: 2,
};

const newestFirst = (items) => [...items].sort((first, second) =>
  (Date.parse(second.createdAt || '') || 0) - (Date.parse(first.createdAt || '') || 0));

export default function PresentationsPage() {
  const [form, setForm] = useState({ ...defaultForm, mode: 'mcq', explanationLanguage: 'english' });
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [error, setError] = useState('');

  const validateContent = (data, mode) => {
    if (!data || Array.isArray(data) || typeof data !== 'object' || typeof data.title !== 'string' || !data.title.trim()) throw new Error('JSON must contain a presentation title.');
    if (mode === 'mcq') {
      if (!Array.isArray(data.questions) || !data.questions.length) throw new Error('MCQ JSON must contain at least one question.');
      data.questions.forEach((q, i) => {
        const opts = q?.options || { A: q?.optionA, B: q?.optionB, C: q?.optionC, D: q?.optionD };
        if (!q?.question?.trim() || !['A', 'B', 'C', 'D'].every((key) => typeof opts[key] === 'string' && opts[key].trim()) || !['A', 'B', 'C', 'D'].includes(String(q.correctAnswer || '').toUpperCase()) || !q.explanation?.trim()) throw new Error(`Question ${i + 1} needs a question, options A-D, correctAnswer, and explanation.`);
      });
    } else {
      if (!Array.isArray(data.sections) || !data.sections.length) throw new Error('JSON must contain at least one section for this mode.');
      data.sections.forEach((section, i) => {
        const meaningful = ['description', 'explanation', 'code', 'output'].some((key) => typeof section?.[key] === 'string' && section[key].trim()) || section?.bulletPoints?.some?.((item) => typeof item === 'string' && item.trim()) || section?.examples?.some?.((item) => typeof item === 'string' && item.trim());
        if (!section?.title?.trim() || !meaningful || (mode === 'educational' && !section.description?.trim())) throw new Error(`Section ${i + 1} needs a title and meaningful content${mode === 'educational' ? ', including a description' : ''}.`);
      });
    }
  };

  const handleFile = async (file) => {
    setUploaded(null); setUploadName(''); setError('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) { setError('Choose a .json file.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      validateContent(parsed, form.mode);
      setUploaded(parsed); setUploadName(file.name); setForm((current) => ({ ...current, title: parsed.title }));
    } catch (err) { setError(err instanceof SyntaxError ? 'Invalid JSON syntax. Check the uploaded file.' : err.message); }
  };

  const downloadAsset = async (url, fileName) => {
    const token = localStorage.getItem('mcq_token');
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
  };

  useEffect(() => {
    const token = localStorage.getItem('mcq_token');
    if (!token) return;

    fetch('/api/presentations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success && Array.isArray(payload.data)) {
          setPresentations(newestFirst(payload.data));
        }
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.title.trim()) return;
    try { if (uploaded) validateContent(uploaded, form.mode); else if (form.mode !== 'mcq') throw new Error('Upload a JSON file for Educational Content and Coding Tutorial modes.'); }
    catch (err) { setError(err.message); return; }

    setLoading(true);
    const selected = demoQuestions.slice(0, Number(form.questionCount || 1));

    try {
      const token = localStorage.getItem('mcq_token');

      if (token) {
        const response = await fetch('/api/presentations/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: uploaded?.title || form.title.trim(),
            mode: form.mode,
            explanationLanguage: form.explanationLanguage,
            ...(uploaded ? { data: uploaded } : { questions: selected }),
          }),
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || 'Presentation generation failed.');
        if (payload?.success && payload?.data) {
          setPresentations((current) => newestFirst([payload.data, ...current]));
        }
      } else {
        setPresentations((current) => newestFirst([
          {
            id: `ppt-${Date.now()}`,
            title: form.title.trim(),
            fileName: `${form.title.trim().replace(/\s+/g, '-').toLowerCase()}.pptx`,
            questionCount: selected.length,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ]));
      }
    } catch (err) {
      setError(err.message || 'Presentation generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Presentations</p>
          <h1 className="page-title"><Icon name="presentation" size={23} />Generate PPT</h1>
        </div>
      </header>

      <div className="two-column-layout">
        <form className="card" onSubmit={handleGenerate}>
          <h3 className="icon-heading"><Icon name="plus" />Create Presentation</h3>

          <label className="field">
            <span>Presentation Type</span>
            <select value={form.mode} onChange={(event) => { setForm((current) => ({ ...current, mode: event.target.value })); setUploaded(null); setUploadName(''); setError(''); }}>
              <option value="mcq">MCQ Question Mode</option>
              <option value="educational">Educational Content Mode</option>
              <option value="coding">Coding Tutorial Mode</option>
            </select>
          </label>

          <label className="field">
            <span>Upload JSON content</span>
            <input type="file" accept=".json,application/json" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          {error && <div role="alert" className="error-message">{error}</div>}
          {uploaded && <div className="summary-box">
            <strong>{uploaded.title}</strong><br />Content type: {form.mode === 'mcq' ? 'MCQ questions' : form.mode === 'coding' ? 'Coding tutorial sections' : 'Educational sections'}<br />
            {uploaded.subject && <>Subject: {uploaded.subject}<br /></>}
            {form.mode === 'mcq' ? `${uploaded.questions.length} questions` : `${uploaded.sections.length} sections${form.mode === 'coding' ? ` · ${uploaded.sections.filter((section) => section.code).length} code snippets` : ''}`}
            <br />File: {uploadName}
          </div>}
          {uploaded && <div className="question-list-box"><strong>Content preview</strong>{(form.mode === 'mcq' ? uploaded.questions : uploaded.sections).slice(0, 4).map((item, index) => <div key={index} className="mini-question-item"><span className="badge">{form.mode === 'mcq' ? `Q${index + 1}` : `S${index + 1}`}</span><span>{item.question || item.title}{item.description ? ` — ${item.description}` : ''}{item.code ? ' · code included' : ''}</span></div>)}</div>}

          {form.mode === 'mcq' && uploaded && <label className="field"><span>Explanation language</span><select value={form.explanationLanguage} onChange={(event) => setForm((current) => ({ ...current, explanationLanguage: event.target.value }))}><option value="english">English</option><option value="hindi">Hindi</option><option value="hinglish">Hinglish</option></select></label>}

          {form.mode === 'mcq' && !uploaded && <><label className="field">
            <span>Presentation Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="BPSC Current Affairs MCQ"
            />
          </label>

          <label className="field">
            <span>Questions to include</span>
            <select
              value={form.questionCount}
              onChange={(event) => setForm((current) => ({ ...current, questionCount: Number(event.target.value) }))}
            >
              <option value={1}>1 question</option>
              <option value={2}>2 questions</option>
              <option value={3}>3 questions</option>
            </select>
          </label>

          <div className="summary-box">
            <strong>{form.questionCount}</strong> selected questions
          </div>

          <div className="question-list-box">
            {demoQuestions.slice(0, form.questionCount).map((question, index) => (
              <div key={question.id} className="mini-question-item">
                <span className="badge">Q{index + 1}</span>
                <span>{question.question}</span>
              </div>
            ))}
          </div></>}

          <button className="primary-btn" type="submit" disabled={loading}>
            <Icon name="sparkles" size={17} />
            {loading ? 'Generating...' : 'Generate PPT'}
          </button>
        </form>

        <div className="card">
          <h3 className="icon-heading"><Icon name="presentation" />Recent Presentations</h3>

          {presentations.length === 0 ? (
            <div className="empty-state">
              <h3>No slides generated yet</h3>
              <p>Create a presentation from a question set to get started.</p>
            </div>
          ) : (
            <div className="stack-list">
              {presentations.map((presentation) => (
                <div key={presentation.id} className="list-item presentation-item">
                  <div>
                    <div className="list-title">{presentation.title}</div>
                    <div className="list-subtitle">{presentation.fileName || 'Generated deck'}</div>
                  </div>
                  <div className="presentation-actions">
                    <div className="list-meta">{presentation.questionCount || 0} Qs</div>
                    {presentation.filePath && (
                      <button
                        type="button"
                        className="download-btn"
                        onClick={() => downloadAsset(`/api/presentations/${presentation.id}/download`, presentation.fileName || 'presentation.pptx')}
                      >
                        <Icon name="download" size={16} />
                        Download PPT
                      </button>
                    )}
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
