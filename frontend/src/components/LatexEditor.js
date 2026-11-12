import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import '../styles/latex_editor.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';
import SymbolPalette from './SymbolPalette';
import WritingPad from './WritingPad';
import FileUploadButton from './FileUploadButton';
import MarkdownImage from './MarkdownImage';
import MathInput from './MathInput';
import { SYMBOLS, symbolsFromIds, searchSymbols } from '../symbols';
import { recordSymbolUse, frequentSymbols, rankQuickSymbols, symbolsInText, getAutoConvert, setAutoConvert } from '../symbolUsage';
import '../styles/symbol_palette.css';

// Shown when the assignment has no suggested symbols (e.g. normal chats).
const DEFAULT_SYMBOL_IDS = ['forall', 'exists', 'in', 'notin', 'subseteq', 'cup', 'cap', 'emptyset',
  'not', 'and', 'or', 'implies', 'theta', 'sum'];

// A symbol that is one plain character (∪, ∈, ℕ …) goes straight into the sentence as that
// character, so the answer box stays readable. Structured ones (fractions, sums, |A|, O(n) …)
// open the formula box instead, ready to fill in.
const isPlainSymbol = (sym) =>
  /^\\mathbb\{[A-Z]\}$/.test(sym.latex) ||
  (!/[{}^_]/.test(sym.latex) && !/[A-Za-z0-9]/.test(sym.label) && [...sym.label].length <= 2 && !/\s/.test(sym.label.trim()) && sym.label.trim().length > 0 && !sym.back);

// Turn a template like "\\frac{}{}" into MathLive placeholders so the student can fill the blanks.
const toMathfieldTemplate = (latex) => {
  let t = latex
    .replace(/\|\s+\|/g, '|#?|')                              // |A|
    .replace(/\\\{\s*\\\}/g, '\\{#?\\}')                       // { }
    .replace(/\\mid\s+\\\}/g, '\\mid #?\\}')                     // {x | …}
    .replace(/(\\l[a-z]+)\s+(\\r[a-z]+)/g, '$1 #? $2')               // ⌊ ⌋  ⌈ ⌉  ⟨ ⟩
    .replace(/\{\s*\}/g, '{#?}').replace(/\(\s*,\s*\)/g, '(#?, #?)').replace(/\(\s*\)/g, '(#?)');
  if (/^[\^_]/.test(t)) t = `#?${t}`;
  return t;
};

// Typed shortcuts that become symbols (outside $...$ math and `code`). Longest first.
// "≤>" catches "<=>" because "<=" has already become "≤" when ">" is typed.
const SHORTCUTS = [['<->', '↔'], ['≤>', '⇔'], ['->', '→'], ['=>', '⇒'], ['<=', '≤'], ['>=', '≥'], ['!=', '≠']];

const BASIC_SYMBOLS = SYMBOLS.filter((s) => s.group === 'Basic');
// Shown in "Frequent" until the student has their own history.
const EVERYDAY_IDS = ['eq', 'leq', 'geq', 'neq', 'Implies', 'implies', 'iff', 'in'];

// Is position `pos` of `text` inside $...$ / $$...$$ math?
const inMathAt = (text, pos) => {
  const before = text.slice(0, pos);
  if ((before.match(/\$\$/g) || []).length % 2 === 1) return true;
  return (before.replace(/\$\$/g, '').match(/\$/g) || []).length % 2 === 1;
};

// Inference-rule templates (CMPSC 461 type systems / proofs). Shown in the More panel
// ("Proof rules") and in the Formula box.
const INFERENCE_TEMPLATES = [
  // Type 1: Simple inference rule
  { 
    label: 'Simple Rule', 
    insert: '$$\\dfrac{\\text{premise}}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{RULE-NAME})$$', 
    title: 'Simple inference rule with premise ⊢ conclusion',
    isBlock: true,
    needsMath: false
  },
  
  // Type 2: Inference with 2 premises (side by side)
  { 
    label: '2 Premises', 
    insert: '$$\\dfrac{\\Gamma \\vdash \\text{premise}_1 \\quad \\Gamma \\vdash \\text{premise}_2}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{RULE})$$', 
    title: 'Inference with 2 premises side by side',
    isBlock: true,
    needsMath: false
  },
  
  // Type 3: Double nested (2 levels)
  { 
    label: 'Double Nested', 
    insert: '$$\\dfrac{\\dfrac{\\Gamma \\vdash \\text{premise}_1}{\\Gamma \\vdash \\text{premise}_2} \\quad (\\text{SUB-RULE}) \\quad \\Gamma \\vdash \\text{premise}_3}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{MAIN-RULE})$$', 
    title: 'Double nested inference (2 levels deep) with rule labels',
    isBlock: true,
    needsMath: false
  },
  
  // Type 4: Triple nested (3 levels)
  { 
    label: 'Triple Nested', 
    insert: '$$\\dfrac{\\dfrac{\\dfrac{\\Gamma \\vdash \\text{premise}_1}{\\Gamma \\vdash \\text{premise}_2} \\quad (\\text{L2-RULE}) \\quad \\Gamma \\vdash \\text{premise}_3}{\\Gamma \\vdash \\text{premise}_4} \\quad (\\text{L1-RULE}) \\quad \\Gamma \\vdash \\text{premise}_5}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{MAIN-RULE})$$', 
    title: 'Triple nested inference (3 levels deep) with rule labels at each level',
    isBlock: true,
    needsMath: false
  },
  
  // Type 5: Quad nested (4 levels)
  { 
    label: '4-Level Nested', 
    insert: '$$\\dfrac{\\dfrac{\\dfrac{\\dfrac{\\Gamma \\vdash \\text{premise}_1}{\\Gamma \\vdash \\text{premise}_2} \\quad (\\text{L3-RULE})}{\\Gamma \\vdash \\text{premise}_3} \\quad (\\text{L2-RULE})}{\\Gamma \\vdash \\text{premise}_4} \\quad (\\text{L1-RULE})}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{MAIN-RULE})$$', 
    title: 'Four levels of nested inference with rule labels at each level',
    isBlock: true,
    needsMath: false
  },
  
  // Type 6: Five nested (5 levels)
  { 
    label: '5-Level Nested', 
    insert: '$$\\dfrac{\\dfrac{\\dfrac{\\dfrac{\\dfrac{\\Gamma \\vdash \\text{premise}_1}{\\Gamma \\vdash \\text{premise}_2} \\quad (\\text{L4-RULE})}{\\Gamma \\vdash \\text{premise}_3} \\quad (\\text{L3-RULE})}{\\Gamma \\vdash \\text{premise}_4} \\quad (\\text{L2-RULE})}{\\Gamma \\vdash \\text{premise}_5} \\quad (\\text{L1-RULE})}{\\Gamma \\vdash \\text{conclusion}} \\quad (\\text{MAIN-RULE})$$', 
    title: 'Five levels of nested inference with rule labels at each level',
    isBlock: true,
    needsMath: false
  },
];

// The templates as palette keys, so they can sit in the More panel like symbols.
const RULE_KEYS = INFERENCE_TEMPLATES.map((t, i) => ({
  id: `rule-${i}`, label: t.label, latex: t.insert, name: t.title, group: 'Proof rules', template: t,
}));
// Courses where proof rules belong at the top of the panel.
const PROOF_SYMBOL_IDS = new Set(['vdash', 'judgment', 'Gamma', 'hoare', 'vdashstar', 'models', 'arrowtype']);

export default function LatexEditor({ value, onChange, onSubmit, onKeyDown, onPaste, placeholder, suggestedSymbols, questionSymbols, tutorText, onSwitchToSimple }) {
  // Symbols for this assignment. Empty in normal chats, so no row is shown there.
  const qSyms = questionSymbols || [];
  const aSyms = suggestedSymbols || [];
  const [usageTick, setUsageTick] = useState(0);
  const [autoConvert, setAutoConvertState] = useState(getAutoConvert);
  // Symbols in the tutor's latest reply (the current tutoring step).
  const tSyms = useMemo(() => symbolsInText(tutorText || ''), [tutorText]);
  // Quick row: this question → tutor's current step → the student's frequent picks → the homework →
  // common defaults. Recomputed per question / tutor reply (not on every click), so keys don't jump.
  const paletteSymbols = useMemo(
    () => rankQuickSymbols({ question: qSyms, tutor: tSyms, assignment: aSyms, fallback: symbolsFromIds(DEFAULT_SYMBOL_IDS), limit: 40, personal: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qSyms.map((s) => s.id).join(), tSyms.map((s) => s.id).join(), aSyms.map((s) => s.id).join()]
  );
  // "Frequent" row: what this student uses most (not already in Suggested), topped up with
  // everyday ones (= ≤ ≥ ⇒ …) until they have a history.
  const frequentRow = useMemo(() => {
    const shownIds = new Set(paletteSymbols.map((s) => s.id));
    const mine = frequentSymbols(10).filter((s) => !shownIds.has(s.id));
    const everyday = symbolsFromIds(EVERYDAY_IDS).filter((s) => !shownIds.has(s.id) && !mine.some((m) => m.id === s.id));
    return [...mine, ...everyday].slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteSymbols, usageTick]);

  // How many symbol keys fit in each row (wide screen ≈ 12–14, phone ≈ 4).
  const toolbarRef = useRef(null);
  const toolbarRightRef = useRef(null);
  const [freqMax, setFreqMax] = useState(4);
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return undefined;
    const fit = () => {
      const free = bar.clientWidth - (toolbarRightRef.current?.offsetWidth || 0) - 190;          // label + More
      setFreqMax(Math.max(2, Math.min(10, Math.floor(free / 38))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);
  // "More" panel opens small: these rows first, everything else behind "Browse all".
  const panelSections = useMemo(() => {
    const qIds = new Set(qSyms.map((s) => s.id));
    // One suggested row: this question's symbols first, then the rest of the homework.
    const suggested = [...qSyms, ...aSyms.filter((s) => !qIds.has(s.id))];
    const sugIds = new Set(suggested.map((s) => s.id));
    const rules = { name: 'Proof rules', symbols: RULE_KEYS };
    const proofCourse = [...suggested, ...tSyms].some((s) => PROOF_SYMBOL_IDS.has(s.id));
    return [
      { name: aSyms.length || qSyms.length ? 'Suggested for this homework' : 'Suggested', symbols: suggested },
      ...(proofCourse ? [rules] : []),          // CMPSC 461-style homework: rules near the top
      { name: 'Tutor is using', symbols: tSyms.filter((s) => !sugIds.has(s.id)) },
      { name: 'You use often', symbols: frequentSymbols(8).filter((s) => !sugIds.has(s.id)) },
      { name: 'Basic', symbols: BASIC_SYMBOLS },
      ...(proofCourse ? [] : [rules]),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qSyms.map((s) => s.id).join(), tSyms.map((s) => s.id).join(), aSyms.map((s) => s.id).join(), usageTick]);
  const preferredIds = useMemo(() => [...qSyms, ...aSyms].map((s) => s.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qSyms.map((s) => s.id).join(), aSyms.map((s) => s.id).join()]);
  const [acQuery, setAcQuery] = useState(null); // "\word" autocomplete; null = closed
  const [acIndex, setAcIndex] = useState(0);
  const lastAutoRef = useRef(null);             // last shortcut replacement, so Backspace can undo it
  const pendingCursorRef = useRef(null);        // where the cursor goes after our own text change

  // Put the cursor back right after React re-renders the text (before the next keystroke).
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (ta && pendingCursorRef.current != null) {
      ta.selectionStart = ta.selectionEnd = pendingCursorRef.current;
      pendingCursorRef.current = null;
    }
  }, [value]);
  const acMatches = acQuery ? searchSymbols(acQuery, preferredIds, 6) : [];
  const textareaRef = useRef(null);
  const mathRef = useRef(null);
  const composerRef = useRef(null);
  const pendingFormulaRef = useRef(null);
  const [showPad, setShowPad] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [history, setHistory] = useState([value || '']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoRef = useRef(false);
  const typingTimerRef = useRef(null);
  const lastSavedValueRef = useRef(value || '');

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);


  useEffect(() => {
    if (textareaRef.current && value) {
      const length = value.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(length, length);
    }
  }, []);

  // The answer box grows with the text (up to about 8 lines), like a chat composer.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  // A structured symbol was clicked: once the formula box is open, put its template in.
  useEffect(() => {
    if (showFormula && pendingFormulaRef.current && mathRef.current) {
      mathRef.current.insert(pendingFormulaRef.current);
      pendingFormulaRef.current = null;
    }
  }, [showFormula]);

  const noteSymbolUse = (sym) => {
    recordSymbolUse(sym.id);
    setUsageTick((n) => n + 1);
  };

  // Replace the typed "\word" with the chosen symbol.
  const pickAutocomplete = (sym) => {
    const ta = textareaRef.current;
    const text = value || '';
    const cursor = ta ? ta.selectionStart : text.length;
    const start = cursor - (acQuery.length + 1);
    const before = text.slice(0, start);
    const after = text.slice(cursor);
    setAcQuery(null);
    noteSymbolUse(sym);
    let insert;
    if (inMathAt(text, start)) insert = sym.latex;            // already in $...$: keep LaTeX
    else if (isPlainSymbol(sym)) insert = sym.label;          // plain character
    else {                                                    // structured: use the formula box
      onChange({ target: { value: before + after } });
      pendingFormulaRef.current = toMathfieldTemplate(sym.latex);
      setShowFormula(true);
      return;
    }
    const newValue = before + insert + after;
    pendingCursorRef.current = start + insert.length;
    onChange({ target: { value: newValue } });
    saveToHistory(newValue);
  };

  const handleSymbol = (sym) => {
    if (sym.template) {                          // proof-rule template: insert the whole rule
      const t = sym.template;
      insertAtCursor(t.insert, t.isBlock, t.needsMath, t.moveCursorBack);
      setShowFormula(false);
      return;
    }
    noteSymbolUse(sym);
    if (showFormula && mathRef.current) {        // formula box open: symbols go into it
      mathRef.current.insert(isPlainSymbol(sym) ? sym.latex : toMathfieldTemplate(sym.latex));
      return;
    }
    if (isPlainSymbol(sym)) {
      insertAtCursor(sym.label, false, false, 0);
    } else {
      pendingFormulaRef.current = toMathfieldTemplate(sym.latex);
      setShowFormula(true);
    }
  };

  const saveToHistory = (newValue) => {
    if (newValue !== lastSavedValueRef.current) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newValue);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      lastSavedValueRef.current = newValue;
    }
  };
  const handleInputChange = (e) => {
    let newValue = e.target.value;
    const cursor = e.target.selectionStart;
    const typedOne = newValue.length === (value || '').length + 1;
    lastAutoRef.current = null;

    // Typed shortcuts: "<=" → ≤, "->" → → … (not inside math or `code`).
    if (autoConvert && typedOne && !inMathAt(newValue, cursor) && ((newValue.slice(0, cursor).match(/`/g) || []).length % 2 === 0)) {
      const before = newValue.slice(0, cursor);
      const hit = SHORTCUTS.find(([pat]) => before.endsWith(pat));
      if (hit) {
        const [pat, sym] = hit;
        const replaced = before.slice(0, -pat.length) + sym + newValue.slice(cursor);
        const newCursor = cursor - pat.length + sym.length;
        lastAutoRef.current = { original: newValue, originalCursor: cursor, result: replaced, at: newCursor };
        newValue = replaced;
        e = { target: { value: replaced } };
        pendingCursorRef.current = newCursor;
      }
    }

    // "\word" autocomplete: \union, \subset, \forall …
    const m = newValue.slice(0, lastAutoRef.current ? lastAutoRef.current.at : cursor).match(/\\([a-zA-Z]{2,20})$/);
    setAcQuery(m ? m[1] : null);
    setAcIndex(0);
    
    // Don't save to history during undo/redo
    if (!isUndoRedoRef.current) {
      // Clear existing timer
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      
      // Check if user pressed space
      const lastChar = newValue[newValue.length - 1];
      if (lastChar === ' ' || lastChar === '\n') {
        saveToHistory(newValue);
      } else {
        // Save after 500ms of no typing
        typingTimerRef.current = setTimeout(() => {
          saveToHistory(newValue);
        }, 500);
      }
    }
    isUndoRedoRef.current = false;
    
    onChange(e);
  };

  // ✅ ADD: Undo function
const handleUndo = () => {
   if (historyIndex > 0) {
    isUndoRedoRef.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    onChange({ target: { value: history[newIndex] } });
    lastSavedValueRef.current = history[newIndex];
  }
};

// ✅ ADD: Redo function
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange({ target: { value: history[newIndex] } });
      lastSavedValueRef.current = history[newIndex];
    }
  };

  // The old "Quick Insert" symbols (λ, →, ⊢, ∧ …) are all in the full symbol library now.

 const inferenceTemplates = INFERENCE_TEMPLATES;



const insertAtCursor = (text, isBlock = false, needsMath = false, moveCursorBack = 0) => {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = value || '';
  
  let newValue;
  let newCursorPos;
  
  // ✅ UPDATED: Auto-detect math mode for ALL insertions (including blocks)
  const beforeCursor = currentValue.substring(0, start);
  const afterCursor = currentValue.substring(start);
  
  // Count $$ pairs before cursor
  const doubleDollarsBeforeCursor = (beforeCursor.match(/\$\$/g) || []).length;
  
  // Count single $ (but not $$) before cursor
  const beforeWithoutDouble = beforeCursor.replace(/\$\$/g, '');
  const singleDollarsBeforeCursor = (beforeWithoutDouble.match(/\$/g) || []).length;
  
  // Check if we're inside $$...$$ block (display math)
  const inDisplayMath = doubleDollarsBeforeCursor % 2 === 1;
  
  // Check if we're inside $...$ block (inline math)
  const inInlineMath = !inDisplayMath && (singleDollarsBeforeCursor % 2 === 1);
  
  const inAnyMathMode = inDisplayMath || inInlineMath;
  
  let textToInsert = text;
  
  // ✅ NEW: Handle block templates
  if (isBlock) {
    // Strip $$ from block templates if we're already in math mode
    if (inAnyMathMode && text.startsWith('$$') && text.endsWith('$$')) {
      // Remove outer $$...$$ wrapper
      textToInsert = text.slice(2, -2);
      // Insert inline without newlines
      newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
      newCursorPos = start + textToInsert.length;
    } else {
      // Normal block insertion with newlines
      newValue = currentValue.substring(0, start) + '\n' + textToInsert + '\n' + currentValue.substring(end);
      newCursorPos = start + textToInsert.length + 1;
    }
  } else {
    // ✅ Handle inline symbols
    // Cursor right after a closing "$" (e.g. "$x^2$|"): add the symbol inside that
    // same math block instead of starting a new one, which would create "$$"
    // (display-math syntax) and break the preview.
    const justAfterMath = needsMath && !inAnyMathMode && start === end &&
      /\$$/.test(beforeCursor) && !/\$\$$/.test(beforeCursor);
    if (justAfterMath) {
      textToInsert = ` ${text}`;
      newValue = beforeCursor.slice(0, -1) + textToInsert + '$' + currentValue.substring(end);
      newCursorPos = start - 1 + textToInsert.length - moveCursorBack;
    } else {
      if (needsMath && !inAnyMathMode) {
        textToInsert = `$${text}$ `;
        // Keep a space before an opening "$" (never glue it to a word or another math block).
        if (/\S$/.test(beforeCursor)) textToInsert = ` ${textToInsert}`;
      }
      newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
      // If we wrapped the text in "$...$ ", step back over those 2 extra characters too.
      const wrapExtra = (moveCursorBack > 0 && textToInsert !== text) ? 2 : 0;
      newCursorPos = start + textToInsert.length - moveCursorBack - wrapExtra;
    }
  }
  
  onChange({ target: { value: newValue } });
  
  // Save to history after template insertion
  saveToHistory(newValue);
  
  // Restore cursor position
  setTimeout(() => {
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = newCursorPos;
  }, 0);
};

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Autocomplete list open: arrows choose, Enter/Tab insert, Esc closes (Enter must not send).
    if (acQuery && acMatches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex((i) => (i + 1) % acMatches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex((i) => (i - 1 + acMatches.length) % acMatches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickAutocomplete(acMatches[acIndex] || acMatches[0]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setAcQuery(null); return; }
    }
    // Backspace right after a shortcut turned "<=" into ≤: give back "<=".
    const auto = lastAutoRef.current;
    if (e.key === 'Backspace' && auto && value === auto.result && e.target.selectionStart === auto.at && e.target.selectionEnd === auto.at) {
      e.preventDefault();
      lastAutoRef.current = null;
      pendingCursorRef.current = auto.originalCursor;
      onChange({ target: { value: auto.original } });
      return;
    }

    // Call external onKeyDown handler for telemetry tracking
    if (onKeyDown) {
      onKeyDown(e);
    }
    
  // ✅ ADD: Ctrl+Z for undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }
    
    // ✅ ADD: Ctrl+Shift+Z or Ctrl+Y for redo
    if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      handleRedo();
      return;
    }
    
    if (e.key === 'Enter' && e.ctrlKey && !e.defaultPrevented) {
      e.preventDefault();
      onSubmit?.();
    }
    
    // Track cursor position
    setCursorPosition(e.target.selectionStart);
  };

  // Handle paste events for telemetry
  const handlePaste = (e) => {
    if (onPaste) {
      onPaste(e);
    }
  };

  // Preprocess LaTeX for rendering
  const preprocessLatex = (text) => {
    if (!text) return text;
    
    return text
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');
  };

  const hasRenderedContent = /\$|!\[|\\\(|\\\[/.test(value || '');

  const canSend = !!(value && value.trim());

  return (
    <div className="latex-editor composer" ref={composerRef}>
      {showPad && (
        <WritingPad
          onClose={() => setShowPad(false)}
          onInsert={(text) => { insertAtCursor(text, true, false, 0); setShowPad(false); }}
        />
      )}

      {/* One answer box: write sentences, symbols go in at the cursor */}
      <textarea
        ref={textareaRef}
        value={value}
        rows={2}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder || 'Write your answer… (Enter to send, Shift+Enter for a new line)'}
        className="latex-input composer-input"
      />

      {acQuery && acMatches.length > 0 && (
        <ul className="composer-autocomplete" role="listbox" aria-label="Matching symbols">
          {acMatches.map((sym, i) => (
            <li key={sym.id} role="option" aria-selected={i === acIndex}
              className={i === acIndex ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pickAutocomplete(sym); }}
              onMouseMove={() => { if (acIndex !== i) setAcIndex(i); }}>
              <span className="composer-ac-label">{sym.label}</span>
              <span className="composer-ac-name">{sym.name}</span>
              {preferredIds.includes(sym.id) && <span className="composer-ac-tag">this homework</span>}
            </li>
          ))}
          <li className="composer-ac-hint" aria-hidden="true">↑↓ choose · Enter or Tab insert · Esc close</li>
        </ul>
      )}

      {/* Formula box: only for things plain characters can't show (fractions, sums, subscripts …) */}
      {showFormula && (
        <div className="composer-formula">
          <MathInput
            ref={mathRef}
            onInsert={(latex) => { insertAtCursor(latex, false, true, 0); setShowFormula(false); }}
            onCancel={() => { setShowFormula(false); textareaRef.current?.focus(); }}
          />
          <div className="composer-rules">
            <button type="button" className="composer-rules-toggle" onClick={() => setShowRules(!showRules)}
              aria-expanded={showRules} title="Inference-rule templates (CMPSC 461)">
              Proof rules {showRules ? '▴' : '▾'}
            </button>
            {showRules && (
              <div className="composer-rules-menu">
                {inferenceTemplates.map((btn, idx) => (
                  <button key={`inf-${idx}`} type="button" title={btn.title}
                    onClick={() => {
                      insertAtCursor(btn.insert, btn.isBlock, btn.needsMath, btn.moveCursorBack);
                      setShowRules(false); setShowFormula(false);
                    }}>
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="composer-formula-close" onClick={() => setShowFormula(false)}
            aria-label="Close formula box" title="Close (Esc)">✕</button>
          <div className="composer-hint">
            Type math as it looks: <b>x^2</b>, <b>a/b</b> for a fraction, <b>\sum</b>. <b>Enter</b> puts it in your answer.
          </div>
        </div>
      )}

      {/* Row 1: Suggested (this question → tutor's step → homework), as wide as the box */}
      <div className="composer-toolbar" ref={toolbarRef}>
        <SymbolPalette
          compact
          scroll
          showMore={false}
          label="Suggested"
          symbols={paletteSymbols}
          onInsert={handleSymbol}
        />
      </div>

      {/* Row 2: Frequent (the student's own) · More · Formula | draw · attach · send */}
      <div className="composer-toolbar composer-row2">
        <div className="composer-toolbar-left">
          <SymbolPalette
            compact
            plain
            max={freqMax}
            label="Frequent"
            anchorRef={composerRef}
            sections={panelSections}
            footer={(
              <label className="symbol-palette-setting">
                <input type="checkbox" checked={autoConvert}
                  onChange={(e) => { setAutoConvert(e.target.checked); setAutoConvertState(e.target.checked); }} />
                Typing shortcuts: <code>&lt;=</code> → ≤ &nbsp;<code>-&gt;</code> → → &nbsp;<code>!=</code> → ≠
                <span className="symbol-palette-setting-note">Backspace undoes one · type <code>\union</code>, <code>\forall</code> … to search</span>
                {onSwitchToSimple && (
                  <button type="button" className="symbol-palette-plain" onClick={onSwitchToSimple}>Use plain text box</button>
                )}
              </label>
            )}
            symbols={frequentRow}
            onInsert={handleSymbol}
          />
        </div>
        <div className="composer-toolbar-right" ref={toolbarRightRef}>
          <button type="button" className={`composer-chip composer-formula-btn ${showFormula ? 'active' : ''}`}
            onClick={() => setShowFormula(!showFormula)} aria-label="Formula"
            title="Formula: fractions, sums, subscripts, proof rules">
            <i>ƒ</i> Formula
          </button>
          <button type="button" className={`composer-icon ${showPad ? 'active' : ''}`} onClick={() => setShowPad(true)}
            title="Draw trees, graphs or math by hand" aria-label="Draw">✎</button>
          <FileUploadButton compact onInsert={(text) => insertAtCursor(text, true, false, 0)} />
          <button type="button" className="composer-send" onClick={() => onSubmit?.()} disabled={!canSend}
            title="Send (Enter)" aria-label="Send">➤</button>
        </div>
      </div>

      {hasRenderedContent && (
        <div className="composer-preview">
          <span className="composer-preview-label">Looks like</span>
          <div className="latex-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeMathjax]}
              components={{ img: MarkdownImage }}
            >
              {preprocessLatex(value)}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
