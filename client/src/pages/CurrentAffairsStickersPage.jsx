import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon';

function getLocalDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeeklyStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return getLocalDateString(start);
}

function getWeeklyEnd(weekStart) {
  const end = new Date(`${weekStart}T00:00:00`);
  end.setDate(end.getDate() + 6);
  return getLocalDateString(end);
}

function shuffleIndices(count) {
  const indices = Array.from({ length: count }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }
  return indices;
}

function wrapCanvasText(context, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function CurrentAffairsStickersPage() {
  const [days, setDays] = useState([]);
  const [scope, setScope] = useState('week');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [stickerDeck, setStickerDeck] = useState([]);
  const [stickerIndex, setStickerIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    let active = true;
    fetch('/api/current-affairs', {
      headers: { Authorization: `Bearer ${localStorage.getItem('mcq_token')}` },
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || 'Could not load saved current affairs.');
        }
        if (active) setDays(payload.data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const availablePeriods = useMemo(() => {
    if (scope === 'all') return [];
    const periods = new Map();
    for (const day of days) {
      const key = scope === 'week'
        ? getWeeklyStart(new Date(`${day.date}T00:00:00`))
        : day.date.slice(0, 7);
      if (!periods.has(key)) periods.set(key, new Set());
      const periodHeadlines = periods.get(key);
      for (const headline of day.headlines) {
        periodHeadlines.add(headline.trim().replace(/\s+/g, ' ').toLocaleLowerCase());
      }
    }
    return [...periods.entries()]
      .map(([key, headlines]) => [key, headlines.size])
      .sort(([first], [second]) => second.localeCompare(first));
  }, [days, scope]);

  const activePeriod = selectedPeriod && availablePeriods.some(([key]) => key === selectedPeriod)
    ? selectedPeriod
    : availablePeriods[0]?.[0] || '';

  const eligibleHeadlines = useMemo(() => {
    const headlines = days
      .filter((day) => {
        if (scope === 'all') return true;
        if (!activePeriod) return false;
        return scope === 'week'
          ? getWeeklyStart(new Date(`${day.date}T00:00:00`)) === activePeriod
          : day.date.slice(0, 7) === activePeriod;
      })
      .flatMap((day) => day.headlines.map((headline) => ({ headline, date: day.date })));
    const uniqueHeadlines = new Map();
    for (const item of headlines) {
      const key = item.headline.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
      if (!uniqueHeadlines.has(key)) uniqueHeadlines.set(key, item);
    }
    return [...uniqueHeadlines.values()];
  }, [activePeriod, days, scope]);

  const sticker = eligibleHeadlines[stickerDeck[stickerIndex]] || null;

  function chooseRandomSticker() {
    setError('');
    if (!eligibleHeadlines.length) {
      setStickerDeck([]);
      setStickerIndex(-1);
      return;
    }
    setStickerDeck(shuffleIndices(eligibleHeadlines.length));
    setStickerIndex(0);
  }

  function moveSticker(direction) {
    if (!eligibleHeadlines.length) return;
    if (stickerIndex < 0 || !stickerDeck.length) {
      chooseRandomSticker();
      return;
    }

    const nextIndex = stickerIndex + direction;
    if (nextIndex >= 0 && nextIndex < stickerDeck.length) {
      setStickerIndex(nextIndex);
      return;
    }

    const nextDeck = shuffleIndices(eligibleHeadlines.length);
    if (nextDeck.length > 1) {
      const previousHeadlineIndex = stickerDeck[stickerIndex];
      if (direction > 0 && nextDeck[0] === previousHeadlineIndex) {
        [nextDeck[0], nextDeck[1]] = [nextDeck[1], nextDeck[0]];
      } else if (direction < 0 && nextDeck[nextDeck.length - 1] === previousHeadlineIndex) {
        const lastIndex = nextDeck.length - 1;
        [nextDeck[lastIndex], nextDeck[lastIndex - 1]] = [nextDeck[lastIndex - 1], nextDeck[lastIndex]];
      }
    }
    setStickerDeck(nextDeck);
    setStickerIndex(direction > 0 ? 0 : nextDeck.length - 1);
  }

  function handleStickerTouchEnd(event) {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45) return;
    moveSticker(distance < 0 ? 1 : -1);
  }

  async function downloadSticker() {
    if (!sticker) return;
    setDownloading(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not create the sticker image.');

      const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      background.addColorStop(0, '#082f49');
      background.addColorStop(0.5, '#4338ca');
      background.addColorStop(1, '#7e22ce');
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'rgba(255,255,255,.07)';
      context.beginPath();
      context.arc(970, 130, 170, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(100, 1220, 220, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,.34)';
      context.lineWidth = 3;
      context.beginPath();
      context.roundRect(34, 34, 1012, 1282, 48);
      context.stroke();
      context.fillStyle = '#fb923c';
      context.beginPath();
      context.roundRect(80, 90, 490, 82, 41);
      context.fill();
      context.fillStyle = '#fff';
      context.font = '700 29px system-ui, sans-serif';
      context.fillText('✦  DAILY CURRENT AFFAIRS', 112, 142);
      context.fillStyle = 'rgba(255,255,255,.13)';
      context.beginPath();
      context.roundRect(80, 220, 920, 920, 44);
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,.22)';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#fff';
      context.font = '600 50px "Noto Sans Devanagari", Mangal, system-ui, sans-serif';
      const lines = wrapCanvasText(context, sticker.headline, 780);
      const lineHeight = 74;
      const maxLines = 10;
      const visibleLines = lines.slice(0, maxLines);
      if (lines.length > maxLines) {
        visibleLines[maxLines - 1] = `${Array.from(visibleLines[maxLines - 1]).slice(0, -3).join('')}…`;
      }
      const textHeight = visibleLines.length * lineHeight;
      const startY = 220 + Math.max(120, (920 - textHeight) / 2 + 50);
      visibleLines.forEach((line, index) => context.fillText(line, 150, startY + index * lineHeight));
      context.fillStyle = 'rgba(255,255,255,.45)';
      context.fillRect(100, 1190, 880, 2);
      context.fillStyle = '#c7d2fe';
      context.font = '600 29px system-ui, sans-serif';
      context.fillText(formatDay(sticker.date), 102, 1255);
      context.fillStyle = '#fff';
      context.font = '500 24px system-ui, sans-serif';
      context.fillText('Swipe • Learn • Remember', 102, 1295);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not export the sticker image.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `current-affairs-${sticker.date}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download the sticker image.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="page current-affairs-stickers-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Daily random picks</p>
          <h1 className="page-title"><Icon name="sparkles" size={23} />Current Affairs Stickers</h1>
          <p className="current-affairs-intro">Create a shareable sticker from one random saved headline.</p>
        </div>
      </header>

      {error && <div className="error-box" role="alert">{error}</div>}
      {!loading && !eligibleHeadlines.length && !error && (
        <div className="card empty-state">
          <Icon name="news" size={28} />
          <p>No saved headlines are available in this period. Upload current affairs in the Current Affairs service first.</p>
        </div>
      )}
      {sticker && (
        <section className="card sticker-result" aria-live="polite">
          <div className="sticker-carousel">
            <button type="button" className="sticker-arrow" aria-label="Previous sticker" onClick={() => moveSticker(-1)}>
              <span aria-hidden="true">‹</span>
            </button>
            <div
              className="sticker-card"
              onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
              onTouchEnd={handleStickerTouchEnd}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') moveSticker(-1);
                if (event.key === 'ArrowRight') moveSticker(1);
              }}
              tabIndex={0}
              role="group"
              aria-label="Current affairs sticker. Swipe or use arrow keys to browse."
            >
              <div className="sticker-card-top">
                <span className="sticker-badge"><Icon name="sparkles" size={16} />Daily current affairs</span>
              </div>
              <span className="sticker-kicker">TODAY'S KNOWLEDGE</span>
              <p>{sticker.headline}</p>
              <div className="sticker-card-footer">
                <span><Icon name="calendar" size={15} />{formatDay(sticker.date)}</span>
                <span className="sticker-footer-mark" aria-hidden="true">✦</span>
              </div>
            </div>
            <button type="button" className="sticker-arrow" aria-label="Next sticker" onClick={() => moveSticker(1)}>
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <p className="sticker-swipe-hint"><Icon name="sparkles" size={14} />Swipe left or right, or use the arrows, to browse saved headlines.</p>
          <button type="button" className="secondary-btn" onClick={downloadSticker} disabled={downloading}>
            <Icon name="download" size={16} />{downloading ? 'Creating image...' : 'Download sticker'}
          </button>
        </section>
      )}

      <section className="card sticker-controls">
        <div className="sticker-controls-heading">
          <h2><Icon name="sparkles" size={19} />Make another sticker</h2>
          <p>Choose an archive range, then pick a random headline.</p>
        </div>
        <label className="field">
          <span><Icon name="calendar" size={15} />Pick from</span>
          <select value={scope} onChange={(event) => { setScope(event.target.value); setSelectedPeriod(''); setStickerDeck([]); setStickerIndex(-1); }}>
            <option value="week">Week-wise</option>
            <option value="month">Month-wise</option>
            <option value="all">All saved headlines</option>
          </select>
          <small>Choose the saved headlines to browse.</small>
        </label>
        {scope !== 'all' && (
          <label className="field">
            <span><Icon name="calendar" size={15} />{scope === 'week' ? 'Saved week' : 'Saved month'}</span>
            <select value={activePeriod} onChange={(event) => { setSelectedPeriod(event.target.value); setStickerDeck([]); setStickerIndex(-1); }} disabled={!availablePeriods.length}>
              {availablePeriods.map(([period, count]) => (
                <option key={period} value={period}>
                  {scope === 'week' ? `${formatDay(period)} – ${formatDay(getWeeklyEnd(period))}` : new Date(`${period}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  {' '}({count})
                </option>
              ))}
            </select>
            <small>Only headlines saved during this {scope} are included.</small>
          </label>
        )}
        <div className="sticker-generate-action">
          <p><Icon name="news" size={16} />{loading ? 'Loading saved headlines...' : `${eligibleHeadlines.length} ${eligibleHeadlines.length === 1 ? 'headline' : 'headlines'} available`}</p>
          <button type="button" className="primary-btn" onClick={chooseRandomSticker} disabled={loading || !eligibleHeadlines.length}>
            <Icon name="sparkles" size={17} />Show random sticker
          </button>
        </div>
      </section>
    </div>
  );
}
