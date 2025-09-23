// src/components/ThemeToggle.jsx

import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { darkMode, setDarkMode } = useTheme();

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      style={{
        background: 'none',
        border: '1px solid currentColor',
        borderRadius: '9999px',
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
      aria-label="Toggle theme"
    >
      {darkMode ? (
        <>
          <span>☀️</span> Light
        </>
      ) : (
        <>
          <span>🌙</span> Dark
        </>
      )}
    </button>
  );
}
