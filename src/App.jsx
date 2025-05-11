import { useEffect, useState, useRef } from 'react'
import './App.css'
import Login from './Login'
import Register from './Register'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import QuizPage from './QuizPage';
import ChallengePage from './ChallengePage';
import ChallengeLinkModal from './ChallengeLinkModal';

function shuffle(array) {
  // Fisher-Yates shuffle
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function App() {
  // Auth state
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [authMode, setAuthMode] = useState('login') // or 'register'
  const [authError, setAuthError] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)

  // App state
  const [page, setPage] = useState('landing') // 'landing' | 'quiz'

  // Quiz state
  const [score, setScore] = useState(0)
  const [highscore, setHighscore] = useState(0)
  const saveInterval = useRef(null)

  // Challenge modal state
  const [challengeModal, setChallengeModal] = useState(false);
  const [challengeLink, setChallengeLink] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);

  const navigate = useNavigate();

  // Auth handlers
  const handleLogout = async () => {
    await saveHighscore();
    setUser(null)
    setToken('')
    localStorage.removeItem('token')
    setScore(0)
    setHighscore(0)
    setPage('landing')
    navigate('/login'); // Redirect to login after logout
  }

  // Check token and get user info
  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    const checkAuth = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Auth failed')
        setUser(data)
        setHighscore(data.highscore || 0)
      } catch {
        setUser(null)
        setToken('')
        localStorage.removeItem('token')
      }
    }
    checkAuth()
  }, [token])

  // Highscore auto-save logic
  useEffect(() => {
    if (page !== 'quiz' || !token) {
      if (saveInterval.current) clearInterval(saveInterval.current)
      return
    }
    saveInterval.current = setInterval(() => {
      saveHighscore()
    }, 30000) // every 30 seconds
    return () => clearInterval(saveInterval.current)
  }, [page, score, token])

  const saveHighscore = async () => {
    if (!token || score <= highscore) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/update-highscore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ highscore: score })
      });
      if (res.ok) {
        // Fetch the updated user info to get the new highscore
        const meRes = await fetch(`${import.meta.env.VITE_API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const meData = await meRes.json();
        if (meRes.ok) setHighscore(meData.highscore || score);
      }
    } catch (err) {
      // Optionally show error
    }
  };

  // Challenge logic
  const handleChallengeFriend = async () => {
    if (!user || !token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/create-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ num_questions: 5 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create challenge');
      setChallengeLink(data.link);
      setChallengeModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleJoinChallenge = async (link) => {
    // Extract challengeId from the link (e.g., /challenge/1234-5678)
    const match = link.match(/\/challenge\/([a-zA-Z0-9-]+)/);
    if (!match) {
      alert('Invalid challenge link');
      return;
    }
    const challengeId = match[1];
    // Call backend join endpoint
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/challenge/${challengeId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Failed to join challenge');
      // Navigate to challenge page
      navigate(`/challenge/${challengeId}`);
    } catch (err) {
      alert('Failed to join challenge: ' + err.message);
    }
  };

  // Routing logic
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={
          <Login setToken={setToken} setAuthMode={setAuthMode} authError={authError} setAuthError={setAuthError} authLoading={authLoading} />
        } />
        <Route path="/register" element={
          <Register setAuthMode={setAuthMode} authError={authError} setAuthError={setAuthError} authLoading={authLoading} />
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage user={user} onStartQuiz={() => setPage('quiz')} onChallengeFriend={handleChallengeFriend} onJoinChallenge={handleJoinChallenge} onLogout={handleLogout} />} />
      <Route path="/quiz" element={<QuizPage user={user} score={score} setScore={setScore} highscore={highscore} setHighscore={setHighscore} />} />
      <Route path="/challenge/:challengeId" element={<ChallengePage user={user} />} />
      {/* Add other authenticated routes as needed */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App
