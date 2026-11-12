// Remembers which symbols this student uses (in this browser only), so the symbol row
// can learn: a symbol picked from "More" a few times moves into the quick row.
import { SYMBOLS, SYMBOL_BY_ID } from './symbols';

const KEY = 'alaaska.symbolUsage.v1';

function load() {
  try {
    const data = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch (e) {
    return {};
  }
}

// Record one use of a symbol: { id: { n: count, t: last used time } }.
export function recordSymbolUse(id) {
  if (!SYMBOL_BY_ID[id]) return;
  const data = load();
  const entry = data[id] || { n: 0, t: 0 };
  data[id] = { n: entry.n + 1, t: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    // storage full or blocked (private window): just don't remember
  }
}

// Symbols this student uses most, recent use breaking ties.
export function frequentSymbols(limit = 6, minUses = 1) {
  const data = load();
  return Object.entries(data)
    .filter(([, v]) => v.n >= minUses)
    .sort((a, b) => (b[1].n - a[1].n) || (b[1].t - a[1].t))
    .map(([id]) => SYMBOL_BY_ID[id])
    .filter(Boolean)
    .slice(0, limit);
}

// Symbols that appear in a piece of text (e.g. the tutor's latest reply), most frequent first.
// Matches the character (∪) or the LaTeX command (\cup) of single-command symbols.
export function symbolsInText(text, limit = 6) {
  if (!text) return [];
  const scores = [];
  for (const sym of SYMBOLS) {
    let n = 0;
    const cmd = sym.latex.match(/^\\([a-zA-Z]+)$/);
    if (cmd) n += (text.match(new RegExp(`\\\\${cmd[1]}(?![a-zA-Z])`, 'g')) || []).length;
    if (sym.label.length <= 2 && !/[A-Za-z0-9=+<>\-]/.test(sym.label)) n += text.split(sym.label).length - 1;
    if (n) scores.push([sym, n]);
  }
  return scores.sort((a, b) => b[1] - a[1]).map(([sym]) => sym).slice(0, limit);
}

// Typed-shortcut setting (<= → ≤ …). On unless the student turned it off.
const AUTO_KEY = 'alaaska.autoConvert.v1';
export function getAutoConvert() {
  try { return window.localStorage.getItem(AUTO_KEY) !== 'off'; } catch (e) { return true; }
}
export function setAutoConvert(on) {
  try { window.localStorage.setItem(AUTO_KEY, on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
}

// The quick row: this question first, then symbols in the tutor's latest reply, then the
// student's own favourites, then the rest of the homework, then common defaults.
// No duplicates, at most `limit`.
export function rankQuickSymbols({ question = [], tutor = [], assignment = [], fallback = [], limit = 7, personal = true }) {
  const out = [];
  const seen = new Set();
  const add = (list, max) => {
    let added = 0;
    for (const s of list) {
      if (out.length >= limit || added >= max) break;
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
      added += 1;
    }
  };
  add(question, Math.max(6, limit));
  add(tutor, 3);                  // what the tutor's current step is about
  if (personal) add(frequentSymbols(6, 2), 4);  // used at least twice
  add(assignment, limit);
  add(fallback, limit);
  return out;
}
