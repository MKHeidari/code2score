// src/components/utils/musicMapper.js
// Maps code structure → musical parameters (pitch, scale, time sig, instrument, etc.)

import { Note, Scale } from '@tonaljs/tonal';

/**
 * Get key signature based on file extension
 * @param {string} filename - e.g., "app.js", "main.py"
 * @returns {string} Key like "C", "G", "Am", etc.
 */
export const getKeySignatureByExtension = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase() || 'js';
  const keyMap = {
    js: 'C',
    jsx: 'G',
    ts: 'D',
    tsx: 'A',
    py: 'Am',
    php: 'F',
    java: 'Bb',
    c: 'Eb',
    cpp: 'Ab',
    rb: 'E',
    go: 'B',
    rs: 'Em',
    swift: 'D',
    default: 'C'
  };
  return keyMap[ext] || keyMap.default;
};

/**
 * Determine time signature based on average line length
 * @param {number} avgLength - average characters per line
 * @returns {string} Time signature like "4/4", "3/4", "6/8"
 */
export const getTimeSignatureByAvgLength = (avgLength) => {
  if (avgLength < 20) return '3/4';
  if (avgLength > 60) return '6/8';
  return '4/4';
};

/**
 * Map first keyword in line to instrument type
 * @param {string} line - source code line
 * @returns {string} Instrument name: 'piano', 'strings', etc.
 */
export const getInstrumentByKeyword = (line) => {
  if (!line) return 'piano';

  const firstWord = line.trim().split(/\s+/)[0]?.replace(/[({;:,]/g, '') || '';
  const keywordMap = {
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
    def: 'harp',        // Python
    print: 'bell',      // Python
    echo: 'woodwind',   // PHP
    System: 'brass',    // Java
    fmt: 'plucked',     // Go
    default: 'piano'
  };
  return keywordMap[firstWord] || keywordMap.default;
};

/**
 * Calculate velocity and octave shift based on indentation
 * @param {string} line - source code line
 * @returns {{ velocity: number, octaveShift: number }}
 */
export const getVelocityAndOctaveByIndent = (line) => {
  if (!line) return { velocity: 0.5, octaveShift: 0 };

  const indentMatch = line.match(/^(\s*)/);
  const indentChars = indentMatch ? indentMatch[0] : '';
  const indentLevel = indentChars.length;

  // Velocity: 0.3 base + 0.05 per indent char, max 1.0
  const velocity = Math.min(0.3 + indentLevel * 0.05, 1.0);

  // Octave shift: every 4 spaces = +1 octave
  const octaveShift = Math.floor(indentLevel / 4);

  return { velocity, octaveShift };
};

/**
 * Get all note names in a given key (major or minor)
 * @param {string} key - e.g., "C", "Am", "G"
 * @returns {string[]} Array of note names like ["C", "D", "E", ...]
 */
export const getScaleNotes = (key = 'C') => {
  try {
    const isMinor = key.toLowerCase().includes('m') || ['Am', 'Em', 'Dm', 'Bm'].includes(key);
    const scale = Scale.get(`${key} ${isMinor ? 'minor' : 'major'}`);
    if (!scale?.notes) return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    // Convert flats to sharps
    const flatMap = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
    return scale.notes.map(n => flatMap[n] || n);
  } catch {
    return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  }
};

/**
 * Constrain a note to the nearest note within a given key/scale
 * @param {string} noteName - e.g., "C#4", "F5"
 * @param {string} key - e.g., "C", "Am"
 * @returns {string} In-scale note name, e.g., "C4", "E5"
 */
export const constrainNoteToKey = (noteName, key = 'C') => {
  if (!noteName || typeof noteName !== 'string') return 'C4';

  // Extract note and octave
  const match = noteName.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) return 'C4';

  let [_, notePart, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  // Get scale notes (sharps only)
  const scaleNotes = getScaleNotes(key);
  const targetChroma = Note.get(noteName).chroma;
  if (targetChroma == null) return 'C4';

  // Find closest in-scale note
  let closest = scaleNotes[0];
  let minDist = 12;
  for (const n of scaleNotes) {
    const c = Note.get(n).chroma;
    if (c == null) continue;
    const d = Math.min(Math.abs(targetChroma - c), 12 - Math.abs(targetChroma - c));
    if (d < minDist) {
      minDist = d;
      closest = n;
    }
  }

  // Return in same octave, with sharp notation
  return closest + octave;
};
