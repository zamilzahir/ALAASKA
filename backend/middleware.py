from fastapi.responses import JSONResponse
from fastapi import HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from backend.config import FRONTEND_URL

def get_cors_middleware():
    """Configure CORS middleware"""
    return {
        # FRONTEND_URL may list several origins, comma-separated
        # (e.g. "http://localhost:3000,https://alaaska.vercel.app").
        "allow_origins": [u.strip().rstrip("/") for u in FRONTEND_URL.split(",") if u.strip()],
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["*"],
    }

async def add_security_headers(request: Request, call_next):
    """Add security headers to responses"""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Routes that accept files (homework PDFs, uploads, drawings) get a larger limit.
UPLOAD_PATHS = ("/symbols/suggest", "/assignment-templates/extract-questions",
                "/uploads/attach", "/handwriting/attach", "/handwriting/convert")
MAX_BODY = 1_000_000          # 1 MB for normal requests
MAX_UPLOAD_BODY = 32_000_000  # 32 MB for two PDFs (15 MB each) + form overhead


async def limit_request_size(request: Request, call_next):
    """Limit request body size to prevent abuse"""
    if request.headers.get("content-length"):
        content_length = int(request.headers.get("content-length"))
        limit = MAX_UPLOAD_BODY if request.url.path.endswith(UPLOAD_PATHS) else MAX_BODY
        if content_length > limit:
            # Raising inside middleware becomes a 500; return the 413 directly.
            return JSONResponse(status_code=413, content={"detail": "File or request is too large"})
    response = await call_next(request)
    return response