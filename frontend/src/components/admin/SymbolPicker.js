import React, { useState } from 'react';
import api from '../../api/axios';
import { SYMBOLS, PRESETS, symbolsFromIds } from '../../symbols';
import '../../styles/symbol_picker.css';
import '../../styles/writing_pad.css';

const GROUPS = [...new Set(SYMBOLS.map((s) => s.group))];

// Lets the instructor choose which symbols students see for this assignment.
// Props:
//   value        - array of symbol ids
//   onChange     - function(newIds)
//   questionText - all question text in the form, also scanned for symbols
export default function SymbolPicker({ value = [], onChange, questionText = '', onQuestions }) {
  const [homework, setHomework] = useState(null);
  const [solution, setSolution] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filling, setFilling] = useState(false);

  // Read the homework PDF and fill the template's questions (the professor reviews them after).
  const fillQuestions = async () => {
    if (!homework) {
      setStatus('Choose the homework PDF first.');
      return;
    }
    const form = new FormData();
    form.append('homework', homework);
    try {
      setFilling(true);
      setStatus('Reading questions from the homework…');
      const res = await api.post('/assignment-templates/extract-questions', form);
      const questions = res.data.questions || [];
      if (!questions.length) {
        setStatus('No questions found in this PDF.');
        return;
      }
      const filled = onQuestions(questions);
      if (filled === false) {
        setStatus('Kept your existing questions.');
        return;
      }
      if (res.data.symbols?.length) addIds(res.data.symbols);
      setStatus(
        `Filled ${questions.length} questions` +
        (res.data.figure_count ? ` with ${res.data.figure_count} figures (graphs/tables)` : '') +
        `${res.data.method === 'basic' ? ' (basic mode, check the math formatting)' : ''}. ` +
        'Review each one below before saving.'
      );
    } catch (err) {
      setStatus(err.response?.data?.detail || 'Could not read questions from the PDF.');
    } finally {
      setFilling(false);
    }
  };

  const selected = symbolsFromIds(value);
  const addIds = (ids) => onChange([...value, ...ids.filter((id) => !value.includes(id))]);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const suggest = async () => {
    if (!homework && !solution && !questionText.trim()) {
      setStatus('Upload a homework or solution PDF, or type a question first.');
      return;
    }
    const form = new FormData();
    if (homework) form.append('homework', homework);
    if (solution) form.append('solution', solution);
    form.append('text', questionText);
    try {
      setBusy(true);
      setStatus('Reading files…');
      const res = await api.post('/symbols/suggest', form);
      const found = res.data.symbols || [];
      const newOnes = found.filter((id) => !value.includes(id));
      addIds(found);
      setStatus(
        found.length
          ? `Found ${found.length} symbols (${newOnes.length} new). Remove any you don't want.`
          : 'No symbols found. Pick them below or use a preset.'
      );
    } catch (err) {
      setStatus(err.response?.data?.detail || 'Could not suggest symbols.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="symbol-picker">
      <h3>Upload homework</h3>
      <p className="symbol-picker-help">
        Upload the homework (and solution) PDF to fill in the questions and suggest symbols for students.
        Files are only read, never saved. Review everything before creating the template.
      </p>

      <div className="symbol-picker-uploads">
        <label>
          Homework PDF
          <input type="file" accept="application/pdf" onChange={(e) => setHomework(e.target.files[0] || null)} />
        </label>
        <label>
          Solution PDF
          <input type="file" accept="application/pdf" onChange={(e) => setSolution(e.target.files[0] || null)} />
        </label>
        <button type="button" className="admin-button" onClick={suggest} disabled={busy}>
          {busy ? 'Reading…' : 'Suggest symbols'}
        </button>
        {onQuestions && (
          <button type="button" className="autofill-button" onClick={fillQuestions} disabled={filling || busy}>
            {filling ? 'Reading questions…' : 'Fill questions from homework'}
          </button>
        )}
      </div>
      {status && <div className="symbol-picker-status">{status}</div>}

      <h4 className="symbol-picker-subtitle">Symbols for students</h4>

      <div className="symbol-picker-selected">
        {selected.length === 0 && <span className="symbol-picker-empty">No symbols selected yet.</span>}
        {selected.map((sym) => (
          <button key={sym.id} type="button" className="symbol-chip" title={`Remove ${sym.name}`} onClick={() => toggle(sym.id)}>
            {sym.label} <span className="symbol-chip-x">×</span>
          </button>
        ))}
        {selected.length > 0 && (
          <button type="button" className="symbol-picker-link" onClick={() => onChange([])}>Clear all</button>
        )}
      </div>

      <div className="symbol-picker-presets">
        <span>Add a preset:</span>
        {Object.entries(PRESETS).map(([name, ids]) => (
          <button key={name} type="button" className="symbol-preset" onClick={() => addIds(ids)}>{name}</button>
        ))}
        <button type="button" className="symbol-picker-link" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Hide all symbols' : 'Browse all symbols'}
        </button>
      </div>

      {showAll && (
        <div className="symbol-picker-all">
          {GROUPS.map((group) => (
            <div key={group} className="symbol-picker-group">
              <span className="symbol-picker-group-name">{group}</span>
              {SYMBOLS.filter((s) => s.group === group).map((sym) => (
                <button
                  key={sym.id}
                  type="button"
                  className={`symbol-key ${value.includes(sym.id) ? 'selected' : ''}`}
                  title={`${sym.name} (${sym.latex})`}
                  onClick={() => toggle(sym.id)}
                >
                  {sym.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
