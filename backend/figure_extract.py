"""
Find figures (graphs, tables, pictures) in a homework PDF, crop them as images,
work out which question each belongs to, and describe them in text for the tutor.
"""
import asyncio
import base64
import logging
import os
import re
from typing import List, Optional

logger = logging.getLogger(__name__)

QUESTION_START = re.compile(r"^\s*(\d{1,2})\.\s")
MIN_W, MIN_H = 60, 40   # ignore tiny drawings (underlines, rules, bullets)
MAX_FIGURES = 12
# Reading graphs needs a stronger vision model than chat; runs only once per upload.
FIGURE_MODEL_ID = os.getenv("FIGURE_MODEL_ID", "gpt-4o")


def _merge_rects(rects, gap=12):
    """Group nearby drawing rectangles into figure regions."""
    import fitz
    # Straight lines have zero-height/width rects, which never 'intersect'; pad them.
    groups = [fitz.Rect(r.x0 - 1, r.y0 - 1, r.x1 + 1, r.y1 + 1) for r in rects]
    merged = True
    while merged:
        merged = False
        out = []
        while groups:
            cur = groups.pop()
            grown = fitz.Rect(cur.x0 - gap, cur.y0 - gap, cur.x1 + gap, cur.y1 + gap)
            i = 0
            while i < len(groups):
                if grown.intersects(groups[i]):
                    cur |= groups.pop(i)
                    grown = fitz.Rect(cur.x0 - gap, cur.y0 - gap, cur.x1 + gap, cur.y1 + gap)
                    merged = True
                else:
                    i += 1
            out.append(cur)
        groups = out
    return groups


def _kind_of(drawings, region) -> str:
    """Curves (circles, arcs) mean a graph; only straight lines/boxes mean a table."""
    for d in drawings:
        if region.intersects(d["rect"]) and any(item[0] == "c" for item in d["items"]):
            return "graph"
    return "table"


def find_figures(pdf_bytes: bytes, max_pages: int = 15) -> List[dict]:
    """Return [{question_number, kind, png}] in reading order."""
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    figures, current_q = [], None
    for page_no, page in enumerate(doc):
        if page_no >= max_pages:
            break
        page_area = page.rect

        # Candidate regions: vector drawings + embedded pictures.
        drawings = [d for d in page.get_drawings() if d["rect"].width < page_area.width * 0.95]
        regions = [(r, None) for r in _merge_rects([d["rect"] for d in drawings])]
        regions += [(fitz.Rect(img["bbox"]), "image") for img in page.get_image_info()]
        regions = [(r, k) for r, k in regions if r.width >= MIN_W and r.height >= MIN_H]

        # Question starts on this page, top to bottom.
        starts = []
        for b in page.get_text("blocks"):
            m = QUESTION_START.match(b[4])
            if m:
                starts.append((b[1], m.group(1)))
        starts.sort()

        for rect, kind in sorted(regions, key=lambda x: (x[0].y0, x[0].x0)):
            q = current_q
            for y, num in starts:
                if y <= rect.y0 + 5:
                    q = num
            clip = fitz.Rect(rect.x0 - 6, rect.y0 - 6, rect.x1 + 6, rect.y1 + 6) & page_area
            png = page.get_pixmap(clip=clip, dpi=220).tobytes("png")
            figures.append({
                "question_number": q,
                "kind": kind or _kind_of(drawings, rect),
                "png": png,
            })
        if starts:
            current_q = starts[-1][1]
        if len(figures) >= MAX_FIGURES:
            break
    return figures[:MAX_FIGURES]


DESCRIBE_PROMPTS = {
    "graph": (
        "This is a graph from a homework question. List it as text so a tutor who cannot see it "
        "understands it exactly. Go vertex by vertex and check every line touching it, including "
        "diagonal and long edges, before writing the list. Output ONLY this format, no introduction:\n"
        "Directed: yes/no\nVertices: A, B, ...\n"
        "Edges: A->B (weight), ... (use A-B for undirected; omit weights if none).\n"
        "If a table is drawn next to the graph, also reproduce it as a Markdown table with empty cells kept empty. "
        "Only describe what is drawn. Do not solve anything."
    ),
    "table": (
        "This is a table from a homework question. Output ONLY a Markdown table (no introduction, "
        "no code fences), keeping empty cells empty and using LaTeX ($\\infty$) for symbols. Do not fill in anything."
    ),
    "image": (
        "This is a figure from a homework question. Describe precisely what it shows in a few "
        "lines (labels, values, structure) so a tutor who cannot see it understands it. Do not solve anything."
    ),
}


async def describe_figure(fig: dict, client, model: str) -> str:
    if client is None:
        return ""
    b64 = base64.b64encode(fig["png"]).decode()
    for m in dict.fromkeys([FIGURE_MODEL_ID, model]):  # fall back if the key can't use FIGURE_MODEL_ID
        text = await _describe_with(m, fig, b64, client)
        if text:
            return text
    return ""


async def _describe_with(model: str, fig: dict, b64: str, client) -> str:
    try:
        resp = await client.chat.completions.create(
            model=model,
            temperature=0,
            max_tokens=500,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": DESCRIBE_PROMPTS.get(fig["kind"], DESCRIBE_PROMPTS["image"])},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
            ]}],
        )
        text = (resp.choices[0].message.content or "").strip()
        return re.sub(r"^```(?:markdown)?\s*|\s*```$", "", text)
    except Exception as e:
        logger.warning(f"Figure description with {model} failed: {e}")
        return ""


async def describe_all(figures: List[dict], client, model: str) -> List[str]:
    return await asyncio.gather(*(describe_figure(f, client, model) for f in figures))


def figures_as_text(figures: Optional[list]) -> str:
    """Text appended to a question for the tutor's system prompt."""
    parts = []
    for i, f in enumerate(figures or [], 1):
        desc = (f.get("description") or "").strip()
        if desc:
            parts.append(f"Figure {i} ({f.get('kind', 'figure')}):\n{desc}")
    return ("\n\n" + "\n\n".join(parts)) if parts else ""
