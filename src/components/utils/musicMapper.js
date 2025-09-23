// src/components/utils/musicMapper.js

import { Note, Scale } from '@tonaljs/tonal';

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

// Get scale notes for a given key
export const getScaleNotes = (key = 'C') => {
  // Map key signature to scale type
  const isMinor = ['Am', 'Em', 'Bm', 'Dm', 'Gm'].includes(key + 'm') || key.includes('m');
  const scaleType = isMinor ? 'minor' : 'major';
  const scale = Scale.get(key + ' ' + scaleType);
  return scale.notes; // e.g., ["C", "D", "E", "F", "G", "A", "B"]
};

// Constrain note to nearest in-scale note
export const constrainNoteToKey = (noteName, key = 'C') => {
  const scaleNotes = getScaleNotes(key);
  const note = Note.get(noteName);
  if (!note || !note.chroma) return noteName; // fallback

  const chroma = note.chroma; // 0-11
  const scaleChromas = scaleNotes.map(n => Note.get(n).chroma).filter(n => n !== undefined);

  // Find closest in-scale chroma
  let closest = scaleChromas[0];
  let minDist = 12;
  for (let sc of scaleChromas) {
    const dist = Math.min(Math.abs(chroma - sc), 12 - Math.abs(chroma - sc));
    if (dist < minDist) {
      minDist = dist;
      closest = sc;
    }
  }

  // Return note in same octave
  const octave = note.octave || 4;
  const closestNote = scaleNotes.find(n => Note.get(n).chroma === closest);
  return closestNote + octave;
};
