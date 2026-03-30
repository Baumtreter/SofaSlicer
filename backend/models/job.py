from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class JobStatus(str, Enum):
    pending = "pending"
    slicing = "slicing"
    sliced = "sliced"
    sending = "sending"
    printing = "printing"
    done = "done"
    error = "error"


class SliceParams(BaseModel):
    printer_id: str = ""       # ID des eingerichteten Druckers (aus /setup/printers)
    process_file: str = ""     # Dateiname aus /data/printers/{id}/process/
    filament_file: str = ""    # Dateiname aus /data/printers/{id}/filament/


class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    filename: str
    source_path: str            # Upload-Pfad (.stl / .3mf)
    gcode_path: str | None = None
    printer_id: str | None = None
    params: SliceParams = Field(default_factory=SliceParams)
    status: JobStatus = JobStatus.pending
    error: str | None = None
    # Ergebnis nach Slicing
    print_time_seconds: int | None = None
    filament_used_mm: float | None = None
    layer_count: int | None = None
    weight_g: float | None = None
