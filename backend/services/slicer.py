"""
OrcaSlicer CLI Wrapper.

OrcaSlicer wird als Headless-Prozess ausgeführt:
  orca-slicer --slice 0 --export-gcode --load <profile> -o <output> <input>

Profil-INI-Dateien liegen unter profiles/<name>.ini
und können aus der Desktop-App exportiert werden.
"""
import asyncio
import os
import re
import tempfile
from pathlib import Path

from models.job import Job, SliceParams

ORCA_BIN = os.getenv("ORCA_SLICER_BIN", "orca-slicer")
PROFILES_DIR = Path(os.getenv("PROFILES_DIR", "profiles"))
GCODES_DIR   = Path(os.getenv("GCODES_DIR",   "gcodes"))


def _build_args(source: Path, output: Path, params: SliceParams) -> list[str]:
    args = [ORCA_BIN]

    # Profil-Dateien laden falls vorhanden
    printer_ini  = PROFILES_DIR / f"{params.printer_profile}.ini"
    filament_ini = PROFILES_DIR / f"{params.filament_profile}.ini"

    if printer_ini.exists():
        args += ["--load", str(printer_ini)]
    if filament_ini.exists():
        args += ["--load", str(filament_ini)]

    # Inline-Overrides
    args += [
        "--set", f"layer_height={params.layer_height}",
        "--set", f"fill_density={params.infill_percent}%",
        "--set", f"fill_pattern={params.infill_pattern}",
        "--set", f"perimeters={params.perimeters}",
        "--set", f"support_material={'1' if params.support else '0'}",
        "--set", f"temperature={params.nozzle_temp}",
        "--set", f"bed_temperature={params.bed_temp}",
        "--set", f"perimeter_speed={params.speed_mm_s}",
    ]

    if params.support and params.support_type:
        args += ["--set", f"support_material_style={params.support_type}"]

    if params.brim:
        args += [
            "--set", "brim_type=outer_only",
            "--set", f"brim_width={params.brim_width_mm}",
        ]

    args += ["--export-gcode", "-o", str(output), str(source)]
    return args


def _parse_stats(output: str) -> dict:
    """Extrahiert Druckzeit, Filament und Layer aus CLI-Output."""
    stats: dict = {}

    # Druckzeit: "estimated printing time = 2h 34m 12s"
    m = re.search(r"estimated printing time.*?=\s*(.*)", output, re.IGNORECASE)
    if m:
        raw = m.group(1).strip()
        seconds = 0
        for val, unit in re.findall(r"(\d+)\s*([hms])", raw):
            seconds += int(val) * {"h": 3600, "m": 60, "s": 1}[unit]
        stats["print_time_seconds"] = seconds

    # Filament: "total filament used [mm] = 4821.23"
    m = re.search(r"total filament used.*?=\s*([\d.]+)", output, re.IGNORECASE)
    if m:
        stats["filament_used_mm"] = float(m.group(1))

    # Layer count: "total layers count = 240"
    m = re.search(r"total layers count.*?=\s*(\d+)", output, re.IGNORECASE)
    if m:
        stats["layer_count"] = int(m.group(1))

    # Gewicht schätzen: ~1.24 g/cm³ PLA, ~π*(0.85mm)²/4 * length_mm * density
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

    args = _build_args(source, output, job.params)

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    log = stdout.decode("utf-8", errors="replace")

    if proc.returncode != 0:
        raise RuntimeError(f"OrcaSlicer Fehler (code {proc.returncode}):\n{log}")

    if not output.exists():
        raise RuntimeError("OrcaSlicer hat keine G-Code-Datei erzeugt.")

    stats = _parse_stats(log)
    return {"gcode_path": str(output), **stats}
