"""
Files-Router: Upload von STL/3MF (lokal oder per URL).
"""
import httpx
from pathlib import Path
from urllib.parse import urlparse, unquote

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import aiofiles

router = APIRouter()
UPLOADS_DIR = Path("uploads")
ALLOWED_EXT = {".stl", ".3mf", ".obj"}


def _safe_filename(name: str) -> str:
    return Path(name).name.replace(" ", "_")


@router.post("/upload", status_code=201)
async def upload_file(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXT:
        raise HTTPException(400, f"Nicht unterstütztes Format: {suffix}")

    filename = _safe_filename(file.filename)
    dest = UPLOADS_DIR / filename

    async with aiofiles.open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)

    return {"filename": filename, "size": dest.stat().st_size}


class UrlRequest(BaseModel):
    url: str


@router.post("/fetch", status_code=201)
async def fetch_from_url(req: UrlRequest):
    """
    Lädt ein Modell direkt von einer URL herunter (z.B. Printables direkter Download-Link).
    Kein Scraping — der Nutzer gibt den direkten Datei-Link an.
    """
    parsed = urlparse(req.url)
    raw_name = unquote(Path(parsed.path).name) or "model.stl"
    suffix = Path(raw_name).suffix.lower()

    if suffix not in ALLOWED_EXT:
        raise HTTPException(400, f"Nicht unterstütztes Format: {suffix}")

    filename = _safe_filename(raw_name)
    dest = UPLOADS_DIR / filename

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            async with client.stream("GET", req.url) as resp:
                resp.raise_for_status()
                async with aiofiles.open(dest, "wb") as f:
                    async for chunk in resp.aiter_bytes(1024 * 1024):
                        await f.write(chunk)
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Download fehlgeschlagen: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(502, f"Download fehlgeschlagen: {e}")

    return {"filename": filename, "size": dest.stat().st_size}


@router.get("/")
async def list_files():
    files = []
    for p in sorted(UPLOADS_DIR.iterdir()):
        if p.suffix.lower() in ALLOWED_EXT:
            files.append({"filename": p.name, "size": p.stat().st_size})
    return files


@router.delete("/{filename}", status_code=204)
async def delete_file(filename: str):
    path = UPLOADS_DIR / _safe_filename(filename)
    if not path.exists():
        raise HTTPException(404, "Datei nicht gefunden")
    path.unlink()
