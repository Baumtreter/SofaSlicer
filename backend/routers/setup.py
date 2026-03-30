"""
Setup-Router: Drucker einrichten (Profile vom OrcaSlicer GitHub-Repo herunterladen).

GET  /setup/printers/available              → Vendors + Maschinen vom GitHub-Repo
GET  /setup/printers/available/{vendor}     → Maschinen-Liste für einen Vendor
GET  /setup/printers                        → Eingerichtete Drucker mit ihren Profilen
POST /setup/printers                        → Drucker hinzufügen + Profile herunterladen
DELETE /setup/printers/{printer_id}         → Drucker + Profile entfernen

POST /setup/printers/{printer_id}/profiles  → Verfügbare process/filament-Dateien auflisten
"""
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

import config
from config import PRINTERS_DIR
from services.github_profiles import list_vendors, list_machines, download_printer_profiles

router = APIRouter()


class AddPrinterRequest(BaseModel):
    display_name: str    # z.B. "Mein P1S"
    vendor: str          # z.B. "BBL"
    machine_file: str    # z.B. "Bambu Lab P1S.json"


class SetupPrinter(BaseModel):
    id: str
    display_name: str
    vendor: str
    machine_file: str
    process_count: int = 0
    filament_count: int = 0
    ready: bool = False   # False während Download läuft


class PrinterProfiles(BaseModel):
    printer_id: str
    machine: str
    process_files: list[str]
    filament_files: list[str]


# ── Discovery ────────────────────────────────────────────────────────────────

@router.get("/available", response_model=list[dict])
async def get_available_vendors():
    """Listet alle Vendor-Ordner aus dem OrcaSlicer GitHub-Repo."""
    try:
        return await list_vendors()
    except Exception as e:
        raise HTTPException(502, f"GitHub nicht erreichbar: {e}")


@router.get("/available/{vendor}", response_model=list[str])
async def get_available_machines(vendor: str):
    """Listet alle Machine-JSONs für einen Vendor."""
    try:
        return await list_machines(vendor)
    except Exception as e:
        raise HTTPException(502, f"Konnte Maschinen nicht laden: {e}")


# ── Konfigurierte Drucker ────────────────────────────────────────────────────

@router.get("/", response_model=list[SetupPrinter])
async def list_setup_printers():
    """Listet alle eingerichteten Drucker."""
    return config.get_setup_printers()


@router.get("/{printer_id}/profiles", response_model=PrinterProfiles)
async def get_printer_profiles(printer_id: str):
    """Gibt die verfügbaren process- und filament-Dateien für einen Drucker zurück."""
    printer = config.get_setup_printer(printer_id)
    if not printer:
        raise HTTPException(404, "Drucker nicht gefunden")

    printer_dir = PRINTERS_DIR / printer_id
    process_dir = printer_dir / "process"
    filament_dir = printer_dir / "filament"

    process_files = sorted(p.name for p in process_dir.glob("*.json")) if process_dir.exists() else []
    filament_files = sorted(p.name for p in filament_dir.glob("*.json")) if filament_dir.exists() else []

    return PrinterProfiles(
        printer_id=printer_id,
        machine=printer["machine_file"],
        process_files=process_files,
        filament_files=filament_files,
    )


@router.post("/", response_model=SetupPrinter, status_code=202)
async def add_setup_printer(req: AddPrinterRequest, background_tasks: BackgroundTasks):
    """
    Drucker hinzufügen: Profile werden im Hintergrund vom GitHub-Repo heruntergeladen.
    Status 202 = wird verarbeitet. Drucker ist bereit wenn ready=True.
    """
    printer_id = str(uuid.uuid4())
    printer = {
        "id": printer_id,
        "display_name": req.display_name,
        "vendor": req.vendor,
        "machine_file": req.machine_file,
        "process_count": 0,
        "filament_count": 0,
        "ready": False,
    }
    config.save_setup_printer(printer)

    async def _download():
        dest_dir = PRINTERS_DIR / printer_id
        try:
            result = await download_printer_profiles(req.vendor, req.machine_file, dest_dir)
            printer.update({
                "process_count": result["process_count"],
                "filament_count": result["filament_count"],
                "ready": True,
            })
        except Exception as e:
            printer["ready"] = False
            printer["error"] = str(e)
        config.save_setup_printer(printer)

    background_tasks.add_task(_download)
    return SetupPrinter(**printer)


@router.delete("/{printer_id}", status_code=204)
async def delete_setup_printer(printer_id: str):
    """Drucker entfernen — löscht Konfiguration + heruntergeladene Profile."""
    if not config.delete_setup_printer(printer_id):
        raise HTTPException(404, "Drucker nicht gefunden")

    printer_dir = PRINTERS_DIR / printer_id
    if printer_dir.exists():
        shutil.rmtree(printer_dir)
