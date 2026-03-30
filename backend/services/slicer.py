"""
OrcaSlicer CLI Wrapper.

Korrekter Aufruf (OrcaSlicer 2.x):

  xvfb-run -a orca-slicer \
    --load-settings "machine.json;process.json" \
    --load-filaments "filament.json" \
    --allow-newer-file \
    --slice 1 \
    --outputdir /tmp/out \
    input.stl

Profile kommen aus /data/printers/{printer_id}/ (einmalig beim Setup heruntergeladen).
Kein dynamisches Generieren mehr -> keine -5/-17 Fehler mehr.

Wichtige Regeln:
- --allow-newer-file verhindert Versions-Mismatch-Fehler
- OrcaSlicer schreibt result.json ins outputdir (return_code + error_string)
- Ausgabedatei heisst automatisch plate_1.gcode
- Slice-Fehler landen NICHT in Container-Logs -> nur in result.json und job.error
"""
import asyncio
import json
import os
import re
import tempfile
from pathlib import Path

from models.job import Job, SliceParams
from config import GCODES_DIR, PRINTERS_DIR
import config

ORCA_BIN = os.getenv("ORCA_SLICER_BIN", "orca-slicer")
XVFB = "xvfb-run"


def _resolve_profiles(params: SliceParams) -> tuple[Path, Path, Path]:
    """
    Gibt (machine_path, process_path, filament_path) zurueck.
    Wirft ValueError wenn Drucker oder Profile nicht gefunden.
    """
    if not params.printer_id:
        raise ValueError("Kein Drucker ausgewaehlt (printer_id fehlt)")

    printer = config.get_setup_printer(params.printer_id)
    if not printer:
        raise ValueError(f"Drucker '{params.printer_id}' nicht gefunden. Bitte zuerst einrichten.")
    if not printer.get("ready"):
        raise ValueError(f"Drucker '{printer['display_name']}' ist noch nicht bereit (Profile werden noch heruntergeladen)")

    printer_dir = PRINTERS_DIR / params.printer_id

    # Machine JSON (immer genau eine pro Drucker)
    machine_dir = printer_dir / "machine"
    machine_files = list(machine_dir.glob("*.json"))
    if not machine_files:
        raise ValueError(f"Keine Machine-JSON gefunden in {machine_dir}")
    machine_path = machine_files[0]

    # Process JSON
    if not params.process_file:
        raise ValueError("Kein Druckprofil ausgewaehlt (process_file fehlt)")
    process_path = printer_dir / "process" / params.process_file
    if not process_path.exists():
        raise ValueError(f"Druckprofil nicht gefunden: {params.process_file}")

    # Filament JSON
    if not params.filament_file:
        raise ValueError("Kein Filament ausgewaehlt (filament_file fehlt)")
    filament_path = printer_dir / "filament" / params.filament_file
    if not filament_path.exists():
        raise ValueError(f"Filament-Profil nicht gefunden: {params.filament_file}")

    return machine_path, process_path, filament_path


def _build_args(source: Path, out_dir: Path, machine: Path, process: Path, filament: Path) -> list[str]:
    """Baut die OrcaSlicer CLI-Argumente zusammen."""
    args = [XVFB, "-a", ORCA_BIN]
    args += ["--load-settings", f"{machine};{process}"]
    args += ["--load-filaments", str(filament)]
    args += ["--allow-newer-file", "--slice", "1", "--outputdir", str(out_dir), str(source)]
    return args


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
    Fuehrt OrcaSlicer asynchron aus.
    Gibt Dict mit gcode_path + stats zurueck oder wirft Exception.
    """
    source = Path(job.source_path)
    if not source.exists():
        raise FileNotFoundError(f"Quelldatei nicht gefunden: {source}")

    machine_path, process_path, filament_path = _resolve_profiles(job.params)

    GCODES_DIR.mkdir(parents=True, exist_ok=True)
    final_output = GCODES_DIR / f"{job.id}.gcode"

    with tempfile.TemporaryDirectory(prefix="orca_out_") as out_dir:
        args = _build_args(source, Path(out_dir), machine_path, process_path, filament_path)

        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await proc.communicate()
        log = stdout.decode("utf-8", errors="replace")

        # result.json auswerten (OrcaSlicer schreibt immer eine)
        result_json_path = Path(out_dir) / "result.json"
        if result_json_path.exists():
            try:
                result_data = json.loads(result_json_path.read_text())
                if result_data.get("return_code", 0) != 0:
                    error_str = result_data.get("error_string") or log
                    raise RuntimeError(f"OrcaSlicer Fehler (code {result_data['return_code']}): {error_str}")
            except RuntimeError:
                raise
            except Exception:
                pass  # result.json nicht parsebar -> weiter mit returncode-Check

        if proc.returncode != 0:
            raise RuntimeError(f"OrcaSlicer Fehler (code {proc.returncode}):\n{log}")

        gcode_files = list(Path(out_dir).glob("*.gcode"))
        if not gcode_files:
            raise RuntimeError(f"OrcaSlicer hat keine G-Code-Datei erzeugt.\nLog:\n{log}")

        gcode_files[0].rename(final_output)

    stats = _parse_stats(log)
    return {"gcode_path": str(final_output), **stats}
