"""Suggest palette symbols for an assignment from its homework/solution PDFs and question text."""
import logging
import os
from typing import Optional

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from openai import AsyncOpenAI
from pydantic import BaseModel

from backend.admin import require_admin
from backend.auth import get_current_user
from backend.question_extract import extract_questions, handwriting_to_latex, is_valid_png_b64
from backend.config import OPENAI_API_KEY
from backend.db_mongo import db
from backend.figure_extract import describe_all, find_figures
from backend.symbol_extract import (NO_TEXT_MESSAGE, pdf_text_and_images, readable_text,
                                     suggest_from_images, suggest_from_text)

logger = logging.getLogger(__name__)
router = APIRouter()

client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
VISION_MODEL_ID = os.getenv("VISION_MODEL_ID", "gpt-4o-mini")
MAX_PDF_BYTES = 15 * 1024 * 1024  # 15 MB


@router.post("/symbols/suggest")
async def suggest_symbols(
    homework: Optional[UploadFile] = File(None),
    solution: Optional[UploadFile] = File(None),
    text: str = Form(""),
    user: dict = Depends(require_admin),
):
    """
    Read the uploaded PDFs (and any typed question text) and return suggested symbol ids.
    The PDFs are only read here; they are never saved.
    """
    all_text = text or ""
    scanned_pages = []

    for upload in (homework, solution):
        if upload is None:
            continue
        data = await upload.read()
        if len(data) > MAX_PDF_BYTES:
            raise HTTPException(status_code=400, detail=f"{upload.filename} is larger than 15 MB")
        try:
            pdf_text, images = pdf_text_and_images(data)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Could not read {upload.filename} as a PDF")
        all_text += "\n" + readable_text(pdf_text)
        scanned_pages.extend(images)

    if len(all_text.strip()) < 40 and not scanned_pages:
        raise HTTPException(status_code=400, detail=NO_TEXT_MESSAGE)

    found = suggest_from_text(all_text)

    # Handwritten or scanned pages: ask a vision model, limited to known symbol ids.
    used_ai = False
    if scanned_pages:
        ai_ids = await suggest_from_images(scanned_pages, client, VISION_MODEL_ID)
        used_ai = True
        found += [i for i in ai_ids if i not in found]

    return {"symbols": found, "scanned_pages": len(scanned_pages), "used_ai": used_ai}


# ---------- Auto-fill template questions from a homework PDF ----------
QUESTION_MODEL_ID = os.getenv("QUESTION_MODEL_ID", "gpt-4o-mini")


@router.post("/assignment-templates/extract-questions")
async def extract_template_questions(
    homework: UploadFile = File(...),
    user: dict = Depends(require_admin),
):
    """Read a homework PDF and return questions for the template form. The PDF is not saved."""
    data = await homework.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=400, detail="PDF is larger than 15 MB")
    try:
        text, images = pdf_text_and_images(data, max_pages=15)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the file as a PDF")
    text = readable_text(text)
    if len(text.strip()) < 40:
        raise HTTPException(status_code=400, detail=NO_TEXT_MESSAGE)
    result = await extract_questions(text, client, QUESTION_MODEL_ID)
    result["symbols"] = suggest_from_text(text)

    # Graphs, tables and pictures: crop, describe for the tutor, store, attach to questions.
    try:
        figures = find_figures(data)
    except Exception as e:
        logger.warning(f"Figure extraction failed: {e}")
        figures = []
    descriptions = await describe_all(figures, client, VISION_MODEL_ID) if figures else []
    by_number = {str(q["number"]): q for q in result["questions"]}
    for q in result["questions"]:
        q["figures"] = []
    unmatched = []
    for fig, desc in zip(figures, descriptions):
        figure_id = str(uuid.uuid4())
        await figures_collection.insert_one({
            "figure_id": figure_id,
            "kind": fig["kind"],
            "description": desc,
            "png": fig["png"],
            "created_by": user["email"],
            "created_at": datetime.now(timezone.utc),
        })
        entry = {"figure_id": figure_id, "kind": fig["kind"], "description": desc}
        target = by_number.get(str(fig["question_number"]))
        (target["figures"] if target else unmatched).append(entry)
    if unmatched and result["questions"]:
        result["questions"][0]["figures"].extend(unmatched)
    result["figure_count"] = len(figures)
    return result


figures_collection = db["question_figures"]


@router.get("/figures/{figure_id}")
async def get_figure(figure_id: str):
    """Serve a question figure. Ids are random UUIDs, so this is not guessable."""
    doc = await figures_collection.find_one({"figure_id": figure_id}, {"png": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Figure not found")
    return Response(content=bytes(doc["png"]), media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


# ---------- Writing pad: handwriting image -> Markdown/LaTeX ----------
class HandwritingRequest(BaseModel):
    image: str  # base64 PNG (no data: prefix)


@router.post("/handwriting/attach")
async def attach_handwriting(req: HandwritingRequest, user: dict = Depends(get_current_user)):
    """Store a writing-pad drawing so it can be shown in the chat and sent to the tutor as an image."""
    import base64
    image = req.image.split(",", 1)[-1]
    if len(image) > 4_000_000 or not is_valid_png_b64(image):
        raise HTTPException(status_code=400, detail="Send a PNG image under 3 MB")
    figure_id = str(uuid.uuid4())
    await figures_collection.insert_one({
        "figure_id": figure_id,
        "kind": "handwriting",
        "png": base64.b64decode(image),
        "created_by": user.get("email"),
        "created_at": datetime.now(timezone.utc),
    })
    return {"figure_id": figure_id, "url": f"/figures/{figure_id}"}


# ---------- File upload: student attaches an image or PDF to their message ----------
MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # 10 MB
MAX_PDF_PAGES = 5                     # pages sent to the tutor per PDF
MAX_SIDE = 1600                       # px; keeps images readable but requests small
IMAGE_TYPES = {"png", "jpg", "jpeg", "webp", "gif", "bmp"}


def _image_to_png(data: bytes) -> bytes:
    import io
    from PIL import Image
    img = Image.open(io.BytesIO(data))
    img.seek(0)  # first frame of a GIF
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _pdf_to_pngs(data: bytes) -> list:
    import fitz
    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    for page in list(doc)[:MAX_PDF_PAGES]:
        zoom = min(2.0, MAX_SIDE / max(page.rect.width, page.rect.height))
        pages.append(page.get_pixmap(matrix=fitz.Matrix(zoom, zoom)).tobytes("png"))
    return pages, len(doc)


@router.post("/uploads/attach")
async def attach_upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """
    Store a student's uploaded image or PDF so it shows in the chat and is sent to the tutor as images.
    PDFs are converted page by page (first 5 pages).
    """
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The file is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File is larger than 10 MB")
    name = (file.filename or "upload").strip()
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""

    try:
        if ext == "pdf" or data[:4] == b"%PDF":
            pngs, total_pages = _pdf_to_pngs(data)
        elif ext in IMAGE_TYPES or (file.content_type or "").startswith("image/"):
            pngs, total_pages = [_image_to_png(data)], 1
        else:
            raise HTTPException(status_code=400, detail="Upload a PDF or an image (PNG, JPG, WEBP, GIF)")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Upload conversion failed for {name}: {e}")
        detail = "Could not read this file. iPhone HEIC photos: export as JPG first." if ext in ("heic", "heif") \
            else "Could not read this file as a PDF or image"
        raise HTTPException(status_code=400, detail=detail)

    items = []
    for i, png in enumerate(pngs, 1):
        figure_id = str(uuid.uuid4())
        await figures_collection.insert_one({
            "figure_id": figure_id,
            "kind": "upload",
            "filename": name,
            "page": i,
            "png": png,
            "created_by": user.get("email"),
            "created_at": datetime.now(timezone.utc),
        })
        items.append({"figure_id": figure_id, "url": f"/figures/{figure_id}", "page": i})
    return {"filename": name, "items": items, "total_pages": total_pages,
            "truncated": total_pages > len(pngs)}


@router.post("/handwriting/convert")
async def convert_handwriting(req: HandwritingRequest, user: dict = Depends(get_current_user)):
    """Convert a writing-pad drawing to text. Available to any logged-in user (students)."""
    image = req.image.split(",", 1)[-1]  # accept a data URL too
    if len(image) > 4_000_000 or not is_valid_png_b64(image):
        raise HTTPException(status_code=400, detail="Send a PNG image under 3 MB")
    if client is None:
        raise HTTPException(status_code=503, detail="Handwriting conversion needs OPENAI_API_KEY")
    try:
        text = await handwriting_to_latex(image, client, VISION_MODEL_ID)
    except Exception as e:
        logger.error(f"Handwriting conversion failed: {e}")
        raise HTTPException(status_code=502, detail="Could not convert handwriting, try again")
    return {"text": text or ""}
