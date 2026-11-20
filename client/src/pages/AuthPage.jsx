import { useState } from 'react';
import Icon from '../components/Icon';

const initialForm = {
  name: '',
  email: '',
  password: '',
};

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email: form.email, password: form.password } : form;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Authentication failed.');
      }

      if (payload.token) {
        localStorage.setItem('mcq_token', payload.token);
        localStorage.setItem('mcq_user', JSON.stringify(payload.user));
        window.location.reload();
      }
    } catch (err) {
      setError(err.message || 'Unable to sign in right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand small"><Icon name="sparkles" size={23} />MCQ Studio</div>
          <div className="toggle-row">
            <button
              type="button"
              className={mode === 'login' ? 'toggle active' : 'toggle'}
              onClick={() => setMode('login')}
            >
              <Icon name="questions" size={16} />
              Login
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'toggle active' : 'toggle'}
              onClick={() => setMode('register')}
            >
              <Icon name="plus" size={16} />
              Register
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <label className="field">
              <span>Name</span>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Full name" />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
          </label>

          <label className="field">
            <span>Password</span>
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="primary-btn auth-submit" disabled={loading}>
            <Icon name={mode === 'login' ? 'login' : 'save'} size={17} />
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
