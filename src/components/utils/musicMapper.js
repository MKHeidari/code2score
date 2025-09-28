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
    const scaleType = isMinor ? 'minor' : 'major';
    const scale = Scale.get(`${key} ${scaleType}`);
    
    if (!scale?.notes?.length) {
      return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    }

    // Convert flats to enharmonic sharps
    const flatToSharp = {
      'Db': 'C#',
      'Eb': 'D#',
      'Gb': 'F#',
      'Ab': 'G#',
      'Bb': 'A#'
    };

    return scale.notes.map(note => flatToSharp[note] || note);
  } catch (e) {
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
  if (!noteName) return 'C4';

  try {
    const note = Note.get(noteName);
    if (!note || note.empty) {
      console.warn(`[musicMapper] Invalid note: ${noteName}, defaulting to C4`);
      return 'C4';
    }

    const scaleNotes = getScaleNotes(key);
    const scaleChromas = scaleNotes
      .map(n => {
        const parsed = Note.get(n);
        return parsed.chroma;
      })
      .filter(c => c !== undefined);

    if (scaleChromas.length === 0) {
      return noteName; // fallback if scale is broken
    }

    const targetChroma = note.chroma;
    let closestChroma = scaleChromas[0];
    let minDistance = 12;

    for (const chroma of scaleChromas) {
      const dist1 = Math.abs(targetChroma - chroma);
      const dist2 = 12 - dist1;
      const distance = Math.min(dist1, dist2);

      if (distance < minDistance) {
        minDistance = distance;
        closestChroma = chroma;
      }
    }

    // Find note name with that chroma
    const closestNoteName = scaleNotes.find(n => {
      const parsed = Note.get(n);
      return parsed.chroma === closestChroma;
    });

    // Preserve original octave
    const octave = note.octave || 4;
    return closestNoteName + octave;

  } catch (error) {
    console.error(`[musicMapper] Error constraining note ${noteName} to key ${key}:`, error);
    return noteName; // fallback
  }
};
