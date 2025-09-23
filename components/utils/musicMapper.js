// src/components/utils/musicMapper.js

/**
 * Centralized music mapping logic for Code2Score
 * Maps code features → musical parameters
 */

// Key signature map by file extension
export const getKeySignatureByExtension = (filename = '') => {
  const ext = filename.split('.').pop().toLowerCase();
  const keyMap = {
    js: 'C',      // C Major
    jsx: 'G',
    ts: 'D',
    py: 'A',      // A Minor
    php: 'F',
    java: 'Bb',
    c: 'Eb',
    cpp: 'Ab',
    rb: 'E',
    go: 'B',
    default: 'C'
  };
  return keyMap[ext] || keyMap.default;
};

// Time signature based on average line length
export const getTimeSignatureByAvgLength = (avgLength) => {
  if (avgLength < 20) return '3/4';
  if (avgLength > 60) return '6/8';
  return '4/4';
};

// Instrument by keyword (first meaningful word in line)
export const getInstrumentByKeyword = (line) => {
  const keywords = {
    function: 'piano',
    class: 'strings',
    const: 'synth',
    let: 'pluck',
    var: 'metal',
    if: 'piano',
    for: 'marimba',
    while: 'organ',
    return: 'horn',
    import: 'bell',
    export: 'glockenspiel',
    default: 'piano'
  };

  const firstWord = line.trim().split(/\s+/)[0]?.replace(/[({;:,]/g, '');
  return keywords[firstWord] || keywords.default;
};

// Indentation → velocity (0.1 to 1.0) + optional octave
export const getVelocityAndOctaveByIndent = (line) => {
  const indentChars = line.match(/^\s*/)[0];
  const indentLevel = indentChars.length;

  // Velocity: more indent = louder (but cap it)
  const velocity = Math.min(0.2 + indentLevel * 0.05, 1.0);

  // Optional: shift octave every 4 spaces
  const octaveShift = Math.floor(indentLevel / 4);

  return { velocity, octaveShift };
};

// Scale filter — ensure notes stay in key
export const constrainNoteToKey = (noteName, key = 'C') => {
  // Simple: use Tonal to get scale notes
  const tonal = require('tonal'); // We'll add this later if needed
  // For now, we'll just return as-is — Phase 3 can add scale enforcement
  return noteName;
};
