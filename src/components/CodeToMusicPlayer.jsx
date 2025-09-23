import React, { useRef, useState, useEffect } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/clike/clike';
import * as Vex from 'vexflow';
import * as Tone from 'tone';

const VF = Vex.Flow;

export default function CodeToMusicPlayer() {
  const editorRef = useRef(null);
  const canvasRef = useRef(null);
  const [notes, setNotes] = useState([]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = CodeMirror(editorRef.current, {
      value: `function hello() {\n  console.log("Hello, world!");\n  return true;\n}`,
      mode: 'javascript',
      lineNumbers: true,
      theme: 'default',
      viewportMargin: Infinity,
    });

    const analyzeCode = () => {
      const content = editor.getValue();
      const lines = content.split('\n').filter(line => line.trim() !== '');

      const analyzed = lines.map((line, index) => {
        const length = line.length;
        const lastChar = line.slice(-1);
        const basePitch = 60; // C4
        const pitchOffset = Math.min(Math.floor(length / 5), 12);
        const midiNote = basePitch + pitchOffset;
        const noteName = Tone.Frequency(midiNote, "midi").toNote();

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
        };
      });

      setNotes(analyzed);
    };

    editor.on('change', analyzeCode);
    analyzeCode(); // initial analysis
  }, []);

  // Render VexFlow staff
  useEffect(() => {
    if (!canvasRef.current || notes.length === 0) return;

    const canvas = canvasRef.current;
    const renderer = new VF.Renderer(canvas, VF.Renderer.Backends.CANVAS);
    renderer.resize(800, 200);

    const context = renderer.getContext();
    context.setFont("Arial", 10, "").setBackgroundFillStyle("#f9f9f9");

    const stave = new VF.Stave(10, 0, 750);
    stave.addClef("treble").addTimeSignature("4/4");
    stave.setContext(context).draw();

    const vexNotes = notes.map(note => {
      return new VF.StaveNote({
        clef: "treble",
        keys: [note.noteName],
        duration: note.duration.replace('n', ''),
      });
    });

    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 });
    voice.addTickables(vexNotes);

    const formatter = new VF.Formatter().joinVoices([voice]).format([voice], 700);
    voice.draw(context, stave);
  }, [notes]);

  // Play with Tone.js
  const playNotes = async () => {
    if (notes.length === 0) return;

    await Tone.start();
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();

    let time = Tone.now();
    notes.forEach(note => {
      synth.triggerAttackRelease(note.noteName, note.duration, time);
      time += Tone.Time(note.duration).toSeconds() + 0.1;
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui', textAlign: 'left' }}>
      <div ref={editorRef} style={{ height: '200px', border: '1px solid #ddd', marginBottom: '20px' }}></div>

      <button
        onClick={playNotes}
        style={{
          padding: '10px 20px',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginBottom: '20px',
        }}
      >
        🎵 Play Code Symphony
      </button>

      <div>
        <canvas ref={canvasRef} width="800" height="200"></canvas>
      </div>

      {notes.length > 0 && (
        <details style={{ marginTop: '30px', background: '#fafafa', padding: '15px', borderRadius: '8px' }}>
          <summary>📊 Mapping Debug (Click to Expand)</summary>
          <ul style={{ fontSize: '0.9em', lineHeight: '1.6' }}>
            {notes.map((note, i) => (
              <li key={i}>
                <strong>Line {note.line}:</strong> "{note.content.trim()}" → 
                <em> {note.noteName}</em> ({note.duration}) | len={note.length}, last="{note.lastChar}"
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
