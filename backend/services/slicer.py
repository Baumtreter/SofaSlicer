"""
OrcaSlicer CLI Wrapper.

OrcaSlicer wird als Headless-Prozess ausgeführt:
  orca-slicer --slice 1 --load-settings overrides.json -o <output> <input>

Parameter-Overrides werden als temporäre JSON-Datei übergeben (--load-settings).
OrcaSlicer 2.x kennt kein --set; das ist PrusaSlicer-Syntax.

Profil-JSON-Dateien liegen unter profiles/<name>.json
und können aus der Desktop-App exportiert werden.
"""
import asyncio
import json
import os
import re
import tempfile
from pathlib import Path

from models.job import Job, SliceParams
from config import PROFILES_DIR, GCODES_DIR

ORCA_BIN = os.getenv("ORCA_SLICER_BIN", "orca-slicer")
XVFB = "xvfb-run"


def _build_overrides_json(params: SliceParams) -> str:
    """Schreibt Parameter-Overrides in eine temporäre JSON-Datei und gibt den Pfad zurück."""
    overrides = {
        "layer_height": str(params.layer_height),
        "sparse_infill_density": f"{params.infill_percent}%",
        "sparse_infill_pattern": params.infill_pattern,
        "wall_loops": str(params.perimeters),
        "enable_support": "1" if params.support else "0",
        "nozzle_temperature": [str(params.nozzle_temp)],
        "bed_temperature": [str(params.bed_temp)],
        "outer_wall_speed": str(params.speed_mm_s),
    }

    if params.support and params.support_type:
        overrides["support_type"] = params.support_type

    if params.brim:
        overrides["brim_type"] = "outer_only"
        overrides["brim_width"] = str(params.brim_width_mm)

    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, prefix="orca_overrides_"
    )
    json.dump(overrides, tmp)
    tmp.close()
    return tmp.name


def _build_args(source: Path, output: Path, params: SliceParams) -> tuple[list[str], str]:
    """Gibt (args, tmp_json_path) zurück. tmp_json_path muss nach dem Prozess gelöscht werden."""
    args = [XVFB, "-a", ORCA_BIN]

    # Profil-JSONs laden falls vorhanden (aus Desktop-App exportiert)
    settings_files = []
    printer_json  = PROFILES_DIR / f"{params.printer_profile}.json"
    filament_json = PROFILES_DIR / f"{params.filament_profile}.json"
    if printer_json.exists():
        settings_files.append(str(printer_json))
    if filament_json.exists():
        settings_files.append(str(filament_json))
    if settings_files:
        args += ["--load-settings", ";".join(settings_files)]

    # Inline-Overrides als temporäre JSON
    tmp_path = _build_overrides_json(params)
    args += ["--load-settings", tmp_path]

    args += ["--slice", "1", "-o", str(output), str(source)]
    return args, tmp_path


def _parse_stats(output: str) -> dict:
    """Extrahiert Druckzeit, Filament und Layer aus CLI-Output."""
    stats: dict = {}

    m = re.search(r"estimated printing time.*?=\s*(.*)", output, re.IGNORECASE)
    if m:
        raw = m.group(1).strip()
        seconds = 0
        for val, unit in re.findall(r"(\d+)\s*([hms])", raw):
            seconds += int(val) * {"h": 3600, "m": 60, "s": 1}[unit]
        stats["print_time_seconds"] = seconds

    m = re.search(r"total filament used.*?=\s*([\d.]+)", output, re.IGNORECASE)
    if m:
        stats["filament_used_mm"] = float(m.group(1))

    m = re.search(r"total layers count.*?=\s*(\d+)", output, re.IGNORECASE)
    if m:
        stats["layer_count"] = int(m.group(1))

    if "filament_used_mm" in stats:
        volume_cm3 = stats["filament_used_mm"] * 3.14159 * (0.85**2) / 4 / 1000
        stats["weight_g"] = round(volume_cm3 * 1.24, 1)

    return stats


async def slice_model(job: Job) -> dict:
    """
    Führt OrcaSlicer asynchron aus.
    Gibt Dict mit gcode_path + stats zurück oder wirft Exception.
    """
    source = Path(job.source_path)
    if not source.exists():
        raise FileNotFoundError(f"Quelldatei nicht gefunden: {source}")

    GCODES_DIR.mkdir(parents=True, exist_ok=True)
    output = GCODES_DIR / f"{job.id}.gcode"

    args, tmp_json = _build_args(source, output, job.params)

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await proc.communicate()
        log = stdout.decode("utf-8", errors="replace")
    finally:
        Path(tmp_json).unlink(missing_ok=True)

    if proc.returncode != 0:
        raise RuntimeError(f"OrcaSlicer Fehler (code {proc.returncode}):\n{log}")

    if not output.exists():
        raise RuntimeError("OrcaSlicer hat keine G-Code-Datei erzeugt.")

    stats = _parse_stats(log)
    return {"gcode_path": str(output), **stats}
