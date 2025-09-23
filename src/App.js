import React from 'react';
import CodeToMusicPlayer from './components/CodeToMusicPlayer';
import './App.css';

function App() {
  return (
    <div className="App">
      <header style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>🎵 Code2Score</h1>
        <p style={{ color: '#555' }}>Paste code. Hear music. See notation.</p>
      </header>
      <main>
        <CodeToMusicPlayer />
      </main>
      <footer style={{ textAlign: 'center', padding: '2rem', fontSize: '0.8rem', color: '#999' }}>
        Phase 1 MVP — Mapping line endings to melody
      </footer>
    </div>
  );
}

export default App;
