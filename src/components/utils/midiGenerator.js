// src/components/utils/midiGenerator.js

/**
 * Generate and download MIDI file from notes array
 * Uses raw MIDI events + FileSaver
 */

import { saveAs } from 'file-saver';

// Simple MIDI file generator (Type 0, single track)
export const generateMIDI = (notes, tempo = 120) => {
  // Header Chunk
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // header length
    0x00, 0x00,             // format: 0 (single track)
    0x00, 0x01,             // tracks: 1
    0x00, 0x60              // division: 96 ticks per beat (quarter note)
  ];

  // Calculate tick per second
  const ticksPerBeat = 96;
  const secondsPerBeat = 60 / tempo;
  const ticksPerSecond = ticksPerBeat / secondsPerBeat;

  // Build track events
  let trackEvents = [];

  // Tempo event
  trackEvents = trackEvents.concat([
    0x00, 0xff, 0x51, 0x03, // Set tempo
    ...intToBytes(Math.floor(60000000 / tempo), 3)
  ]);

  let currentTime = 0;

  // Note events
  notes.forEach(note => {
    const durationTicks = Math.floor(Tone.Time(note.duration).toSeconds() * ticksPerSecond);
    const midiNumber = Tone.Frequency(note.noteName).toMidi();

    // Note On
    trackEvents = trackEvents.concat([
      ...varLen(currentTime), // delta time
      0x90,                   // Note On, channel 0
      midiNumber,             // note
      Math.floor(note.velocity * 100) // velocity (0-127)
    ]);

    // Note Off
    trackEvents = trackEvents.concat([
      ...varLen(durationTicks), // delta time
      0x80,                    // Note Off, channel 0
      midiNumber,              // note
      0x40                     // velocity
    ]);

    currentTime = 0; // reset delta for next note (sequential)
  });

  // End of Track
  trackEvents = trackEvents.concat([
    0x00, 0xff, 0x2f, 0x00
  ]);

  // Track Chunk
  const trackLength = intToBytes(trackEvents.length, 4);
  const track = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    ...trackLength,
    ...trackEvents
  ];

  // Combine
  const midiData = new Uint8Array(header.length + track.length);
  midiData.set(header, 0);
  midiData.set(track, header.length);

  // Save
  const blob = new Blob([midiData], { type: 'audio/midi' });
  saveAs(blob, 'code2score_composition.mid');
};

// Helpers
function intToBytes(num, bytes) {
  const arr = [];
  for (let i = bytes - 1; i >= 0; i--) {
    arr.push((num >> (i * 8)) & 0xff);
  }
  return arr;
}

function varLen(value) {
  let buffer = [];
  buffer.push(value & 0x7f);
  while (value > 0x7f) {
    value >>= 7;
    buffer.push(0x80 | (value & 0x7f));
  }
  return buffer.reverse();
}
