import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';

const demoQuestions = [
  { id: 'q-1', question: 'Which country hosted the meeting?', correctAnswer: 'B' },
  { id: 'q-2', question: 'Which institution publishes the GDP data?', correctAnswer: 'C' },
  { id: 'q-3', question: 'Who is the chair of the Rajya Sabha?', correctAnswer: 'A' },
];

const demoSets = [
  { id: 's-1', name: 'BPSC Current Affairs Set 01', description: 'Daily current affairs review', questionIds: ['q-1', 'q-2'] },
  { id: 's-2', name: 'UPSC Polity Quick Revision', description: 'Constitution and governance', questionIds: ['q-3'] },
];

export default function SetsPage() {
  const [sets, setSets] = useState(demoSets);
  const [form, setForm] = useState({ name: '', description: '', questionIds: ['q-1', 'q-2'] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('mcq_token');
    if (!token) return;

    setLoading(true);
    fetch('/api/sets', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success && Array.isArray(payload.data) && payload.data.length > 0) {
          setSets(payload.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedCount = useMemo(() => form.questionIds.length, [form.questionIds]);

  const handleQuestionToggle = (questionId) => {
    setForm((current) => {
      const exists = current.questionIds.includes(questionId);
      return {
        ...current,
        questionIds: exists
          ? current.questionIds.filter((id) => id !== questionId)
          : [...current.questionIds, questionId],
      };
    });
  };

  const handleCreateSet = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      questions: form.questionIds.map((id) => ({ id })),
    };

    const token = localStorage.getItem('mcq_token');

    if (token) {
      const response = await fetch('/api/sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result?.success && result?.data) {
        setSets((current) => [result.data, ...current]);
      }
    } else {
      const newSet = {
        id: `set-${Date.now()}`,
        name: form.name.trim(),
        description: form.description.trim(),
        questionIds: form.questionIds,
      };
      setSets((current) => [newSet, ...current]);
    }

    setForm({ name: '', description: '', questionIds: ['q-1', 'q-2'] });
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Question Sets</p>
          <h1 className="page-title"><Icon name="sets" size={23} />All Sets</h1>
        </div>
      </header>

      <div className="two-column-layout">
        <form className="card" onSubmit={handleCreateSet}>
          <h3 className="icon-heading"><Icon name="plus" />Create Set</h3>

          <label className="field">
            <span>Set Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="BPSC Current Affairs Set 02"
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Short description of this set"
              rows={4}
            />
          </label>

          <div className="selected-summary">
            Selected questions: <strong>{selectedCount}</strong>
          </div>

          <div className="question-picker">
            {demoQuestions.map((question) => (
              <label key={question.id} className="check-row">
                <input
                  type="checkbox"
                  checked={form.questionIds.includes(question.id)}
                  onChange={() => handleQuestionToggle(question.id)}
                />
                <span>{question.question}</span>
              </label>
            ))}
          </div>

          <button className="primary-btn" type="submit" disabled={loading || !form.name.trim()}>
            <Icon name="plus" size={17} />
            {loading ? 'Saving...' : 'Create Set'}
          </button>
        </form>

        <div className="card">
          <h3 className="icon-heading"><Icon name="sets" />Existing Sets</h3>
          <div className="stack-list">
            {sets.map((set) => (
              <div key={set.id} className="list-item">
                <div>
                  <div className="list-title">{set.name}</div>
                  <div className="list-subtitle">{set.description || 'No description provided.'}</div>
                </div>
                <div className="list-meta">{set.questionIds?.length || 0} Questions</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
