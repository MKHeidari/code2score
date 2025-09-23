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
} from './utils/musicMapper';

const VF = Vex.Flow;

export default function CodeToMusicPlayer() {
  const editorRef = useRef(null);
  const canvasRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [filename, setFilename] = useState('example.js'); // simulate file type

  // Synth instances by type (cached)
  const synthCache = useRef({});

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

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = CodeMirror(editorRef.current, {
      value: `function hello() {\n  console.log("Hello, world!");\n    if (true) {\n      return true;\n    }\n}`,
      mode: 'javascript',
      lineNumbers: true,
      theme: 'default',
      viewportMargin: Infinity,
    });

    const analyzeCode = () => {
      const content = editor.getValue();
      const lines = content.split('\n').filter(line => line.trim() !== '');

      // Calculate average line length for time sig
      const avgLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
      const timeSig = getTimeSignatureByAvgLength(avgLength);
      const keySig = getKeySignatureByExtension(filename);

      const analyzed = lines.map((line, index) => {
        const length = line.length;
        const lastChar = line.slice(-1);
        const { velocity, octaveShift } = getVelocityAndOctaveByIndent(line);
        const instrument = getInstrumentByKeyword(line);

        // Pitch: base + length + octave shift
        const basePitch = 60 + octaveShift * 12; // C4 + octave shift
        const pitchOffset = Math.min(Math.floor(length / 5), 12);
        const midiNote = basePitch + pitchOffset;
        let noteName = Tone.Frequency(midiNote, "midi").toNote();

        // Later: constrain to key
        // noteName = constrainNoteToKey(noteName, keySig);

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
  }, [filename]);

  // Render VexFlow staff
  useEffect(() => {
    if (!canvasRef.current || notes.length === 0) return;

    const canvas = canvasRef.current;
    const renderer = new VF.Renderer(canvas, VF.Renderer.Backends.CANVAS);
    renderer.resize(800, 250);

    const context = renderer.getContext();
    context.setFont("Arial", 12, "").setBackgroundFillStyle("#f9f9f9");

    const firstNote = notes[0];
    const stave = new VF.Stave(10, 10, 750);
    stave.addClef("treble").addTimeSignature(firstNote.timeSig).addKeySignature(firstNote.keySig);
    stave.setContext(context).draw();

    const vexNotes = notes.map(note => {
      const vfnote = new VF.StaveNote({
        clef: "treble",
        keys: [note.noteName],
        duration: note.duration.replace('n', ''),
      });

      // Add dynamic mark if loud
      if (note.velocity > 0.7) {
        vfnote.addModifier(new VF.Annotation("f").setFont("Arial", 10), 0);
      } else if (note.velocity < 0.4) {
        vfnote.addModifier(new VF.Annotation("p").setFont("Arial", 10), 0);
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
  }, [notes]);

  // Play with animation
  const playNotes = async () => {
    if (notes.length === 0) return;

    await Tone.start();
    const now = Tone.now();
    let time = now;

    const editor = editorRef.current?.CodeMirror;

    notes.forEach((note, index) => {
      const synth = getSynth(note.instrument);

      // Schedule note
      synth.triggerAttackRelease(note.noteName, note.duration, time, note.velocity);

      // Schedule highlight
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
  };

  // Simulate file type change (you can add real file upload later)
  const handleFileTypeChange = (e) => {
    setFilename(e.target.value);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui', textAlign: 'left' }}>
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label>Simulate file type: </label>
        <select value={filename} onChange={handleFileTypeChange} style={{ padding: '4px' }}>
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
          height: '200px',
          border: '1px solid #ddd',
          marginBottom: '20px',
          borderRadius: '4px',
        }}
      ></div>

      <button
        onClick={playNotes}
        style={{
          padding: '12px 24px',
          background: '#059669',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          marginBottom: '20px',
        }}
      >
        🎼 Play Dynamic Symphony
      </button>

      <div>
        <canvas ref={canvasRef} width="800" height="250"></canvas>
      </div>

      {notes.length > 0 && (
        <details style={{ marginTop: '30px', background: '#fafafa', padding: '15px', borderRadius: '8px' }}>
          <summary>📊 Phase 2 Debug: Dynamics, Keys, Instruments</summary>
          <div style={{ fontSize: '0.85em', lineHeight: '1.6' }}>
            <p><strong>Time Signature:</strong> {notes[0]?.timeSig} | <strong>Key:</strong> {notes[0]?.keySig}</p>
            <ul>
              {notes.map((note, i) => (
                <li key={i}>
                  <strong>L{i+1}:</strong> <code>{note.content.trim()}</code> → 
                  <span style={{ color: '#d946ef', fontWeight: 'bold' }}> {note.noteName}</span> | 
                  <span style={{ color: '#059669' }}> {note.duration}</span> | 
                  <span style={{ color: '#dc2626' }}> vol: {note.velocity.toFixed(2)}</span> | 
                  <span style={{ color: '#7c3aed' }}> 🎹 {note.instrument}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {/* Inject CSS for line highlight */}
      <style jsx>{`
        .highlight-line {
          background-color: #fef3c7 !important;
          transition: background-color 0.3s;
        }
      `}</style>
    </div>
  );
}
