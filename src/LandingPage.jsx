import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage({ user, onStartQuiz, onChallengeFriend, onJoinChallenge, onLogout }) {
  const [showJoin, setShowJoin] = useState(false);
  const joinInputRef = useRef();
  const navigate = useNavigate();

  const handleJoin = () => {
    if (onJoinChallenge) {
      onJoinChallenge(joinInputRef.current.value);
    }
  };

  return (
    <div className="header">
      <div className="header-title">Globetrotter</div>
      <div className="header-score">
        <div className="score-labels">
          <div>Welcome, {user?.username || 'Guest'}!</div>
          <button onClick={onLogout} style={{ marginTop: '1em', minWidth: 100 }}>Logout</button>
        </div>
      </div>
      <div className="App">
        <div className="card" style={{ minWidth: 320, minHeight: 200, justifyContent: 'center' }}>
          <button style={{ margin: '1em', minWidth: 180 }} onClick={onStartQuiz}>Start Playing</button>
          <button style={{ margin: '1em', minWidth: 180 }} onClick={onChallengeFriend}>Challenge a Friend</button>
          <button style={{ margin: '1em', minWidth: 180 }} onClick={() => setShowJoin(true)}>Join Challenge</button>
          {showJoin && (
            <div style={{ marginTop: '1em' }}>
              <input
                ref={joinInputRef}
                type="text"
                placeholder="Paste challenge link here"
                style={{ width: '300px', marginRight: '1em' }}
              />
              <button onClick={handleJoin}>Join</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LandingPage; 