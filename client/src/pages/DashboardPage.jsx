import { useState } from "react";
import Icon from '../components/Icon';


export default function DashboardPage() {
  const [videos, setVideos] = useState([]);
  const [totalQuestion, setTotalQuestion] = useState(0);
  const token = localStorage.getItem('mcq_token');
  if (!token) return;

  const Videos = fetch('/api/videos', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((response) => response.json())
    .then((payload) => {
      if (payload?.success && Array.isArray(payload.data)) {
        setVideos(payload.data);
      }
    })
    .catch(() => { });
  let questionCount = 0;


  for (let x of videos) {
    questionCount += x['questionCount']

  }

  const stats = [
    { label: 'Total Questions', value: questionCount, icon: 'questions' },
    { label: 'Total Question Sets', value: 0, icon: 'sets' },
    { label: 'Total PPTs', value: '9', icon: 'presentation' },
    // making change
    { label: 'Total Videos', value: videos.length, icon: 'video' },
  ];
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="page-title"><Icon name="home" size={23} />Dashboard</h1>
        </div>
      </header>

      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="card stat-card" key={stat.label}>
            <div className="stat-label"><Icon name={stat.icon} size={17} />{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="panel-grid">
        <section className="card">
          <h3 className="icon-heading"><Icon name="sets" />Recent Question Sets</h3>
          <ul className="list">
            <li>BPSC Current Affairs Set 01</li>
            <li>UPSC Polity Quick Revision</li>
          </ul>
        </section>
        <section className="card">
          <h3 className="icon-heading"><Icon name="presentation" />Recent Presentations</h3>
          <ul className="list">
            <li>Current Affairs 50 MCQ</li>
            <li>History Booster Set</li>
          </ul>
        </section>
        <section className="card">
          <h3 className="icon-heading"><Icon name="video" />Recent Videos</h3>
          <ul className="list">
            <li>Bihar PCS 2026 Review</li>
            <li>Daily Current Affairs</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
