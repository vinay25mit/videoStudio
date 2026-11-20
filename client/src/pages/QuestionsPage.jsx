import { useEffect, useState } from 'react';
import Icon from '../components/Icon';

const initialForm = {
  question: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctAnswer: 'A',
  explanation: '',
  hindiExplanation: '',
  hinglishExplanation: '',
  subject: 'Current Affairs',
  topic: 'General',
  difficulty: 'Medium',
};

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
    subject: 'Current Affairs',
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
    subject: 'Economy',
  },
];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState(demoQuestions);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('mcq_token');
    if (!token) return;

    setLoading(true);
    fetch('/api/questions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success && Array.isArray(payload.data) && payload.data.length > 0) {
          setQuestions(payload.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.question.trim() || !form.optionA.trim() || !form.optionB.trim() || !form.optionC.trim() || !form.optionD.trim()) {
      return;
    }

    const payload = {
      ...form,
      correctAnswer: form.correctAnswer.toUpperCase(),
    };

    const token = localStorage.getItem('mcq_token');

    if (token) {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result?.success && result?.data) {
        setQuestions((current) => [result.data, ...current]);
      }
    } else {
      const newQuestion = {
        id: `q-${Date.now()}`,
        ...payload,
      };
      setQuestions((current) => [newQuestion, ...current]);
    }

    setForm(initialForm);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Question Bank</p>
          <h1 className="page-title"><Icon name="questions" size={23} />All Questions</h1>
        </div>
      </header>

      <div className="two-column-layout">
        <form className="card" onSubmit={handleSubmit}>
          <h3 className="icon-heading"><Icon name="plus" />Add Question</h3>

          <label className="field">
            <span>Question</span>
            <textarea name="question" value={form.question} onChange={handleChange} rows={4} placeholder="Which country hosted the meeting?" />
          </label>

          <div className="option-grid">
            <label className="field">
              <span>Option A</span>
              <input name="optionA" value={form.optionA} onChange={handleChange} placeholder="India" />
            </label>
            <label className="field">
              <span>Option B</span>
              <input name="optionB" value={form.optionB} onChange={handleChange} placeholder="Japan" />
            </label>
            <label className="field">
              <span>Option C</span>
              <input name="optionC" value={form.optionC} onChange={handleChange} placeholder="France" />
            </label>
            <label className="field">
              <span>Option D</span>
              <input name="optionD" value={form.optionD} onChange={handleChange} placeholder="Germany" />
            </label>
          </div>

          <div className="inline-row">
            <label className="field">
              <span>Correct Answer</span>
              <select name="correctAnswer" value={form.correctAnswer} onChange={handleChange}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </label>

            <label className="field">
              <span>Subject</span>
              <input name="subject" value={form.subject} onChange={handleChange} />
            </label>
          </div>

          <label className="field">
            <span>Explanation</span>
            <textarea name="explanation" value={form.explanation} onChange={handleChange} rows={3} placeholder="Japan hosted the meeting." />
          </label>

          <label className="field">
            <span>Hindi Explanation</span>
            <textarea name="hindiExplanation" value={form.hindiExplanation} onChange={handleChange} rows={3} placeholder="जापान ने इस बैठक की मेज़बानी की थी।" />
          </label>

          <label className="field">
            <span>Hinglish Explanation</span>
            <textarea name="hinglishExplanation" value={form.hinglishExplanation} onChange={handleChange} rows={3} placeholder="Japan ne is meeting ko host kiya tha." />
          </label>

          <button className="primary-btn" type="submit" disabled={loading}>
            <Icon name="save" size={17} />
            {loading ? 'Saving...' : 'Save Question'}
          </button>
        </form>

        <div className="card table-card">
          <h3 className="icon-heading"><Icon name="questions" />Question List</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Question</th>
                <th>Correct</th>
                <th>Subject</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question, index) => (
                <tr key={question.id}>
                  <td>{index + 1}</td>
                  <td>{question.question}</td>
                  <td>{question.correctAnswer}</td>
                  <td>{question.subject || 'General'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
