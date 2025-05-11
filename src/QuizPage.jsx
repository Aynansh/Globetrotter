import React, { useEffect, useState } from 'react';

function QuizPage({
  loading: parentLoading,
  error: parentError,
  score,
  highscore,
  onLogout,
  onSaveHighscore,
  canSaveHighscore,
  onCorrectAnswer,
  onGoBack
}) {
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  // Fetch a new question
  const fetchQuestion = async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setResult(null);
    setShowResult(false);
    try {
      const res = await fetch('http://localhost:3000/random-question');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch question');
      setQuestion(data);
      setOptions(data.options);
    } catch (err) {
      setError(err.message);
      setQuestion(null);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
    // eslint-disable-next-line
  }, []);

  const handleOptionClick = async (option) => {
    if (selected || !question) return;
    setSelected(option);
    setShowResult(false);
    try {
      const res = await fetch('http://localhost:3000/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: question.id, guess: option })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check answer');
      setResult(data);
      setShowResult(true);
      if (data.correct && typeof onCorrectAnswer === 'function') {
        onCorrectAnswer();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTryAgain = () => {
    setSelected(null);
    setResult(null);
    setShowResult(false);
  };

  const handleNext = () => {
    fetchQuestion();
    setSelected(null);
    setResult(null);
    setShowResult(false);
  };

  return (
    <>
      <div className="header">
        <div className="header-title">Globetrotter</div>
        <div className="header-score">
          <div className="score-labels">
            <div>Score: {score}</div>
            <div>High Score: {highscore}</div>
          </div>
          <div className="score-buttons">
            <button className="header-logout" onClick={onGoBack} style={{ marginRight: 8 }}>
              Go Back
            </button>
            <button className="header-logout" onClick={onLogout}>
              Logout
            </button>
            <button className="header-logout" style={{ marginLeft: 0 }} onClick={onSaveHighscore} disabled={!canSaveHighscore}>
              Save High Score
            </button>
          </div>
        </div>
      </div>
      <div className="App">
        {(loading || parentLoading) && <p>Loading...</p>}
        {(error || parentError) && <p style={{ color: 'red' }}>{error || parentError}</p>}
        {question && (
          <div className="card">
            <div>
              <strong>Clues:</strong>
              <div className="clues">
                {Array.isArray(question.clues) ? question.clues.join(' ') : question.clues}
              </div>
            </div>
            <div style={{ margin: '1em 0' }}>
              {options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionClick(option)}
                  disabled={!!selected}
                  style={{
                    margin: '0.5em',
                    backgroundColor:
                      !showResult ? '' :
                      result && result.correct && option === selected ? 'green' :
                      result && !result.correct && option === selected ? 'red' :
                      '',
                    color: showResult && option === selected ? 'white' : '',
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
            {showResult && result && !result.correct && (
              <>
                <h2 style={{ color: 'red' }}>Wrong!</h2>
                <button onClick={handleTryAgain} disabled={loading} style={{ marginTop: '1em', marginRight: '1em' }}>
                  Try Again
                </button>
              </>
            )}
            {showResult && result && result.correct && (
              <>
                <h2 style={{ color: 'green' }}>Correct!</h2>
                <div>Correct Answer: {result.correct_answer}</div>
                <div>Fun fact: {result.fun_fact}</div>
                <div>Trivia: {result.trivia}</div>
                <button onClick={handleNext} disabled={loading} style={{ marginTop: '1em' }}>
                  Next
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default QuizPage; 