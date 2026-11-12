import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import api from '../api/axios';
import '../styles/writing_pad.css';

// Handwriting pad: the student writes with a mouse, trackpad, stylus or finger,
// ALAASKA converts it to Markdown/LaTeX, the student checks it, then inserts it.
export default function WritingPad({ onInsert, onClose }) {
  const canvasRef = useRef(null);
  const resultRef = useRef(null);
  const drawing = useRef(false);
  const strokes = useRef([]); // list of strokes, each a list of points (for undo)
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [attaching, setAttaching] = useState(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes.current) {
      ctx.beginPath();
      stroke.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.1, stroke[0].y + 0.1);
      ctx.stroke();
    }
    setHasInk(strokes.current.length > 0);
  };

  useEffect(() => {
    // Match the canvas's pixel size to its on-screen size.
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(300, Math.round(rect.width));
    canvas.height = 240;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current.height / rect.height),
    };
  };

  const start = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([point(e)]);
    redraw();
  };
  const move = (e) => {
    if (!drawing.current) return;
    strokes.current[strokes.current.length - 1].push(point(e));
    redraw();
  };
  const end = () => { drawing.current = false; };

  const undo = () => { strokes.current.pop(); redraw(); };
  const clear = () => { strokes.current = []; setResult(''); setError(''); redraw(); };

  // Main action: send the drawing itself, so the AI tutor sees the picture (any drawing works).
  const attach = async () => {
    setAttaching(true);
    setError('');
    try {
      const image = canvasRef.current.toDataURL('image/png');
      const res = await api.post('/handwriting/attach', { image });
      onInsert(`\n![handwritten work](${res.data.url})\n`);
      clear();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not attach the drawing. Try again.');
    } finally {
      setAttaching(false);
    }
  };

  const convert = async () => {
    setBusy(true);
    setError('');
    try {
      const image = canvasRef.current.toDataURL('image/png');
      const res = await api.post('/handwriting/convert', { image });
      setResult(res.data.text || '');
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      if (!res.data.text) setError('Nothing was recognized. Try writing larger.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not convert. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="writing-pad-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="writing-pad" role="dialog" aria-label="Writing pad">
      <div className="writing-pad-header">
        <span className="writing-pad-title">✍️ Writing pad</span>
        <span className="writing-pad-hint">Draw anything (trees, graphs, math). Attach it as a picture, or convert handwriting to text.</span>
        <button type="button" className="writing-pad-close" onClick={onClose} title="Close">×</button>
      </div>

      <canvas
        ref={canvasRef}
        className="writing-pad-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />

      <div className="writing-pad-actions">
        <button type="button" className="writing-pad-btn" onClick={undo} disabled={!hasInk || busy}>Undo</button>
        <button type="button" className="writing-pad-btn" onClick={clear} disabled={busy}>Clear</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="writing-pad-btn" onClick={convert} disabled={!hasInk || busy || attaching}
          title="Turn handwriting into typed text/LaTeX you can edit">
          {busy ? 'Converting…' : 'Convert to text'}
        </button>
        <button type="button" className="writing-pad-btn primary" onClick={attach} disabled={!hasInk || busy || attaching}
          title="Add the drawing to your answer as an image; the tutor can see it">
          {attaching ? 'Attaching…' : 'Attach drawing'}
        </button>
      </div>

      {error && <div className="writing-pad-error">{error}</div>}

      {result && (
        <div className="writing-pad-result" ref={resultRef}>
          <label>Recognized (edit if needed):</label>
          <textarea value={result} onChange={(e) => setResult(e.target.value)} rows={3} />
          <div className="writing-pad-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeMathjax]}>
              {result}
            </ReactMarkdown>
          </div>
          <div className="writing-pad-actions">
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="writing-pad-btn primary"
              onClick={() => { onInsert(result); clear(); }}
            >
              Insert into answer
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
