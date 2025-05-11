import React from 'react';

function ChallengeLinkModal({ link, onClose, onStartChallenge }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.origin + link);
  };
  return (
    <div className="modal" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#222', padding: 32, borderRadius: 16, minWidth: 320, color: '#fff', textAlign: 'center' }}>
        <h2>Challenge Link</h2>
        <div style={{ margin: '1em 0', wordBreak: 'break-all' }}>{window.location.origin + link}</div>
        <button onClick={handleCopy} style={{ marginRight: 12 }}>Copy Link</button>
        <button onClick={onStartChallenge} style={{ marginRight: 12 }}>Start Challenge</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default ChallengeLinkModal; 