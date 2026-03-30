"""
OrcaSlicer CLI Wrapper.

Korrekter Aufruf (ermittelt durch Recherche OrcaSlicer 2.x CLI):

  xvfb-run -a orca-slicer \
    --load-settings "machine.json;process.json;overrides.json" \
    --load-filaments "filament.json" \
    --allow-newer-file \
    --slice 1 \
    --outputdir /tmp/out \
    input.stl

Wichtige Regeln:
- compatible_printers in process/filament JSON muss EXAKT dem 'name'-Feld
  in machine.json entsprechen (String-Vergleich, kein Fuzzy-Match)
- --load-settings: Reihenfolge machine → process → overrides (letzte hat höchste Prio)
- --allow-newer-file verhindert Versions-Mismatch-Fehler
- OrcaSlicer schreibt result.json ins outputdir (return_code + error_string)
- Ausgabedatei heißt automatisch plate_1.gcode (nicht konfigurierbar)
"""
import asyncio
import json
import os
import re
import tempfile
from pathlib import Path

from models.job import Job, SliceParams
from config import GCODES_DIR
from services.profiles import get_machine_name

ORCA_BIN = os.getenv("ORCA_SLICER_BIN", "orca-slicer")
XVFB = "xvfb-run"


def _build_overrides_json(params: SliceParams, machine_name: str) -> str:
    """
    Schreibt Parameter-Overrides in eine temporäre JSON-Datei.
    compatible_printers muss exakt dem 'name' in machine.json entsprechen.
    """
    overrides: dict = {
        "type": "process",
        "from": "user",
        "name": "sofaslicer-overrides",
        "version": "2.2.0.0",
        "layer_height": str(params.layer_height),
        "sparse_infill_density": f"{params.infill_percent}%",
        "sparse_infill_pattern": params.infill_pattern,
        "wall_loops": str(params.perimeters),
        "enable_support": "1" if params.support else "0",
        "nozzle_temperature": [str(params.nozzle_temp)],
        "bed_temperature": [str(params.bed_temp)],
        "outer_wall_speed": str(params.speed_mm_s),
    }

    if machine_name:
        overrides["compatible_printers"] = [machine_name]
    else:
        overrides["compatible_printers_condition"] = ""

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


def _build_args(source: Path, out_dir: Path, params: SliceParams) -> tuple[list[str], str]:
    """Gibt (args, tmp_json_path) zurück. tmp_json_path muss nach dem Prozess gelöscht werden."""
    machine_name = get_machine_name(params.machine_profile) if params.machine_profile else ""
    tmp_path = _build_overrides_json(params, machine_name)

    args = [XVFB, "-a", ORCA_BIN]

    # --load-settings: machine → process → overrides (aufsteigende Priorität)
    settings = []
    if params.machine_profile:
        settings.append(params.machine_profile)
    if params.process_profile:
        settings.append(params.process_profile)
    settings.append(tmp_path)
    args += ["--load-settings", ";".join(settings)]

    if params.filament_profile:
        args += ["--load-filaments", params.filament_profile]

    args += ["--allow-newer-file", "--slice", "1", "--outputdir", str(out_dir), str(source)]
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
    final_output = GCODES_DIR / f"{job.id}.gcode"

    with tempfile.TemporaryDirectory(prefix="orca_out_") as out_dir:
        args, tmp_json = _build_args(source, Path(out_dir), job.params)

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
                pass  # result.json nicht parsebar → weiter mit returncode-Check

        if proc.returncode != 0:
            raise RuntimeError(f"OrcaSlicer Fehler (code {proc.returncode}):\n{log}")

        # OrcaSlicer benennt die Ausgabe automatisch (plate_1.gcode o.ä.)
        gcode_files = list(Path(out_dir).glob("*.gcode"))
        if not gcode_files:
            raise RuntimeError(f"OrcaSlicer hat keine G-Code-Datei erzeugt.\nLog:\n{log}")

        gcode_files[0].rename(final_output)

    stats = _parse_stats(log)
    return {"gcode_path": str(final_output), **stats}
