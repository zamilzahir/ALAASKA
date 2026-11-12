import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MathfieldElement } from 'mathlive';

// MathLive draws math with its own fonts. Load them from the CDN (same version as package.json),
// because Create React App doesn't copy them from node_modules. Sounds are turned off.
const MATHLIVE_VERSION = '0.109.2';
MathfieldElement.fontsDirectory = `https://cdn.jsdelivr.net/npm/mathlive@${MATHLIVE_VERSION}/fonts/`;
MathfieldElement.soundsDirectory = null;

// Visual math box: students type math and see it formatted (x^2 shows as x², \in as ∈).
// It still produces LaTeX behind the scenes, which goes into the answer as $...$.
// Props:
//   onInsert(latex) - called with the LaTeX when the student presses Enter or "Insert"
//   onCancel()      - optional, called on Esc
// Ref methods: insert(latex) adds a symbol at the cursor; focus().
const MathInput = forwardRef(function MathInput({ onInsert, onCancel }, ref) {
  const fieldRef = useRef(null);

  const commit = () => {
    const mf = fieldRef.current;
    const latex = (mf?.value || '').trim();
    if (!latex) return;
    onInsert(latex);
    mf.value = '';
    mf.focus();
  };

  useImperativeHandle(ref, () => ({
    insert(latex) {
      const mf = fieldRef.current;
      if (!mf) return;
      mf.focus();
      mf.executeCommand(['insert', latex, { focus: true, selectionMode: 'placeholder' }]);
    },
    focus() { fieldRef.current?.focus(); },
  }));

  useEffect(() => {
    const mf = fieldRef.current;
    if (!mf) return undefined;
    mf.mathVirtualKeyboardPolicy = 'manual'; // don't pop up MathLive's on-screen keyboard
    mf.smartFence = true;
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };
    mf.addEventListener('keydown', onKey);
    mf.focus();
    return () => mf.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="math-input">
      <math-field ref={fieldRef} class="math-input-field" aria-label="Math input" />
      <button type="button" className="math-input-insert" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
        Insert ↵
      </button>
    </div>
  );
});

export default MathInput;
