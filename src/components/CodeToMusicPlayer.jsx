// src/components/CodeToMusicPlayer.jsx

import React, { useRef, useState, useEffect } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike';
import 'codemirror/theme/monokai.css';
import * as Vex from 'vexflow';

// ✅ Import full Tone.js v13 bundle (defines global `Tone`)
// import 'tone/build/Tone';
import 'tone';

// Utils
import {
  getKeySignatureByExtension,
  getTimeSignatureByAvgLength,
  getInstrumentByKeyword,
  getVelocityAndOctaveByIndent,
  constrainNoteToKey,
} from './utils/musicMapper';
import { generateMIDI } from './utils/midiGenerator';
import { useTheme } from '../context/ThemeContext';

const VF = Vex.Flow;

// 🔑 Pure helper: MIDI number → note name (e.g., 60 → "C4")
function midiToNoteName(midi) {
  if (midi < 0 || midi > 127) return 'C4';
  // VexFlow requires sharps, not flats
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = midi % 12;
  return notes[note] + octave;
}

export default function CodeToMusicPlayer() {
  const editorRef = useRef(null);
  const canvasRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [filename, setFilename] = useState('example.js');
  const [isPlaying, setIsPlaying] = useState(false);
  const synthCache = useRef({});
  const { darkMode } = useTheme();

  // ✅ Get synth using global Tone (only called after user gesture)
  const getSynth = (type) => {
    if (synthCache.current[type]) {
      return synthCache.current[type];
    }

    let SynthClass;
    let options = {};

    switch (type) {
      case 'strings':
        SynthClass = Tone.Synth;
        options = {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.5, decay: 0.5, sustain: 1, release: 1 }
        };
        break;
      case 'pluck':
        SynthClass = Tone.PluckSynth;
        options = {};
        break;
      case 'marimba':
        SynthClass = Tone.MetalSynth;
        options = {};
        break;
      case 'organ':
        SynthClass = Tone.Synth;
        options = {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 1 }
        };
        break;
      case 'piano':
      default:
        SynthClass = Tone.Synth;
        options = {};
    }

    const synth = new Tone.PolySynth(SynthClass, {
      ...options,
      voices: 6,
      volume: -12
    });

    synth.toMaster();
    synthCache.current[type] = synth;
    return synth;
  };

  // ✅ Analyze code WITHOUT using Tone (safe on load)
  useEffect(() => {
    if (!editorRef.current) return;

    editorRef.current.innerHTML = '';

    const editor = CodeMirror(editorRef.current, {
      value: `function hello() {\n  console.log("Hello, world!");\n    if (true) {\n      return true;\n    }\n}`,
      mode: 'javascript',
      lineNumbers: true,
      theme: darkMode ? 'monokai' : 'default',
      viewportMargin: Infinity,
    });

    const analyzeCode = () => {
      try {
        const content = editor.getValue();
        const lines = content.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) {
          setNotes([]);
          return;
        }

        const avgLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
        const timeSig = getTimeSignatureByAvgLength(avgLength);
        const keySig = getKeySignatureByExtension(filename);

        const analyzed = lines.map((line, index) => {
          const length = line.length;
          const lastChar = line.slice(-1);
          const { velocity, octaveShift } = getVelocityAndOctaveByIndent(line);
          const instrument = getInstrumentByKeyword(line);

          const basePitch = 60 + octaveShift * 12;
          const pitchOffset = Math.min(Math.floor(length / 5), 12);
          const midiNote = basePitch + pitchOffset;

          // ✅ SAFE: No Tone used here
          let noteName = midiToNoteName(midiNote);

          // Enforce scale (only needs string like "C4")
          noteName = constrainNoteToKey(noteName, keySig);

          let duration = '4n';
          if (lastChar === '}') duration = '2n';
          if (lastChar === ';') duration = '4n';
          if (lastChar === ':') duration = '8n';

          return {
            line: index + 1,
            content: line,
            length,
            lastChar,
            midiNote,
            noteName,
            duration,
            velocity,
            instrument,
            timeSig,
            keySig,
          };
        });

        setNotes(analyzed);
      } catch (error) {
        console.error('[CodeToMusicPlayer] Error analyzing code:', error);
        setNotes([]);
      }
    };

    editor.on('change', analyzeCode);
    analyzeCode();

    return () => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    };
  }, [filename, darkMode]);

  // Render VexFlow staff
  useEffect(() => {
    if (!canvasRef.current || notes.length === 0) return;

    try {
      const canvas = canvasRef.current;
      const renderer = new VF.Renderer(canvas, VF.Renderer.Backends.SVG);
      renderer.resize(800, 300);

      const context = renderer.getContext();
      context.setBackgroundFillStyle(darkMode ? '#1f2937' : '#f9fafb');
      context.setStrokeStyle(darkMode ? '#f9fafb' : '#111827');
      context.setFont('Arial', 14, '');

      const firstNote = notes[0];
      const stave = new VF.Stave(20, 20, 750);
      stave
        .addClef('treble')
        .addTimeSignature(firstNote.timeSig)
        .addKeySignature(firstNote.keySig)
        .setContext(context)
        .draw();

      const vexNotes = notes.map(note => {
        const vfnote = new VF.StaveNote({
          clef: 'treble',
          keys: [note.noteName],
          duration: note.duration.replace('n', ''),
        });

        if (note.velocity > 0.7) {
          vfnote.addModifier(new VF.Annotation('f').setFont('Arial', 12), 0);
        } else if (note.velocity < 0.4) {
          vfnote.addModifier(new VF.Annotation('p').setFont('Arial', 12), 0);
        }

        return vfnote;
      });

      const beats = parseInt(firstNote.timeSig.split('/')[0]);
      const beatValue = parseInt(firstNote.timeSig.split('/')[1]);
      const voice = new VF.Voice({ num_beats: beats, beat_value: beatValue }).setStrict(false);
      voice.addTickables(vexNotes);

      const formatter = new VF.Formatter().joinVoices([voice]).format([voice], 700);
      voice.draw(context, stave);
    } catch (error) {
      console.error('[CodeToMusicPlayer] Error rendering VexFlow:', error);
    }
  }, [notes, darkMode]);

  // ✅ Play only after user click → complies with autoplay policy
  const playNotes = async () => {
    if (notes.length === 0 || isPlaying) return;

  setIsPlaying(true);

  // ✅ Dynamically import Tone ONLY when needed (after user click)
  const ToneModule = await import('tone');
  const { PolySynth, Synth, PluckSynth, MetalSynth, start, now, Time } = ToneModule;

  try {
    await start();
  } catch (err) {
    console.error('Tone.js start failed:', err);
    setIsPlaying(false);
    return;
  }

    const now = Tone.now();
    let time = now;
    const cmEditor = editorRef.current?.CodeMirror;

    notes.forEach((note, index) => {
      const synth = getSynth(note.instrument);
      synth.triggerAttackRelease(note.noteName, note.duration, time, note.velocity);

      if (cmEditor) {
        try {
          cmEditor.setCursor({ line: index, ch: 0 });
          cmEditor.addLineClass(index, 'wrap', 'highlight-line');
          setTimeout(() => {
            cmEditor.removeLineClass(index, 'wrap', 'highlight-line');
          }, Tone.Time(note.duration).toMilliseconds() + 100);
        } catch (e) {
          // Ignore
        }
      }

      time += Tone.Time(note.duration).toSeconds() + 0.1;
    });

    setTimeout(() => {
      setIsPlaying(false);
    }, (time - now) * 1000);
  };

  const exportMIDI = () => {
    if (notes.length === 0) return;
    try {
      generateMIDI(notes, 120);
    } catch (error) {
      console.error('MIDI export failed:', error);
    }
  };

  const handleFileTypeChange = (e) => {
    setFilename(e.target.value);
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontWeight: '500' }}>Simulate file type:</label>
        <select
          value={filename}
          onChange={handleFileTypeChange}
          style={{
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="example.js">JavaScript (.js)</option>
          <option value="example.py">Python (.py)</option>
          <option value="example.php">PHP (.php)</option>
          <option value="example.java">Java (.java)</option>
          <option value="example.go">Go (.go)</option>
        </select>
      </div>

      <div
        ref={editorRef}
        style={{
          height: '220px',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: 'var(--bg-primary)',
        }}
      ></div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button
          onClick={playNotes}
          disabled={isPlaying}
          style={{
            padding: '0.75rem 1.5rem',
            background: isPlaying ? '#6b7280' : 'var(--button-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isPlaying ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {isPlaying ? '▶️ Playing...' : '▶️ Play Symphony'}
        </button>

        <button
          onClick={exportMIDI}
          disabled={notes.length === 0}
          style={{
            padding: '0.75rem 1.5rem',
            background: notes.length === 0 ? '#6b7280' : '#4f46e5',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: notes.length === 0 ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          💾 Export MIDI
        </button>
      </div>

      <div style={{
        background: 'var(--bg-primary)',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
      }}>
        <canvas
          ref={canvasRef}
          width="800"
          height="300"
          style={{ maxWidth: '100%', height: 'auto' }}
        ></canvas>
      </div>

      {notes.length > 0 && (
        <details style={{
          marginTop: '1.5rem',
          background: 'var(--bg-primary)',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          <summary style={{ fontWeight: '600', cursor: 'pointer' }}>
            📊 Debug: Scale-Constrained Notes & Mapping
          </summary>
          <div style={{ fontSize: '0.875rem', lineHeight: '1.6', marginTop: '1rem' }}>
            <p>
              <strong>Time Sig:</strong> {notes[0]?.timeSig} | <strong>Key:</strong> {notes[0]?.keySig}
            </p>
            <ul style={{ paddingLeft: '1.25rem' }}>
              {notes.map((note, i) => (
                <li key={i}>
                  <strong>L{i+1}:</strong> <code>{note.content.trim()}</code> → 
                  <span style={{ color: '#d946ef', fontWeight: '600' }}> {note.noteName}</span> (in-key) | 
                  <span style={{ color: '#059669' }}> {note.duration}</span> | 
                  <span style={{ color: '#dc2626' }}> vol: {note.velocity.toFixed(2)}</span> | 
                  <span style={{ color: '#7c3aed' }}> 🎹 {note.instrument}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
