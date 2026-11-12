"""
Suggest palette symbols from assignment text (homework / solution PDFs or typed questions).

The ids here MUST match the ids in frontend/src/symbols.js. Each rule lists:
  chars    - Unicode characters that indicate the symbol
  latex    - LaTeX commands that indicate the symbol
  keywords - case-insensitive regexes for words or patterns in the text
"""
import base64
import logging
import re
from typing import Dict, List

logger = logging.getLogger(__name__)

RULES: Dict[str, dict] = {
    # Logic
    "and":       {"chars": "∧", "latex": [r"\land", r"\wedge"], "keywords": [r"\bconjunction\b"]},
    "or":        {"chars": "∨", "latex": [r"\lor", r"\vee"], "keywords": [r"\bdisjunction\b"]},
    "not":       {"chars": "¬", "latex": [r"\neg", r"\lnot"], "keywords": [r"\bnegation\b"]},
    "implies":   {"chars": "→", "latex": [r"\rightarrow", r"\to"], "keywords": [r"\bimplication\b", r"\bconditional\b"]},
    "iff":       {"chars": "↔", "latex": [r"\leftrightarrow"], "keywords": [r"\bbiconditional\b", r"\bif and only if\b"]},
    "Implies":   {"chars": "⇒", "latex": [r"\Rightarrow", r"\implies"], "keywords": []},
    "Iff":       {"chars": "⇔", "latex": [r"\Leftrightarrow", r"\iff"], "keywords": [r"\blogically equivalent\b"]},
    "xor":       {"chars": "⊕", "latex": [r"\oplus"], "keywords": [r"\bexclusive or\b", r"\bxor\b"]},
    "forall":    {"chars": "∀", "latex": [r"\forall"], "keywords": [r"\bfor all (integers?|reals?|real numbers|natural|elements?|n\b|[a-z]\b)", r"\bfor every (integer|element|x\b|n\b)", r"\buniversal(ly)? quantif"]},
    "exists":    {"chars": "∃", "latex": [r"\exists"], "keywords": [r"\bthere exists?\b", r"\bexistential(ly)? quantif"]},
    "therefore": {"chars": "∴", "latex": [r"\therefore"], "keywords": []},
    # Sets
    "in":        {"chars": "∈", "latex": [r"\in "], "keywords": [r"\belement of\b", r"\bset[- ]builder\b"]},
    "notin":     {"chars": "∉", "latex": [r"\notin"], "keywords": []},
    "subseteq":  {"chars": "⊆", "latex": [r"\subseteq"], "keywords": [r"\bsubsets?\b"]},
    "subset":    {"chars": "⊂", "latex": [r"\subset "], "keywords": [r"\bproper subset\b"]},
    "supseteq":  {"chars": "⊇", "latex": [r"\supseteq"], "keywords": [r"\bsuperset\b"]},
    "cup":       {"chars": "∪", "latex": [r"\cup"], "keywords": [r"\bunion\b"]},
    "cap":       {"chars": "∩", "latex": [r"\cap"], "keywords": [r"\bintersection\b"]},
    "setminus":  {"chars": "∖", "latex": [r"\setminus"], "keywords": [r"\bset difference\b"]},
    "emptyset":  {"chars": "∅", "latex": [r"\emptyset", r"\varnothing"], "keywords": [r"\bempty set\b", r"0/"]},
    "times":     {"chars": "×", "latex": [r"\times"], "keywords": [r"\bcartesian product\b", r"\bordered pairs?\b"]},
    "powerset":  {"chars": "℘𝒫", "latex": [r"\mathcal{P}", r"\wp"], "keywords": [r"\bpower ?sets?\b"]},
    "card":      {"chars": "", "latex": [], "keywords": [r"\bcardinality\b", r"\|[A-Za-z]\|"]},
    "setbuilder": {"chars": "", "latex": [r"\mid"], "keywords": [r"\bset[- ]builder\b"]},
    "braces":    {"chars": "", "latex": [r"\{"], "keywords": [r"\broster\b"]},
    "complement": {"chars": "", "latex": [r"\overline"], "keywords": [r"\bcomplement\b"]},
    # Number sets
    "nat":       {"chars": "ℕ", "latex": [r"\mathbb{N}"], "keywords": [r"\bnatural numbers?\b"]},
    "int":       {"chars": "ℤ", "latex": [r"\mathbb{Z}"], "keywords": [r"\bintegers?\b"]},
    "intn":      {"chars": "", "latex": [r"\mathbb{Z}_"], "keywords": [r"\bZ ?\d{1,3}\b", r"\bZ_?n\b", r"\bmodular arithmetic\b"]},
    "rat":       {"chars": "ℚ", "latex": [r"\mathbb{Q}"], "keywords": [r"\brational numbers?\b"]},
    "real":      {"chars": "ℝ", "latex": [r"\mathbb{R}"], "keywords": [r"\breal numbers?\b"]},
    # Relations
    "neq":       {"chars": "≠", "latex": [r"\neq", r"\ne "], "keywords": []},
    "leq":       {"chars": "≤", "latex": [r"\leq", r"\le "], "keywords": []},
    "geq":       {"chars": "≥", "latex": [r"\geq", r"\ge "], "keywords": []},
    "approx":    {"chars": "≈", "latex": [r"\approx"], "keywords": []},
    "equiv":     {"chars": "≡", "latex": [r"\equiv"], "keywords": [r"\bcongruen", r"\bequivalence relation\b"]},
    "sim":       {"chars": "∼", "latex": [r"\sim"], "keywords": []},
    # Number theory
    "divides":   {"chars": "∣", "latex": [r"\mid"], "keywords": [r"\bdivisib", r"\bdivides\b", r"\b[a-z] \| [a-z]\b"]},
    "ndivides":  {"chars": "∤", "latex": [r"\nmid"], "keywords": [r"\bdoes not divide\b"]},
    "pmod":      {"chars": "", "latex": [r"\pmod", r"\bmod"], "keywords": [r"\bmodulo\b", r"\bmod \d", r"\bmod [a-z]\b", r"\(mod\b", r"\bmodular arithmetic\b", r"\bcongruen"]},
    "gcd":       {"chars": "", "latex": [r"\gcd"], "keywords": [r"\bgcd\b", r"\bgreatest common divisor\b", r"\beuclidean algorithm\b"]},
    "lcm":       {"chars": "", "latex": [r"\operatorname{lcm}"], "keywords": [r"\blcm\b", r"\bleast common multiple\b"]},
    "otimes":    {"chars": "⊗", "latex": [r"\otimes"], "keywords": []},
    "oslash":    {"chars": "⊘", "latex": [r"\oslash"], "keywords": [r"\bmodular division\b"]},
    "base":      {"chars": "", "latex": [], "keywords": [r"\bbase \d+\b", r"\bhexadecimal\b", r"\bbinary expansion\b"]},
    # Arithmetic
    "pow":       {"chars": "²³", "latex": [r"^{"], "keywords": [r"\w\^\{?\w", r"\bexponents?\b", r"\bprime factori[sz]ation\b", r"\bsquared?\b"]},
    "sub":       {"chars": "₀₁₂", "latex": [r"_{"], "keywords": [r"\bsubscripts?\b"]},
    "frac":      {"chars": "", "latex": [r"\frac", r"\dfrac"], "keywords": [r"\bfractions?\b"]},
    "sqrt":      {"chars": "√", "latex": [r"\sqrt"], "keywords": [r"\bsquare root\b"]},
    "sum":       {"chars": "∑", "latex": [r"\sum"], "keywords": [r"\bsummation\b"]},
    "prod":      {"chars": "∏", "latex": [r"\prod"], "keywords": []},
    "infty":     {"chars": "∞", "latex": [r"\infty"], "keywords": [r"\binfinit"]},
    "fact":      {"chars": "", "latex": [], "keywords": [r"\bfactorial\b", r"\b\d+!"]},
    "binom":     {"chars": "", "latex": [r"\binom", r"\choose"], "keywords": [r"\bbinomial\b", r"\bn choose k\b"]},
    "floor":     {"chars": "⌊⌋", "latex": [r"\lfloor"], "keywords": [r"\bfloor\b"]},
    "ceil":      {"chars": "⌈⌉", "latex": [r"\lceil"], "keywords": [r"\bceiling\b"]},
    # Asymptotics
    "bigo":      {"chars": "", "latex": [], "keywords": [r"\bbig[- ]?o\b", r"\bO\(", r"\basymptotic"]},
    "theta":     {"chars": "Θ", "latex": [r"\Theta"], "keywords": [r"\bbig[- ]?theta\b"]},
    "omega":     {"chars": "Ω", "latex": [r"\Omega"], "keywords": [r"\bbig[- ]?omega\b"]},
    "log":       {"chars": "", "latex": [r"\log", r"\lg"], "keywords": [r"\blog(arithm)?\b"]},
    "recur":     {"chars": "", "latex": [], "keywords": [r"\brecurrence\b", r"\bT\(n\)"]},
    # Automata
    "epsilon":   {"chars": "εϵ", "latex": [r"\epsilon", r"\varepsilon"], "keywords": [r"\bempty string\b"]},
    "Sigma":     {"chars": "Σ", "latex": [r"\Sigma"], "keywords": [r"\balphabet\b"]},
    "sigmastar": {"chars": "", "latex": [r"\Sigma^*"], "keywords": [r"\bkleene\b"]},
    "delta":     {"chars": "δ", "latex": [r"\delta"], "keywords": [r"\btransition function\b"]},
    "q0":        {"chars": "", "latex": [r"q_0"], "keywords": [r"\bstart state\b", r"\bq0\b"]},
    "kleene":    {"chars": "", "latex": [r"^*"], "keywords": [r"\bkleene star\b", r"\bregular expression\b", r"\bregex\b"]},
    "vdash":     {"chars": "⊢", "latex": [r"\vdash"], "keywords": [r"\bderiv(es|ation)\b"]},
    "lambda":    {"chars": "λ", "latex": [r"\lambda"], "keywords": [r"\blambda calculus\b"]},
    "Gamma":     {"chars": "Γ", "latex": [r"\Gamma"], "keywords": [r"\btyping context\b"]},
    # Added: logic, sets, relations, functions
    "impliedby": {"chars": "⇐", "latex": [r"\Leftarrow"], "keywords": []},
    "existsunique": {"chars": "", "latex": [r"\exists!"], "keywords": [r"\bthere (exists|is) (a )?unique\b", r"\bthere is exactly one\b"]},
    "models":    {"chars": "⊨", "latex": [r"\models"], "keywords": [r"\blogical consequence\b", r"\bsemantically entail"]},
    "subsetneq": {"chars": "⊊", "latex": [r"\subsetneq"], "keywords": [r"\bproper subset\b"]},
    "nsubseteq": {"chars": "⊈", "latex": [r"\not\subseteq"], "keywords": [r"\bnot a subset\b"]},
    "symdiff":   {"chars": "△", "latex": [r"\triangle"], "keywords": [r"\bsymmetric difference\b"]},
    "bigcup":    {"chars": "⋃", "latex": [r"\bigcup"], "keywords": [r"\bunion of (all|the) sets\b"]},
    "bigcap":    {"chars": "⋂", "latex": [r"\bigcap"], "keywords": [r"\bintersection of (all|the) sets\b"]},
    "nequiv":    {"chars": "≢", "latex": [r"\not\equiv"], "keywords": []},
    "prec":      {"chars": "≺", "latex": [r"\prec"], "keywords": []},
    "preceq":    {"chars": "⪯≼", "latex": [r"\preceq"], "keywords": [r"\bpartial(ly)? order", r"\bposets?\b", r"\bhasse diagram\b"]},
    "cong":      {"chars": "≅", "latex": [r"\cong"], "keywords": [r"\bisomorphi(c|sm)\b"]},
    "funcarrow": {"chars": "", "latex": [], "keywords": [r"\b[fgh] ?: ?[A-Z] ?(→|->|\\to)", r"\b(one-to-one|onto|bijecti(ve|on)|injecti(ve|on)|surjecti(ve|on))\b"]},
    "mapsto":    {"chars": "↦", "latex": [r"\mapsto"], "keywords": []},
    "compose":   {"chars": "∘", "latex": [r"\circ"], "keywords": [r"\bcompositions? of\b", r"\bcomposite function\b"]},
    "inverse":   {"chars": "⁻¹", "latex": [r"^{-1}"], "keywords": [r"\binverse (function|relation)\b", r"\bmultiplicative inverse\b"]},
    # Added: arithmetic, asymptotics, graphs
    "ldots":     {"chars": "…", "latex": [r"\ldots", r"\dots"], "keywords": []},
    "cdots":     {"chars": "⋯", "latex": [r"\cdots"], "keywords": []},
    "littleo":   {"chars": "", "latex": [], "keywords": [r"\blittle-?o\b", r"\bo\(n"]},
    "littleomega": {"chars": "", "latex": [], "keywords": [r"\blittle-?omega\b"]},
    "logb":      {"chars": "", "latex": [r"\log_"], "keywords": [r"\blog base\b", r"\blogarithm base\b"]},
    "lg":        {"chars": "", "latex": [r"\lg"], "keywords": [r"\blg ?n\b"]},
    "graph":     {"chars": "", "latex": [], "keywords": [r"\bG ?= ?\(V, ?E\)", r"\b(undirected|directed|weighted) graph\b"]},
    "edge":      {"chars": "", "latex": [], "keywords": [r"\bedges? \(?[uv], ?[uv]\)?", r"\{u, ?v\}", r"\(u, ?v\) ?∈ ?E"]},
    "deg":       {"chars": "", "latex": [r"\deg"], "keywords": [r"\bdeg(ree)? ?\(", r"\bdegree of (a|each|the) vertex\b"]},
    "path":      {"chars": "⇝", "latex": [r"\rightsquigarrow", r"\leadsto"], "keywords": []},
    "assign":    {"chars": "←", "latex": [r"\leftarrow", r"\gets"], "keywords": [r"\bpseudocode\b"]},
    "angle":     {"chars": "⟨⟩", "latex": [r"\langle"], "keywords": [r"\bencoding of\b"]},
    # Added: automata
    "kplus":     {"chars": "", "latex": [], "keywords": [r"\bkleene plus\b"]},
    "vdashstar": {"chars": "", "latex": [r"\vdash^*"], "keywords": [r"\byields in (zero or more|many) steps\b"]},
    "blank":     {"chars": "⊔␣", "latex": [r"\sqcup"], "keywords": [r"\bblank symbol\b", r"\bturing machine\b"]},
    # Added: programming languages (CMPSC 461)
    "lambdaabs": {"chars": "", "latex": [], "keywords": [r"λ ?[a-z] ?\.", r"\blambda abstraction\b"]},
    "judgment":  {"chars": "", "latex": [], "keywords": [r"\btyping (judg(e)?ment|rule)s?\b", r"\bwell-typed\b", r"\btype system\b"]},
    "tau":       {"chars": "τ", "latex": [r"\tau"], "keywords": []},
    "arrowtype": {"chars": "", "latex": [], "keywords": [r"\bfunction types?\b", r"\barrow types?\b"]},
    "step":      {"chars": "⟶", "latex": [r"\longrightarrow"], "keywords": [r"\bsmall-step\b", r"\bstructural operational semantics\b"]},
    "stepstar":  {"chars": "", "latex": [r"\longrightarrow^*"], "keywords": [r"\bmulti-?step\b"]},
    "bigstep":   {"chars": "⇓", "latex": [r"\Downarrow"], "keywords": [r"\bbig-step\b", r"\bnatural semantics\b"]},
    "subst":     {"chars": "", "latex": [], "keywords": [r"\bcapture-avoiding\b", r"\[[a-z] ?(↦|:=|/) ?[a-z0-9]+\]"]},
    "hoare":     {"chars": "", "latex": [], "keywords": [r"\bhoare\b", r"\bpostcondition\b", r"\bloop invariant\b"]},
    "wp":        {"chars": "", "latex": [], "keywords": [r"\bweakest precondition\b", r"\bwp ?\("]},
    "assignop":  {"chars": "", "latex": [], "keywords": [r"\b[a-z] ?:= ?"]},
}

ALL_IDS = list(RULES.keys())


def readable_text(text: str) -> str:
    """
    Drop watermark/header lines (any line repeated 3+ times, e.g. "DO NOT COPY")
    so we can tell whether a PDF has real question text.
    """
    from collections import Counter
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    counts = Counter(lines)
    kept = [l for l in lines if counts[l] < 3 and len(l) > 1]  # repeated lines = watermark/header
    return "\n".join(kept)


NO_TEXT_MESSAGE = (
    "This PDF has no readable question text (it may be protected, watermarked or image-only). "
    "Upload the original homework file, or add the questions and symbols manually."
)


def suggest_from_text(text: str) -> List[str]:
    """Return symbol ids found in the text, most frequent first."""
    if not text:
        return []
    scores: Dict[str, int] = {}
    for sym_id, rule in RULES.items():
        score = 0
        for ch in rule["chars"]:
            score += text.count(ch) * 3
        for cmd in rule["latex"]:
            score += text.count(cmd) * 3
        for pattern in rule["keywords"]:
            # Patterns with capital letters (e.g. "T\(n\)", "Z ?\d") are case-sensitive.
            flags = 0 if any(c.isupper() for c in pattern) else re.IGNORECASE
            score += len(re.findall(pattern, text, flags))
        if score:
            scores[sym_id] = score
    return sorted(scores, key=lambda k: -scores[k])


def pdf_text_and_images(pdf_bytes: bytes, max_pages: int = 6):
    """Extract text from a PDF. Also return page images (PNG) for scanned pages."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text_parts, images = [], []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        page_text = page.get_text()
        text_parts.append(page_text)
        # Very little text on a page usually means it's scanned or handwritten.
        if len(page_text.strip()) < 40:
            images.append(page.get_pixmap(dpi=110).tobytes("png"))
    return "\n".join(text_parts), images


async def suggest_from_images(images: List[bytes], client, model: str) -> List[str]:
    """Ask a vision model which library symbols appear on scanned pages. Returns only known ids."""
    if not images or client is None:
        return []
    id_list = ", ".join(ALL_IDS)
    content = [{
        "type": "text",
        "text": (
            "These pages are a homework or its solutions. Which of these math symbol ids "
            f"appear or would be needed to write the answers? Choose only from: {id_list}. "
            "Reply with a comma-separated list of ids and nothing else."
        ),
    }]
    for img in images[:4]:
        b64 = base64.b64encode(img).decode()
        content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})
    try:
        resp = await client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": content}], max_tokens=200
        )
        raw = resp.choices[0].message.content or ""
        return [s.strip() for s in raw.split(",") if s.strip() in RULES]
    except Exception as e:  # never break the form because of the AI step
        logger.warning(f"Vision symbol suggestion failed: {e}")
        return []
