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
    layer_height: float = 0.2
    infill_percent: int = 15
    infill_pattern: str = "gyroid"
    perimeters: int = 3
    support: bool = False
    support_type: str | None = None     # "normal" | "tree" | "organic"
    brim: bool = False
    brim_width_mm: float = 8.0
    nozzle_temp: int = 215
    bed_temp: int = 60
    speed_mm_s: int = 150
    machine_profile: str = ""   # voller Pfad zur OrcaSlicer-Maschinen-JSON
    process_profile: str = ""   # voller Pfad zur OrcaSlicer-Prozess-JSON
    filament_profile: str = ""  # voller Pfad zur OrcaSlicer-Filament-JSON


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
