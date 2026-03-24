import json
import os
from pathlib import Path
from models.printer import Printer, PrinterProtocol

CONFIG_PATH = Path(os.getenv("CONFIG_FILE", "config.json"))

_defaults: dict = {
    "printers": [],
    "orca_slicer_bin": os.getenv("ORCA_SLICER_BIN", "orca-slicer"),
    "profiles_dir": "profiles",
    "uploads_dir": "uploads",
    "gcodes_dir": "gcodes",
}


def _load() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            data = json.load(f)
        return {**_defaults, **data}
    return dict(_defaults)


def _save(data: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


def get_config() -> dict:
    return _load()


def get_printers() -> list[Printer]:
    cfg = _load()
    return [Printer(**p) for p in cfg.get("printers", [])]


def get_printer(printer_id: str) -> Printer | None:
    for p in get_printers():
        if p.id == printer_id:
            return p
    return None


def save_printer(printer: Printer) -> None:
    cfg = _load()
    printers = cfg.get("printers", [])
    printers = [p for p in printers if p["id"] != printer.id]
    printers.append(printer.model_dump())
    cfg["printers"] = printers
    _save(cfg)


def delete_printer(printer_id: str) -> bool:
    cfg = _load()
    printers = cfg.get("printers", [])
    new = [p for p in printers if p["id"] != printer_id]
    if len(new) == len(printers):
        return False
    cfg["printers"] = new
    _save(cfg)
    return True
