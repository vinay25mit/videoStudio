import { Link, Outlet } from 'react-router-dom';
import { logout, getStoredUser } from './lib/auth';

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Question Bank', to: '/questions' },
  { label: 'Question Sets', to: '/sets' },
  { label: 'Presentations', to: '/presentations' },
  { label: 'Videos', to: '/videos' },
  { label: 'Voice Studio', to: '/voice-studio' },
  { label: 'Narration', to: '/narration' },

];

export default function App() {
  const user = getStoredUser();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">MCQ Studio</div>
        <nav>
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">{user?.name || 'User'}</div>
          <button type="button" className="secondary-btn small-btn" onClick={logout}>
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
