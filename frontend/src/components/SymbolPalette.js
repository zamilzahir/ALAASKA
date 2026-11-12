import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SYMBOLS, searchSymbols } from '../symbols';

const GROUPS = [...new Set(SYMBOLS.map((s) => s.group))];

// Symbol keys shown above the LaTeX editor.
// Top row: the symbols suggested for this assignment.
// "All symbols" opens the full library (grouped, searchable) as a panel that floats
// ABOVE the row, so the typing area underneath never moves or shrinks.
// Props:
//   symbols  - suggested symbol objects from symbols.js (may be empty)
//   onInsert - function(symbol) called when a key is clicked
//   title    - label shown at the start of the suggested row
//   compact  - one slim row: no title, at most `max` keys, and a short "More" button
//   anchorRef - element the floating panel sits above (default: the row itself)
//   label    - compact mode: small caption before the keys (e.g. "For this question")
//   sections - [{ name, symbols }] shown first in the panel (this question, frequent, basic);
//              the full library then sits behind "Browse all", so the panel opens small
//   footer   - optional node at the bottom of the panel (e.g. a setting)
//   showMore - false: just the keys, no "More" button/panel (another row has it)
//   plain    - compact keys drawn as plain characters (lighter look, e.g. "Frequent")
//   scroll   - compact row slides sideways (swipe / wheel / ‹ › arrows) instead of cutting off
export default function SymbolPalette({ symbols = [], onInsert, title = 'For this assignment',
  compact = false, max = 6, anchorRef = null, label = '', sections = null, footer = null, showMore = true, plain = false, scroll = false }) {
  const [open, setOpen] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const rowRef = useRef(null);
  const scrollRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Sideways-scrolling row: show ‹ › only when there is more in that direction.
  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    if (!scroll) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;
    updateEdges();
    // A normal mouse wheel scrolls the row sideways too.
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null;
    if (ro) ro.observe(el);
    return () => { el.removeEventListener('wheel', onWheel); if (ro) ro.disconnect(); };
  }, [scroll, updateEdges, symbols.length]);
  const nudge = (dir) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: 'smooth' });
  };
  const panelRef = useRef(null);
  const suggestedIds = new Set(symbols.map((s) => s.id));

  // Place the panel directly above the symbol row (fixed, so no container can clip it).
  const place = useCallback(() => {
    const r = (anchorRef?.current || rowRef.current)?.getBoundingClientRect();
    if (!r) return;
    setPos({
      left: r.left,
      width: r.width,
      bottom: window.innerHeight - r.top,
      maxHeight: Math.max(160, Math.min(sections ? 280 : 340, r.top - 12)),
    });
  }, [anchorRef, sections]);

  useLayoutEffect(() => {
    if (open) place();
    if (!open) { setBrowseAll(false); setQuery(''); }
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || rowRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    // The answer box can grow while the panel is open (e.g. a preview appears): stay above it.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    const target = anchorRef?.current || rowRef.current;
    if (ro && target) ro.observe(target);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, place, anchorRef]);

  const key = (sym, extra = '') => (
    <button
      key={sym.id}
      type="button"
      className={`symbol-palette-key ${extra}`}
      title={`${sym.name}  (${sym.latex})`}
      onMouseDown={(e) => e.preventDefault()} // keep the cursor in the answer box
      onClick={() => { onInsert(sym); setOpen(false); }} // insert, then close the panel
    >
      {sym.label}
    </button>
  );

  const results = query.trim() ? searchSymbols(query, [...suggestedIds], 40) : null;

  const panel = open && pos && (
    <div
      ref={panelRef}
      className="symbol-palette-all"
      style={{ left: pos.left, width: pos.width, bottom: pos.bottom, maxHeight: pos.maxHeight }}
      role="dialog"
      aria-label="All symbols"
    >
      <div className="symbol-palette-all-head">
        <input
          className="symbol-palette-search"
          type="text"
          placeholder="Search symbols (e.g. subset, theta, graph, hoare)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="symbol-palette-hint">Click a symbol to insert it · Esc to close</span>
      </div>
      {results ? (
        <div className="symbol-palette-group">
          {results.length
            ? results.map((sym) => key(sym, suggestedIds.has(sym.id) ? 'suggested' : ''))
            : <span className="symbol-palette-empty">No symbols match “{query}”.</span>}
        </div>
      ) : sections ? (
        <>
          {sections.filter((sec) => sec.symbols.length).map((sec) => (
            <div key={sec.name} className="symbol-palette-group">
              <span className="symbol-palette-group-name">{sec.name}</span>
              {sec.symbols.map((sym) => key(sym))}
            </div>
          ))}
          {browseAll ? GROUPS.map((group) => (
            <div key={group} className="symbol-palette-group">
              <span className="symbol-palette-group-name">{group}</span>
              {SYMBOLS.filter((s) => s.group === group).map((sym) => key(sym))}
            </div>
          )) : (
            <button type="button" className="symbol-palette-browse" onClick={() => setBrowseAll(true)}>
              Browse all {SYMBOLS.length} symbols by topic ▾
            </button>
          )}
        </>
      ) : (
        GROUPS.map((group) => (
          <div key={group} className="symbol-palette-group">
            <span className="symbol-palette-group-name">{group}</span>
            {SYMBOLS.filter((s) => s.group === group).map((sym) =>
              key(sym, suggestedIds.has(sym.id) ? 'suggested' : '')
            )}
          </div>
        ))
      )}
      {footer && <div className="symbol-palette-footer">{footer}</div>}
    </div>
  );

  return (
    <div className="symbol-palette-wrap">
      <div className={`symbol-palette ${compact ? 'compact' : ''} ${plain ? 'plain' : ''}`} ref={rowRef}>
        {!compact && <span className="symbol-palette-title">{symbols.length ? `${title}:` : 'Symbols:'}</span>}
        {compact && label && <span className="symbol-palette-label">{label}</span>}
        {scroll ? (
          <div className="symbol-palette-scroller">
            {edges.left && (
              <button type="button" className="symbol-palette-nudge left" aria-label="Scroll symbols left"
                onMouseDown={(e) => e.preventDefault()} onClick={() => nudge(-1)}>‹</button>
            )}
            <div className="symbol-palette-scroll" ref={scrollRef} onScroll={updateEdges}>
              {symbols.map((sym) => key(sym))}
            </div>
            {edges.right && (
              <button type="button" className="symbol-palette-nudge right" aria-label="Scroll symbols right"
                onMouseDown={(e) => e.preventDefault()} onClick={() => nudge(1)}>›</button>
            )}
          </div>
        ) : (compact ? symbols.slice(0, max) : symbols).map((sym) => key(sym))}
        {showMore && (
          <button
            type="button"
            className={`symbol-palette-more ${open ? 'active' : ''}`}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            {compact
              ? (open ? 'Close ▾' : 'More ▴')
              : (open ? 'Hide symbols ▴' : `All symbols (${SYMBOLS.length}) ▴`)}
          </button>
        )}
      </div>
      {panel && createPortal(panel, document.body)}
    </div>
  );
}
