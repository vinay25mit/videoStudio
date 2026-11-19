import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';
import App from './App';
import DashboardPage from './pages/DashboardPage';
import QuestionsPage from './pages/QuestionsPage';
import SetsPage from './pages/SetsPage';
import PresentationsPage from './pages/PresentationsPage';
import VideosPage from './pages/VideosPage';
import ReelsPage from './pages/ReelsPage';
import VoiceStudioPage from './pages/VoiceStudioPage';
import NarrationPage from './pages/NarrationPage';
import SyllabusTrackerPage from './pages/SyllabusTrackerPage';
import CurrentAffairsPage from './pages/CurrentAffairsPage';
import CurrentAffairsStickersPage from './pages/CurrentAffairsStickersPage';
import AuthPage from './pages/AuthPage';
import { isLoggedIn } from './lib/auth';

function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }) {
  return isLoggedIn() ? <Navigate to="/" replace /> : children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="sets" element={<SetsPage />} />
          <Route path="presentations" element={<PresentationsPage />} />
          <Route path="videos" element={<VideosPage />} />
          <Route path="reels" element={<ReelsPage />} />
          <Route path="voice-studio" element={<VoiceStudioPage />} />
          <Route path="narration" element={<NarrationPage />} />
          <Route path="syllabus-tracker" element={<SyllabusTrackerPage />} />
          <Route path="current-affairs" element={<CurrentAffairsPage />} />
          <Route path="current-affairs-stickers" element={<CurrentAffairsStickersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
