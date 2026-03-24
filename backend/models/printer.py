from enum import Enum
from pydantic import BaseModel, Field
import uuid


class PrinterProtocol(str, Enum):
    moonraker = "moonraker"   # Snapmaker U1, Creality K1 Max
    bambu = "bambu"           # Bambu Lab P1S, A1


class PrinterStatus(str, Enum):
    online = "online"
    printing = "printing"
    idle = "idle"
    offline = "offline"
    error = "error"


class Printer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    protocol: PrinterProtocol
    host: str                  # IP-Adresse
    # Moonraker
    port: int = 7125
    moonraker_api_key: str | None = None
    # Bambu
    serial: str | None = None  # Seriennummer (z.B. 01P00A...)
    access_code: str | None = None  # LAN-Zugangscode vom Display


class PrinterState(BaseModel):
    printer_id: str
    status: PrinterStatus
    hotend_temp: float | None = None
    hotend_target: float | None = None
    bed_temp: float | None = None
    bed_target: float | None = None
    progress: float | None = None   # 0.0 – 1.0
    filename: str | None = None
    eta_seconds: int | None = None
    message: str | None = None
