// ALAASKA symbol library: the single source of truth for the symbol palette.
// Each symbol: id (unique), label (what the key shows), latex (what it inserts),
// name (for search and tooltips), group (category), back (optional: move the
// cursor back N characters after inserting, e.g. to land inside braces).

export const SYMBOLS = [
  // Logic
  { id: 'and', label: '∧', latex: '\\land', name: 'and', group: 'Logic' },
  { id: 'or', label: '∨', latex: '\\lor', name: 'or', group: 'Logic' },
  { id: 'not', label: '¬', latex: '\\neg', name: 'not', group: 'Logic' },
  { id: 'implies', label: '→', latex: '\\rightarrow', name: 'implies / arrow', group: 'Logic' },
  { id: 'iff', label: '↔', latex: '\\leftrightarrow', name: 'if and only if', group: 'Logic' },
  { id: 'Implies', label: '⇒', latex: '\\Rightarrow', name: 'implies (double arrow)', group: 'Logic' },
  { id: 'Iff', label: '⇔', latex: '\\Leftrightarrow', name: 'equivalent (double arrow)', group: 'Logic' },
  { id: 'xor', label: '⊕', latex: '\\oplus', name: 'xor / circled plus', group: 'Logic' },
  { id: 'forall', label: '∀', latex: '\\forall', name: 'for all', group: 'Logic' },
  { id: 'exists', label: '∃', latex: '\\exists', name: 'there exists', group: 'Logic' },
  { id: 'nexists', label: '∄', latex: '\\nexists', name: 'there does not exist', group: 'Logic' },
  { id: 'therefore', label: '∴', latex: '\\therefore', name: 'therefore', group: 'Logic' },
  { id: 'top', label: '⊤', latex: '\\top', name: 'true / top', group: 'Logic' },
  { id: 'bot', label: '⊥', latex: '\\bot', name: 'false / bottom', group: 'Logic' },

  // Sets
  { id: 'in', label: '∈', latex: '\\in', name: 'element of', group: 'Sets' },
  { id: 'notin', label: '∉', latex: '\\notin', name: 'not an element of', group: 'Sets' },
  { id: 'subseteq', label: '⊆', latex: '\\subseteq', name: 'subset or equal', group: 'Sets' },
  { id: 'subset', label: '⊂', latex: '\\subset', name: 'proper subset', group: 'Sets' },
  { id: 'supseteq', label: '⊇', latex: '\\supseteq', name: 'superset or equal', group: 'Sets' },
  { id: 'cup', label: '∪', latex: '\\cup', name: 'union', group: 'Sets' },
  { id: 'cap', label: '∩', latex: '\\cap', name: 'intersection', group: 'Sets' },
  { id: 'setminus', label: '∖', latex: '\\setminus', name: 'set difference', group: 'Sets' },
  { id: 'emptyset', label: '∅', latex: '\\emptyset', name: 'empty set', group: 'Sets' },
  { id: 'times', label: '×', latex: '\\times', name: 'cartesian product / times', group: 'Sets' },
  { id: 'powerset', label: '𝒫(A)', latex: '\\mathcal{P}()', name: 'power set', group: 'Sets', back: 1 },
  { id: 'card', label: '|A|', latex: '| |', name: 'cardinality / absolute value', group: 'Sets', back: 1 },
  { id: 'setbuilder', label: '{x | …}', latex: '\\{ x \\mid  \\}', name: 'set builder', group: 'Sets', back: 3 },
  { id: 'braces', label: '{ }', latex: '\\{ \\}', name: 'set braces', group: 'Sets', back: 3 },
  { id: 'complement', label: 'Aᶜ', latex: '^{c}', name: 'complement', group: 'Sets' },

  // Number sets
  { id: 'nat', label: 'ℕ', latex: '\\mathbb{N}', name: 'natural numbers', group: 'Number sets' },
  { id: 'int', label: 'ℤ', latex: '\\mathbb{Z}', name: 'integers', group: 'Number sets' },
  { id: 'intn', label: 'ℤₙ', latex: '\\mathbb{Z}_{n}', name: 'integers mod n', group: 'Number sets' },
  { id: 'rat', label: 'ℚ', latex: '\\mathbb{Q}', name: 'rationals', group: 'Number sets' },
  { id: 'real', label: 'ℝ', latex: '\\mathbb{R}', name: 'reals', group: 'Number sets' },

  // Relations
  { id: 'neq', label: '≠', latex: '\\neq', name: 'not equal', group: 'Relations' },
  { id: 'leq', label: '≤', latex: '\\leq', name: 'less than or equal', group: 'Relations' },
  { id: 'geq', label: '≥', latex: '\\geq', name: 'greater than or equal', group: 'Relations' },
  { id: 'approx', label: '≈', latex: '\\approx', name: 'approximately', group: 'Relations' },
  { id: 'equiv', label: '≡', latex: '\\equiv', name: 'congruent / equivalent', group: 'Relations' },
  { id: 'sim', label: '∼', latex: '\\sim', name: 'similar / related', group: 'Relations' },

  // Number theory
  { id: 'divides', label: '∣', latex: '\\mid', name: 'divides', group: 'Number theory' },
  { id: 'ndivides', label: '∤', latex: '\\nmid', name: 'does not divide', group: 'Number theory' },
  { id: 'pmod', label: '(mod n)', latex: '\\pmod{n}', name: 'mod', group: 'Number theory' },
  { id: 'gcd', label: 'gcd', latex: '\\gcd(, )', name: 'greatest common divisor', group: 'Number theory', back: 3 },
  { id: 'lcm', label: 'lcm', latex: '\\operatorname{lcm}(, )', name: 'least common multiple', group: 'Number theory', back: 3 },
  { id: 'otimes', label: '⊗', latex: '\\otimes', name: 'modular multiplication', group: 'Number theory' },
  { id: 'oslash', label: '⊘', latex: '\\oslash', name: 'modular division', group: 'Number theory' },
  { id: 'base', label: 'xᵦ', latex: '_{b}', name: 'base subscript', group: 'Number theory' },

  // Arithmetic and structure
  { id: 'pow', label: 'xⁿ', latex: '^{}', name: 'superscript / power', group: 'Arithmetic', back: 1 },
  { id: 'sub', label: 'xₙ', latex: '_{}', name: 'subscript', group: 'Arithmetic', back: 1 },
  { id: 'frac', label: 'a⁄b', latex: '\\frac{}{}', name: 'fraction', group: 'Arithmetic', back: 3 },
  { id: 'sqrt', label: '√', latex: '\\sqrt{}', name: 'square root', group: 'Arithmetic', back: 1 },
  { id: 'pm', label: '±', latex: '\\pm', name: 'plus minus', group: 'Arithmetic' },
  { id: 'cdot', label: '·', latex: '\\cdot', name: 'dot / multiply', group: 'Arithmetic' },
  { id: 'sum', label: '∑', latex: '\\sum_{i=1}^{n}', name: 'sum', group: 'Arithmetic' },
  { id: 'prod', label: '∏', latex: '\\prod_{i=1}^{n}', name: 'product', group: 'Arithmetic' },
  { id: 'infty', label: '∞', latex: '\\infty', name: 'infinity', group: 'Arithmetic' },
  { id: 'fact', label: 'n!', latex: 'n!', name: 'factorial', group: 'Arithmetic' },
  { id: 'binom', label: '(n k)', latex: '\\binom{n}{k}', name: 'binomial / choose', group: 'Arithmetic' },
  { id: 'floor', label: '⌊ ⌋', latex: '\\lfloor  \\rfloor', name: 'floor', group: 'Arithmetic', back: 8 },
  { id: 'ceil', label: '⌈ ⌉', latex: '\\lceil  \\rceil', name: 'ceiling', group: 'Arithmetic', back: 7 },

  // Asymptotics (CMPSC 465)
  { id: 'bigo', label: 'O', latex: 'O()', name: 'big O', group: 'Asymptotics', back: 1 },
  { id: 'theta', label: 'Θ', latex: '\\Theta()', name: 'big Theta', group: 'Asymptotics', back: 1 },
  { id: 'omega', label: 'Ω', latex: '\\Omega()', name: 'big Omega', group: 'Asymptotics', back: 1 },
  { id: 'log', label: 'log', latex: '\\log', name: 'logarithm', group: 'Asymptotics' },
  { id: 'recur', label: 'T(n)', latex: 'T(n) = ', name: 'recurrence', group: 'Asymptotics' },

  // Automata and languages (CMPSC 461)
  { id: 'epsilon', label: 'ε', latex: '\\varepsilon', name: 'empty string', group: 'Automata' },
  { id: 'Sigma', label: 'Σ', latex: '\\Sigma', name: 'alphabet', group: 'Automata' },
  { id: 'sigmastar', label: 'Σ*', latex: '\\Sigma^*', name: 'all strings', group: 'Automata' },
  { id: 'delta', label: 'δ', latex: '\\delta', name: 'transition function', group: 'Automata' },
  { id: 'q0', label: 'q₀', latex: 'q_0', name: 'start state', group: 'Automata' },
  { id: 'kleene', label: 'a*', latex: '^*', name: 'Kleene star', group: 'Automata' },
  { id: 'vdash', label: '⊢', latex: '\\vdash', name: 'turnstile / derives', group: 'Automata' },
  { id: 'lambda', label: 'λ', latex: '\\lambda', name: 'lambda', group: 'Automata' },
  { id: 'Gamma', label: 'Γ', latex: '\\Gamma', name: 'Gamma (context)', group: 'Automata' },

  // Greek
  { id: 'alpha', label: 'α', latex: '\\alpha', name: 'alpha', group: 'Greek' },
  { id: 'beta', label: 'β', latex: '\\beta', name: 'beta', group: 'Greek' },
  { id: 'gamma', label: 'γ', latex: '\\gamma', name: 'gamma', group: 'Greek' },
  { id: 'thetaL', label: 'θ', latex: '\\theta', name: 'theta', group: 'Greek' },
  { id: 'pi', label: 'π', latex: '\\pi', name: 'pi', group: 'Greek' },
  { id: 'sigma', label: 'σ', latex: '\\sigma', name: 'sigma', group: 'Greek' },
  { id: 'phi', label: 'φ', latex: '\\varphi', name: 'phi', group: 'Greek' },
];

// Quick lookup by id.
export const SYMBOL_BY_ID = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));

// Presets: one click fills the professor's picker. They're just lists of ids.
export const PRESETS = {
  'Discrete Math (CMPSC 360)': [
    'forall', 'exists', 'not', 'and', 'or', 'implies', 'iff',
    'in', 'notin', 'subseteq', 'cup', 'cap', 'emptyset', 'times', 'powerset', 'card',
    'nat', 'int', 'intn', 'equiv', 'divides', 'pmod', 'sum',
  ],
  'Automata (CMPSC 461)': [
    'epsilon', 'Sigma', 'sigmastar', 'delta', 'q0', 'kleene', 'emptyset', 'in', 'cup', 'vdash',
  ],
  'Algorithms (CMPSC 465)': [
    'bigo', 'theta', 'omega', 'log', 'recur', 'floor', 'ceil', 'sum', 'infty', 'leq', 'geq', 'pow', 'sub',
  ],
};

// Turn a list of ids into symbol objects, skipping unknown ids.
export function symbolsFromIds(ids = []) {
  return ids.map((id) => SYMBOL_BY_ID[id]).filter(Boolean);
}
