import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000'); // Use your backend URL

function ChallengePage({ user }) {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionIds, setQuestionIds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [joining, setJoining] = useState(false);

  // Fetch challenge by challengeId on mount
  useEffect(() => {
    const fetchChallenge = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/challenge/${challengeId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch challenge');
        setChallenge(data);
        setQuestionIds(data.question_ids || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchChallenge();
  }, [challengeId]);

  // Friend join logic (use challengeId)
  useEffect(() => {
    if (!challengeId || !challenge || !user) return;
    const isChallenger = user.username === challenge.challenger_username;
    if (!isChallenger && !challenge.friend_username) {
      setJoining(true);
      fetch(`${import.meta.env.VITE_API_URL}/challenge/${challengeId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }).then(() => setJoining(false));
    }
  }, [challengeId, challenge, user]);

  // Always emit join_challenge as soon as challengeId and user are known
  useEffect(() => {
    if (!challengeId || !user) return;
    socket.emit('join_challenge', { challengeId, username: user.username });
  }, [challengeId, user]);

  // Always call join endpoint when user loads a challenge (not just if friend_username is missing)
  useEffect(() => {
    if (!challengeId || !user) return;
    fetch(`${import.meta.env.VITE_API_URL}/challenge/${challengeId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
  }, [challengeId, user]);

  // Fetch current question when challengeId, questionIds, or currentIndex changes
  useEffect(() => {
    if (!challengeId || !questionIds.length) return;
    const fetchCurrentQuestion = async () => {
      setLoading(true);
      setSelected(null);
      setResult(null);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/challenge/${challengeId}/question/${currentIndex}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch question');
        setCurrentQuestion(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCurrentQuestion();
  }, [challengeId, questionIds, currentIndex]);

  // Listen for 'start_challenge' event from backend and set started to true
  useEffect(() => {
    const handleStartChallenge = () => {
      console.log('[Socket] Received start_challenge');
      setStarted(true);
    };
    socket.on('start_challenge', handleStartChallenge);
    return () => {
      socket.off('start_challenge', handleStartChallenge);
    };
  }, []);

  // Socket logic (unchanged)
  useEffect(() => {
    socket.on('start_quiz', () => {
      setWaiting(false);
    });
    return () => {
      socket.off('start_quiz');
    };
  }, [challengeId]);

  // Listen for 'score_update' event and update challenge scores in real time
  useEffect(() => {
    const handleScoreUpdate = (data) => {
      setChallenge((prev) => prev ? { ...prev, ...data } : data);
    };
    socket.on('score_update', handleScoreUpdate);
    return () => {
      socket.off('score_update', handleScoreUpdate);
    };
  }, []);

  // Listen for 'challenge_update' event and update challenge state
  useEffect(() => {
    const handleChallengeUpdate = (challenge) => {
      setChallenge(challenge);
    };
    socket.on('challenge_update', handleChallengeUpdate);
    return () => {
      socket.off('challenge_update', handleChallengeUpdate);
    };
  }, []);

  const handleOptionClick = async (option) => {
    if (selected || !currentQuestion) return;
    setSelected(option);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/challenge/${challengeId}/answer/${currentIndex}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess: option })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check answer');
      setResult(data);
      // Emit answer and score to socket (score is not needed, backend will update)
      socket.emit('answer', {
        challengeId,
        questionIndex: currentIndex,
        username: user.username,
        answer: option
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNext = () => {
    if (currentIndex < questionIds.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelected(null);
      setResult(null);
    } else {
      setFinished(true);
      handleSubmitScore();
    }
  };

  const handleTryAgain = () => {
    setSelected(null);
    setResult(null);
  };

  const handleSubmitScore = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/challenge/${challengeId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit score');
      setChallenge(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Loader logic
  if (loading || joining || !started || !currentQuestion) return <div>Waiting for both players to join...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!challenge || !questionIds.length) return null;

  return (
    <div className="App">
      <div className="header">
        <button className="header-logout" style={{ position: 'absolute', left: 20, top: 20, zIndex: 10 }} onClick={() => navigate('/')}>Back to Home</button>
        <div className="header-title">Challenge: {challenge.challenger_username}</div>
        <div className="header-score">
          <div className="score-labels">
            <div>
              {challenge.challenger_username}: {typeof challenge.challenger_score === 'number' ? challenge.challenger_score : 0}
            </div>
            <div>
              {challenge.friend_username ? challenge.friend_username : 'Waiting for friend'}: {typeof challenge.friend_score === 'number' ? challenge.friend_score : 0}
            </div>
          </div>
        </div>
      </div>
      {/* Show question if started and not finished */}
      {started && !finished && currentQuestion && (
        <div className="card">
          <div>
            <strong>Clues:</strong>
            <div className="clues">{Array.isArray(currentQuestion.clues) ? currentQuestion.clues.join(' ') : currentQuestion.clues}</div>
          </div>
          <div style={{ margin: '1em 0' }}>
            {currentQuestion.options.map((option) => (
              <button
                key={option}
                onClick={() => handleOptionClick(option)}
                disabled={!!selected}
                style={{
                  margin: '0.5em',
                  backgroundColor:
                    !result ? '' :
                    result && result.correct && option === selected ? 'green' :
                    result && !result.correct && option === selected ? 'red' :
                    '',
                  color: result && option === selected ? 'white' : '',
                  minWidth: '120px',
                  minHeight: '40px',
                  fontWeight: 'bold',
                  fontSize: '1em',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  cursor: selected ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {option}
              </button>
            ))}
          </div>
          {result && !result.correct && (
            <>
              <h2 style={{ color: 'red' }}>Wrong!</h2>
              <button onClick={handleTryAgain} disabled={loading} style={{ marginTop: '1em', marginRight: '1em' }}>
                Try Again
              </button>
              <button onClick={handleNext} disabled={loading} style={{ marginTop: '1em' }}>
                Next
              </button>
            </>
          )}
          {result && result.correct && (
            <>
              <h2 style={{ color: 'green' }}>Correct!</h2>
              <div>Fun fact: {currentQuestion.fun_fact}</div>
              <div>Trivia: {currentQuestion.trivia}</div>
              <button onClick={handleNext} disabled={loading} style={{ marginTop: '1em' }}>
                Next
              </button>
            </>
          )}
        </div>
      )}
      {finished && (
        <div className="card">
          <h2>Challenge Complete!</h2>
          <div>Your Score: {typeof challenge.challenger_score === 'number' ? challenge.challenger_score : 'Not submitted yet'}</div>
          <div>Challenger Score: {typeof challenge.challenger_score === 'number' ? challenge.challenger_score : 'Not submitted yet'}</div>
          <div>Friend Score: {typeof challenge.friend_score === 'number' ? challenge.friend_score : 'Not submitted yet'}</div>
          <button onClick={() => navigate('/')} style={{ marginTop: '2em' }}>Back to Home</button>
        </div>
      )}
    </div>
  );
}

export default ChallengePage; 