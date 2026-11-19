import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMonth(month) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function formatMonthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function detectLanguage(headlines) {
  let devanagariCount = 0;
  let latinCount = 0;
  for (const character of headlines.join(' ')) {
    if (/\p{Script=Devanagari}/u.test(character)) devanagariCount += 1;
    else if (/\p{Script=Latin}/u.test(character)) latinCount += 1;
  }
  return devanagariCount > latinCount ? 'hi' : 'en';
}

function getToken() {
  return localStorage.getItem('mcq_token');
}

async function readResponse(response, fallback) {
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || fallback);
  }
  return payload.data;
}

export default function CurrentAffairsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState([]);
  const [date, setDate] = useState(getToday);
  const [calendarMonth, setCalendarMonth] = useState(() => getToday().slice(0, 7));
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);

  const months = useMemo(() => {
    const groups = new Map();
    for (const day of days) {
      const month = day.date.slice(0, 7);
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month).push(day);
    }
    return [...groups.entries()];
  }, [days]);

  const savedDates = useMemo(() => new Set(days.map((day) => day.date)), [days]);
  const calendarCells = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    return [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const dayNumber = index + 1;
        return `${calendarMonth}-${String(dayNumber).padStart(2, '0')}`;
      }),
    ];
  }, [calendarMonth]);

  useEffect(() => {
    let active = true;
    fetch('/api/current-affairs', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((response) => readResponse(response, 'Could not load your current-affairs archive.'))
      .then((savedDays) => {
        if (active) setDays(savedDays);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function uploadCurrentAffairs(event) {
    event.preventDefault();
    if (!file) {
      setError('Choose a JSON file to upload.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Current-affairs JSON files must be 5 MB or smaller.');
      return;
    }

    setUploading(true);
    setError('');
    setStatus('');
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.news)) {
        throw new Error('The JSON must contain a "news" array of objects with a "headline" field.');
      }
      if (parsed.news.some((item) => !item || typeof item.headline !== 'string')) {
        throw new Error('Every item in "news" must contain a headline string.');
      }
      const response = await fetch('/api/current-affairs/days', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date, sourceName: file.name, headlines: parsed.news.map((item) => item.headline) }),
      });
      const savedDay = await readResponse(response, 'Could not save this current-affairs file.');
      setDays((current) => [...current.filter((entry) => entry.date !== savedDay.date), savedDay]
        .sort((first, second) => second.date.localeCompare(first.date)));
      setStatus(`${savedDay.headlines.length} headlines saved for ${formatDay(savedDay.date)}.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      navigate('/reels', {
        state: {
          currentAffairsDraft: {
            date: savedDay.date,
            headlines: savedDay.headlines,
            language: detectLanguage(savedDay.headlines),
          },
        },
      });
    } catch (uploadError) {
      setError(uploadError instanceof SyntaxError
        ? 'The selected file is not valid JSON.'
        : uploadError.message || 'Could not upload this current-affairs file.');
    } finally {
      setUploading(false);
    }
  }

  async function deleteDay(day) {
    if (!window.confirm(`Delete all ${day.headlines.length} headlines saved for ${formatDay(day.date)}?`)) return;
    setError('');
    try {
      const response = await fetch(`/api/current-affairs/days/${encodeURIComponent(day.date)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await readResponse(response, 'Could not delete this archive day.');
      setDays((current) => current.filter((entry) => entry.date !== day.date));
      setStatus(`Deleted headlines for ${formatDay(day.date)}.`);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <div className="page current-affairs-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily archive</p>
          <h1 className="page-title"><Icon name="news" size={23} />Current Affairs</h1>
          <p className="current-affairs-intro">Upload daily headlines and browse them by month and date.</p>
        </div>
        <div className="current-affairs-total"><strong>{days.reduce((sum, day) => sum + day.headlines.length, 0)}</strong><span>saved headlines</span></div>
      </header>

      <form className="card current-affairs-upload" onSubmit={uploadCurrentAffairs}>
        <h2 className="icon-heading"><Icon name="upload" />Upload daily current affairs</h2>
        <p>Upload a JSON file containing a <code>news</code> array with <code>headline</code> values. Uploading again for a date replaces that date’s headlines.</p>
        <div className="current-affairs-upload-fields">
          <label className="field">
            <span>Archive date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                if (event.target.value) setCalendarMonth(event.target.value.slice(0, 7));
              }}
              required
            />
          </label>
          <label className="field">
            <span>Current-affairs JSON file</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setError('');
                setStatus('');
              }}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={uploading || !file}>
            <Icon name="save" size={17} />
            {uploading ? 'Saving...' : 'Save headlines'}
          </button>
        </div>
        <div className="current-affairs-calendar" aria-label="Choose archive date">
          <div className="current-affairs-calendar-header">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous month"
              onClick={() => {
                const [year, month] = calendarMonth.split('-').map(Number);
                const previous = new Date(year, month - 2, 1);
                setCalendarMonth(formatMonthKey(previous.getFullYear(), previous.getMonth()));
              }}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <strong>{formatMonth(calendarMonth)}</strong>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next month"
              onClick={() => {
                const [year, month] = calendarMonth.split('-').map(Number);
                const next = new Date(year, month, 1);
                setCalendarMonth(formatMonthKey(next.getFullYear(), next.getMonth()));
              }}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <div className="current-affairs-calendar-grid" role="grid" aria-label={formatMonth(calendarMonth)}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((weekday) => (
              <span className="current-affairs-calendar-weekday" role="columnheader" key={weekday}>{weekday}</span>
            ))}
            {calendarCells.map((calendarDate, index) => calendarDate ? (
              <button
                type="button"
                role="gridcell"
                key={calendarDate}
                className={[
                  'current-affairs-calendar-day',
                  savedDates.has(calendarDate) ? 'has-current-affairs' : '',
                  date === calendarDate ? 'is-selected' : '',
                  calendarDate === getToday() ? 'is-today' : '',
                ].filter(Boolean).join(' ')}
                aria-label={`${formatDay(calendarDate)}${savedDates.has(calendarDate) ? ', current affairs uploaded' : ''}`}
                aria-pressed={date === calendarDate}
                onClick={() => setDate(calendarDate)}
              >
                {Number(calendarDate.slice(-2))}
              </button>
            ) : (
              <span className="current-affairs-calendar-empty" aria-hidden="true" key={`empty-${index}`} />
            ))}
          </div>
          <small className="current-affairs-calendar-legend">
            <span aria-hidden="true" /> Current affairs uploaded
          </small>
        </div>
        {file && <small className="current-affairs-file">{file.name}</small>}
      </form>

      {error && <div className="error-box" role="alert">{error}</div>}
      {status && <div className="current-affairs-status" role="status">{status}</div>}

      <section className="current-affairs-archive">
        <div className="section-heading">
          <h2 className="icon-heading"><Icon name="book" />Monthly archive</h2>
          <span>{months.length} {months.length === 1 ? 'month' : 'months'}</span>
        </div>
        {loading ? <div className="card empty-state">Loading your archive...</div> : months.length ? (
          months.map(([month, monthDays]) => (
            <details className="card current-affairs-month" key={month} open={month === months[0][0]}>
              <summary>
                <span><Icon name="calendar" size={18} />{formatMonth(month)}</span>
                <small>{monthDays.length} days · {monthDays.reduce((sum, day) => sum + day.headlines.length, 0)} headlines</small>
              </summary>
              <div className="current-affairs-days">
                {monthDays.map((day) => (
                  <details className="current-affairs-day" key={day.date}>
                    <summary>
                      <span>{formatDay(day.date)}</span>
                      <small>{day.headlines.length} headlines</small>
                    </summary>
                    <div className="current-affairs-day-content">
                      <p className="current-affairs-source">Source: {day.sourceName}</p>
                      <ol>
                        {day.headlines.map((headline, index) => <li key={`${day.date}-${index}`}>{headline}</li>)}
                      </ol>
                      <button type="button" className="danger-btn" onClick={() => deleteDay(day)}>
                        <Icon name="trash" size={16} />Delete this day
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))
        ) : (
          <div className="card empty-state">
            <Icon name="news" size={28} />
            <p>No current affairs saved yet. Upload a daily JSON file to start your archive.</p>
          </div>
        )}
      </section>
    </div>
  );
}
