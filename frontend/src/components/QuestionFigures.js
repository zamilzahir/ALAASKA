import React from 'react';
import api from '../api/axios';
import '../styles/writing_pad.css';

// The homework's own figure numbers ("Figure 3", "Figure 4"), in the order the question
// mentions them, so the labels match the text. Falls back to 1, 2, … when they don't line up.
export function figureNumbersFromText(text, count) {
  const seen = [];
  for (const m of String(text || '').matchAll(/\bFig(?:ure)?\.?\s*(\d+)/gi)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen.length === count ? seen : null;
}

// Shows a question's figures (graphs, tables, pictures cut from the homework PDF).
// With onRemove, each figure gets a Remove button (instructor form).
// questionText (optional) lets the labels use the homework's own figure numbers.
export default function QuestionFigures({ figures = [], onRemove, showDescriptions = false, questionText = '' }) {
  if (!figures || !figures.length) return null;
  const numbers = figureNumbersFromText(questionText, figures.length);
  const base = api.defaults.baseURL || '';
  return (
    <div className="question-figures">
      {figures.map((fig, i) => (
        <figure key={fig.figure_id} className="question-figure">
          <img src={`${base}/figures/${fig.figure_id}`} alt={`Figure ${numbers ? numbers[i] : i + 1} (${fig.kind})`} />
          <figcaption>
            Figure {numbers ? numbers[i] : i + 1}{showDescriptions || onRemove ? ` · ${fig.kind}` : ''}
            {onRemove && (
              <button type="button" className="figure-remove" onClick={() => onRemove(i)}>Remove</button>
            )}
          </figcaption>
          {showDescriptions && fig.description && (
            <details className="figure-description">
              <summary>What the tutor sees</summary>
              <pre>{fig.description}</pre>
            </details>
          )}
        </figure>
      ))}
    </div>
  );
}
