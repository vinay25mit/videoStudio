import { Link, NavLink, Outlet } from 'react-router-dom';
import { logout, getStoredUser } from './lib/auth';
import Icon from './components/Icon';

const navItems = [
  { label: 'Dashboard', to: '/', icon: 'home' },
  { label: 'Question Bank', to: '/questions', icon: 'questions' },
  { label: 'Question Sets', to: '/sets', icon: 'sets' },
  { label: 'Presentations', to: '/presentations', icon: 'presentation' },
  { label: 'Videos', to: '/videos', icon: 'video' },
  { label: 'Reels Maker', to: '/reels', icon: 'reels' },
  { label: 'Voice Studio', to: '/voice-studio', icon: 'microphone' },
  { label: 'Narration', to: '/narration', icon: 'narration' },
  { label: 'Syllabus Tracker', to: '/syllabus-tracker', icon: 'syllabus' },
  { label: 'Current Affairs', to: '/current-affairs', icon: 'news' },
  { label: 'CA Stickers', to: '/current-affairs-stickers', icon: 'sparkles' },

];

export default function App() {
  const user = getStoredUser();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Icon name="sparkles" size={23} />MCQ Studio</div>
        <nav className="sidebar-nav" aria-label="Services">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">{user?.name || 'User'}</div>
          <button type="button" className="secondary-btn small-btn" onClick={logout}>
            <Icon name="logout" size={16} />
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
