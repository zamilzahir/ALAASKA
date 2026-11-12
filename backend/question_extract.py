"""
Turn a homework PDF's text into template questions, and handwriting images into LaTeX.

Questions: an LLM splits the text into {number, marks, prompt_md}. If no API key is
set, or the call fails, a simple regex splitter is used so the feature still works.
"""
import base64
import json
import logging
import os
import re
from typing import List, Optional

logger = logging.getLogger(__name__)

QUESTION_PROMPT = """You convert homework text extracted from a PDF into assignment questions.

Rules:
- Skip course headers, submission instructions, name/collaborator lines and page numbers.
- One item per top-level problem (1, 2, 3 ...). Keep sub-parts (a), (b), (i), (ii) inside the
  same question's text, each on its own line.
- Write the question text in Markdown with LaTeX math in $...$ (e.g. $\\{x \\in \\mathbb{Z} \\mid x^2 < 10\\}$).
  Fix PDF extraction artifacts: "0/" is the empty set, "n2" usually means $n^2$, "Z17" means $\\mathbb{Z}_{17}$,
  "(4563)7" means $(4563)_7$.
- marks: total points for the problem ONLY if the text states a number (e.g. "(5 x 3 = 15 pts)" -> 15,
  "[6+6=12 pts]" -> 12). If the points are blank or missing (e.g. "( pts.)"), use 1. Never guess.
- Graphs, diagrams and tables are extracted separately as images. Where the text shows a table's
  contents or a graph's labels, do not copy them; write *(see figure below)* instead.
- Do NOT include any solutions, even if solution text is present.

Return only JSON: {"questions": [{"number": "1", "marks": 15, "prompt_md": "..."}]}"""


# When a model writes "\text" inside JSON with one backslash, json.loads turns "\t" into a
# tab (and "\f" -> form feed, "\b" -> backspace, "\r" -> carriage return, "\n" -> newline).
# Put the backslash back for anything that is clearly a LaTeX command.
_LATEX_AFTER_NEWLINE = r"(eq|eg|abla|mid|otin|exists|ewline|leq|geq|u\b|i\b|ot\b|otin)"


def fix_latex_escapes(s: str) -> str:
    s = s.replace("\t", "\\t").replace("\f", "\\f").replace("\b", "\\b")
    s = re.sub(r"\r(?=[a-zA-Z])", r"\\r", s)
    s = re.sub(r"\n(?=" + _LATEX_AFTER_NEWLINE + ")", r"\\n", s)
    return s


def regex_split_questions(text: str) -> List[dict]:
    """Fallback: split on lines that start with '1.', '2.' ... and pull '(… pts)' totals."""
    lines = text.splitlines()
    questions, current = [], None
    for line in lines:
        # "1. Text", "1.(25 pts.) Text", or "1." alone on its line (text on the next lines)
        m = re.match(r"^\s*(\d{1,2})\.(?:\s+(.*)|\s*(\(\s*\d+(?:\.\d+)?\s*pts?\.?\s*\).*)|\s*$)", line)
        if m:
            if current:
                questions.append(current)
            current = {"number": m.group(1), "marks": 1, "prompt_md": (m.group(2) or m.group(3) or "").strip()}
        elif current is not None and line.strip():
            current["prompt_md"] += "\n" + line.strip()
    if current:
        questions.append(current)

    for q in questions:
        pts = re.search(r"=\s*(\d+(?:\.\d+)?)\s*pts|\[?(\d+(?:\.\d+)?)\s*pts", q["prompt_md"])
        if pts:
            q["marks"] = float(pts.group(1) or pts.group(2))
        q["prompt_md"] = re.sub(r"\(?\[?[\d\s+x×=]*pts\.?\]?\)?", "", q["prompt_md"]).strip()
    # Instruction lists ("1. Submit your HW...") come first; the real problems restart at 1,
    # so keep only the last run that starts at question 1.
    starts = [i for i, q in enumerate(questions) if q["number"] == "1"]
    if starts:
        questions = questions[starts[-1]:]
    return [q for q in questions if len(q["prompt_md"]) > 15]


async def extract_questions(text: str, client, model: str) -> dict:
    """Return {"questions": [...], "method": "ai" | "basic"}."""
    text = text[:30000]
    if client is not None:
        try:
            resp = await client.chat.completions.create(
                model=model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": QUESTION_PROMPT},
                    {"role": "user", "content": text},
                ],
            )
            data = json.loads(resp.choices[0].message.content or "{}")
            for q in data.get("questions", []):
                q["prompt_md"] = fix_latex_escapes(str(q.get("prompt_md", "")))
            questions = [
                {
                    "number": str(q.get("number", i + 1)).strip(),
                    "marks": float(q.get("marks") or 1),
                    "prompt_md": str(q.get("prompt_md", "")).strip(),
                }
                for i, q in enumerate(data.get("questions", []))
                if str(q.get("prompt_md", "")).strip()
            ]
            if questions:
                return {"questions": questions, "method": "ai"}
        except Exception as e:
            logger.warning(f"AI question extraction failed, using basic splitter: {e}")
    return {"questions": regex_split_questions(text), "method": "basic"}


HANDWRITING_PROMPT = (
    "This is a student's handwritten work from a writing pad in a homework tutor for computer science "
    "and math courses. It may be text/math, or a drawn diagram such as a tree, graph, automaton, table "
    "or array.\n"
    "- Text or math: transcribe it into Markdown with LaTeX math in $...$ (display math in $$...$$), "
    "keeping the student's line breaks.\n"
    "- A tree: write it as text, e.g.\nTree (root A):\nA -> B, D\nB -> C, E\n(list each node's children "
    "left to right; include edge labels/weights if drawn).\n"
    "- A graph or automaton: Directed: yes/no, Vertices: ..., Edges: A->B (label), ... ; mark start/accept states.\n"
    "- A table or array: a Markdown table.\n"
    "Do not solve, correct or add anything. Never refuse: if a part is unreadable write [unclear]. "
    "Return only the transcription."
)

HANDWRITING_MODELS = [os.getenv("HANDWRITING_MODEL_ID", "gpt-4o")]


async def handwriting_to_latex(image_b64: str, client, model: str) -> Optional[str]:
    if client is None:
        return None
    last_error = None
    for m in dict.fromkeys(HANDWRITING_MODELS + [model]):  # stronger model first, then fallback
        try:
            resp = await client.chat.completions.create(
                model=m,
                temperature=0,
                max_tokens=800,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": HANDWRITING_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                    ],
                }],
            )
        except Exception as e:
            last_error = e
            continue
        out = (resp.choices[0].message.content or "").strip()
        out = re.sub(r"^```(?:markdown|latex)?\s*|\s*```$", "", out)
        if re.match(r"^(i'?m sorry|sorry|i can(no|')t)", out, re.I):
            continue  # a refusal is not a transcription; try the next model
        return out
    if last_error:
        raise last_error
    return "[unclear] Try writing larger, or draw the tree with clear letters for each node."


def is_valid_png_b64(data: str) -> bool:
    try:
        return base64.b64decode(data[:64] + "==", validate=False)[:4] == b"\x89PNG"
    except Exception:
        return False
