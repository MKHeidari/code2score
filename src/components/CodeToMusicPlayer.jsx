import React, { useRef, useState, useEffect } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike';
import * as Vex from 'vexflow';
import * as Tone from 'tone';

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

export default function CodeToMusicPlayer() {
  const editorRef = useRef(null);
  const canvasRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [filename, setFilename] = useState('example.js');
  const [isPlaying, setIsPlaying] = useState(false);
  const synthCache = useRef({});
  const { darkMode } = useTheme();

  const getSynth = (type) => {
    if (synthCache.current[type]) return synthCache.current[type];

    let synth;
    switch (type) {
      case 'strings':
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.5, decay: 0.5, sustain: 1, release: 1 }
        });
        break;
      case 'pluck':
        synth = new Tone.PolySynth(Tone.PluckSynth);
        break;
      case 'marimba':
        synth = new Tone.PolySynth(Tone.MetalSynth);
        break;
      case 'organ':
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 1 }
        });
        break;
      case 'piano':
      default:
        synth = new Tone.PolySynth(Tone.Synth);
    }

    synth.toDestination();
    synthCache.current[type] = synth;
    return synth;
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = CodeMirror(editorRef.current, {
      value: `function hello() {\n  console.log("Hello, world!");\n    if (true) {\n      return true;\n    }\n}`,
      mode: 'javascript',
      lineNumbers: true,
      theme: darkMode ? 'monokai' : 'default',
      viewportMargin: Infinity,
    });

    const analyzeCode = () => {
      const content = editor.getValue();
      const lines = content.split('\n').filter(line => line.trim() !== '');

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
        let noteName = Tone.Frequency(midiNote, "midi").toNote();

        // 🔑 SCALE ENFORCEMENT!
        noteName = constrainNoteToKey(noteName, keySig);

        let duration = "4n";
        if (lastChar === '}') duration = "2n";
        if (lastChar === ';') duration = "4n";
        if (lastChar === ':') duration = "8n";

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
    };

    editor.on('change', analyzeCode);
    analyzeCode();

    // Cleanup
    return () => {
      editor.toTextArea();
    };
  }, [filename, darkMode]);

  useEffect(() => {
    if (!canvasRef.current || notes.length === 0) return;

    const canvas = canvasRef.current;
    const renderer = new VF.Renderer(canvas, VF.Renderer.Backends.SVG);
    renderer.resize(800, 300);

    const context = renderer.getContext();
    context.setBackgroundFillStyle(darkMode ? "#1f2937" : "#f9fafb");
    context.setStrokeStyle(darkMode ? "#f9fafb" : "#111827");
    context.setFont("Arial", 14, "");

    const firstNote = notes[0];
    const stave = new VF.Stave(20, 20, 750);
    stave
      .addClef("treble")
      .addTimeSignature(firstNote.timeSig)
      .addKeySignature(firstNote.keySig)
      .setContext(context)
      .draw();

    const vexNotes = notes.map(note => {
      const vfnote = new VF.StaveNote({
        clef: "treble",
        keys: [note.noteName],
        duration: note.duration.replace('n', ''),
      });

      if (note.velocity > 0.7) {
        vfnote.addModifier(new VF.Annotation("f").setFont("Arial", 12), 0);
      } else if (note.velocity < 0.4) {
        vfnote.addModifier(new VF.Annotation("p").setFont("Arial", 12), 0);
      }

      return vfnote;
    });

    const voice = new VF.Voice({
      num_beats: parseInt(firstNote.timeSig.split('/')[0]),
      beat_value: parseInt(firstNote.timeSig.split('/')[1])
    }).setStrict(false);

    voice.addTickables(vexNotes);
    const formatter = new VF.Formatter().joinVoices([voice]).format([voice], 700);
    voice.draw(context, stave);
  }, [notes, darkMode]);

  const playNotes = async () => {
    if (notes.length === 0 || isPlaying) return;

    setIsPlaying(true);
    await Tone.start();

    const now = Tone.now();
    let time = now;
    const editor = editorRef.current?.CodeMirror;

    notes.forEach((note, index) => {
      const synth = getSynth(note.instrument);
      synth.triggerAttackRelease(note.noteName, note.duration, time, note.velocity);

      setTimeout(() => {
        if (editor) {
          editor.setCursor({ line: index, ch: 0 });
          editor.addLineClass(index, 'wrap', 'highlight-line');
          setTimeout(() => {
            editor.removeLineClass(index, 'wrap', 'highlight-line');
          }, Tone.Time(note.duration).toMilliseconds() + 100);
        }
      }, (time - now) * 1000);

      time += Tone.Time(note.duration).toSeconds() + 0.1;
    });

    setTimeout(() => {
      setIsPlaying(false);
    }, (time - now) * 1000);
  };

  const exportMIDI = () => {
    if (notes.length === 0) return;
    generateMIDI(notes, 120); // 120 BPM
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
            <p><strong>Time Sig:</strong> {notes[0]?.timeSig} | <strong>Key:</strong> {notes[0]?.keySig} → Scale: {getScaleNotes(notes[0]?.keySig).join(', ')}</p>
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
