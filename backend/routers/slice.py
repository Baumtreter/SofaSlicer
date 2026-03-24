"""
Slice-Router: Slicen + optional direkt an Drucker senden.

POST /slice/           → Job anlegen + slicen
GET  /slice/{job_id}   → Job-Status + Ergebnis
POST /slice/{job_id}/send/{printer_id} → G-Code an Drucker schicken
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from models.job import Job, SliceParams, JobStatus
from services.slicer import slice_model
from services.printers.factory import get_backend
import config

router = APIRouter()

# In-Memory Job-Store (für MVP ausreichend)
_jobs: dict[str, Job] = {}


class SliceRequest(BaseModel):
    filename: str          # Dateiname aus /files/ Upload
    params: SliceParams = SliceParams()


async def _run_slice(job: Job) -> None:
    """Hintergrund-Task: slicen und Job-Status aktualisieren."""
    job.status = JobStatus.slicing
    try:
        result = await slice_model(job)
        job.gcode_path = result["gcode_path"]
        job.print_time_seconds = result.get("print_time_seconds")
        job.filament_used_mm   = result.get("filament_used_mm")
        job.layer_count        = result.get("layer_count")
        job.weight_g           = result.get("weight_g")
        job.status = JobStatus.sliced
    except Exception as e:
        job.status = JobStatus.error
        job.error  = str(e)


@router.post("/", response_model=Job, status_code=202)
async def create_slice_job(req: SliceRequest, background_tasks: BackgroundTasks):
    from config import UPLOADS_DIR
    source = UPLOADS_DIR / req.filename
    if not source.exists():
        raise HTTPException(400, f"Datei nicht gefunden: {req.filename}")

    job = Job(
        filename=req.filename,
        source_path=str(source),
        params=req.params,
    )
    _jobs[job.id] = job
    background_tasks.add_task(_run_slice, job)
    return job


@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job nicht gefunden")
    return job


@router.post("/{job_id}/send/{printer_id}", status_code=202)
async def send_to_printer(job_id: str, printer_id: str, background_tasks: BackgroundTasks):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job nicht gefunden")
    if job.status != JobStatus.sliced:
        raise HTTPException(409, f"Job ist nicht bereit (Status: {job.status})")

    printer = config.get_printer(printer_id)
    if not printer:
        raise HTTPException(404, "Drucker nicht gefunden")

    async def _send():
        job.status = JobStatus.sending
        job.printer_id = printer_id
        try:
            backend = get_backend(printer)
            await backend.upload_and_print(job.gcode_path, f"{job.id}.gcode")
            job.status = JobStatus.printing
        except Exception as e:
            job.status = JobStatus.error
            job.error  = str(e)

    background_tasks.add_task(_send)
    return {"message": "G-Code wird übertragen", "job_id": job_id, "printer_id": printer_id}


@router.get("/", response_model=list[Job])
async def list_jobs():
    return list(_jobs.values())
