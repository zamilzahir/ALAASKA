import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import { searchSymbols } from '../symbols';
import '../styles/symbol_picker.css';

// A textarea where typing "\" followed by a name (e.g. \subset, \integers)
// opens a dropdown of matching symbols. Symbols in `preferredIds` (this
// assignment's symbols) are listed first. Shows a live preview underneath.
export default function MathAutocompleteTextarea({
  value,
  onChange,
  preferredIds = [],
  placeholder,
  rows = 3,
  className = 'admin-textarea',
  showPreview = true,
}) {
  const textareaRef = useRef(null);
  const [query, setQuery] = useState(null); // null = dropdown closed
  const [highlight, setHighlight] = useState(0);

  const matches = query === null ? [] : searchSymbols(query, preferredIds);

  const updateQuery = (text, cursor) => {
    const m = text.slice(0, cursor).match(/\\([a-zA-Z]{0,20})$/);
    setQuery(m ? m[1] : null);
    setHighlight(0);
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    updateQuery(e.target.value, e.target.selectionStart);
  };

  const insertSymbol = (sym) => {
    const textarea = textareaRef.current;
    const text = value || '';
    const cursor = textarea.selectionStart;
    const typedLength = (query || '').length + 1; // the "\" plus the typed name
    const start = cursor - typedLength;
    const before = text.slice(0, start);
    const after = text.slice(cursor);

    // Wrap in $...$ unless the cursor is already inside math.
    const dollarsBefore = (before.replace(/\$\$/g, '').match(/\$/g) || []).length;
    const inMath = dollarsBefore % 2 === 1 || (before.match(/\$\$/g) || []).length % 2 === 1;
    const insert = inMath ? sym.latex : `$${sym.latex}$`;
    // Put the cursor inside braces for keys like x^{} (and inside the $...$ if we added it).
    const back = sym.back ? sym.back + (inMath ? 0 : 1) : 0;

    const newText = before + insert + after;
    onChange(newText);
    setQuery(null);

    const newCursor = start + insert.length - back;
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newCursor;
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (!matches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertSymbol(matches[highlight]);
    } else if (e.key === 'Escape') {
      setQuery(null);
    }
  };

  return (
    <div className="math-autocomplete">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => updateQuery(e.target.value, e.target.selectionStart)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        placeholder={placeholder}
        className={className}
        rows={rows}
      />

      {matches.length > 0 && (
        <ul className="math-autocomplete-list">
          {matches.map((sym, i) => (
            <li
              key={sym.id}
              className={i === highlight ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); insertSymbol(sym); }}
            >
              <span className="math-autocomplete-label">{sym.label}</span>
              <span className="math-autocomplete-name">{sym.name}</span>
              {preferredIds.includes(sym.id) && <span className="math-autocomplete-tag">this assignment</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="math-autocomplete-hint">
        Tip: type <code>\</code> and a name (e.g. <code>\subset</code>, <code>\integers</code>) to insert a symbol.
      </div>

      {showPreview && value && value.trim() && (
        <div className="math-autocomplete-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeMathjax]}>
            {value}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
