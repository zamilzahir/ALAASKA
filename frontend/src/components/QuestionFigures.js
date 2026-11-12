import React from 'react';
import api from '../api/axios';
import '../styles/writing_pad.css';

// Shows a question's figures (graphs, tables, pictures cut from the homework PDF).
// With onRemove, each figure gets a Remove button (instructor form).
export default function QuestionFigures({ figures = [], onRemove, showDescriptions = false }) {
  if (!figures || !figures.length) return null;
  const base = api.defaults.baseURL || '';
  return (
    <div className="question-figures">
      {figures.map((fig, i) => (
        <figure key={fig.figure_id} className="question-figure">
          <img src={`${base}/figures/${fig.figure_id}`} alt={`Figure ${i + 1} (${fig.kind})`} />
          <figcaption>
            Figure {i + 1} · {fig.kind}
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
