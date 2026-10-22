import React from 'react';

// A row of symbol keys shown above the LaTeX editor.
// Props:
//   symbols  - array of symbol objects from symbols.js
//   onInsert - function(symbol) called when a key is clicked
//   title    - label shown at the start of the row
export default function SymbolPalette({ symbols = [], onInsert, title = 'For this assignment' }) {
  if (!symbols.length) return null;

  return (
    <div className="symbol-palette">
      <span className="symbol-palette-title">{title}:</span>
      {symbols.map((sym) => (
        <button
          key={sym.id}
          type="button"
          className="symbol-palette-key"
          title={`${sym.name}  (${sym.latex})`}
          onClick={() => onInsert(sym)}
        >
          {sym.label}
        </button>
      ))}
    </div>
  );
}
