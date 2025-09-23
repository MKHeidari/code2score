// src/App.js

import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import CodeToMusicPlayer from './components/CodeToMusicPlayer';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <header style={{
          padding: '1.5rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🎵 Code2Score</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Turn code into playable sheet music</p>
          </div>
          <ThemeToggle />
        </header>
        <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
          <CodeToMusicPlayer />
        </main>
        <footer style={{
          textAlign: 'center',
          padding: '1.5rem',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-color)',
        }}>
          Phase 3 — MIDI Export • Scale Enforcement • UI Polish
        </footer>
      </div>
    </ThemeProvider>
  );
}

export default App;
