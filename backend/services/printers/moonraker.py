"""
Moonraker REST API Integration.
Läuft auf Port 7125 — Snapmaker U1 und Creality K1 Max.

Docs: https://moonraker.readthedocs.io/en/latest/web_api/
"""
import httpx
from pathlib import Path

from models.printer import Printer, PrinterState, PrinterStatus
from services.printers.base import PrinterBackend


class MoonrakerBackend(PrinterBackend):
    def __init__(self, printer: Printer):
        super().__init__(printer)
        self._base = f"http://{printer.host}:{printer.port}"
        self._headers = {}
        if printer.moonraker_api_key:
            self._headers["X-Api-Key"] = printer.moonraker_api_key

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base,
            headers=self._headers,
            timeout=10.0,
        )

    async def get_state(self) -> PrinterState:
        try:
            async with self._client() as c:
                resp = await c.get(
                    "/printer/objects/query",
                    params={"extruder": "", "heater_bed": "", "print_stats": "", "display_status": ""},
                )
                if resp.status_code == 401:
                    return PrinterState(
                        printer_id=self.printer.id,
                        status=PrinterStatus.error,
                        message="401 Unauthorized — moonraker_api_key in config.json eintragen "
                                "oder Docker-IP zu trusted_clients in moonraker.conf hinzufügen",
                    )
                resp.raise_for_status()
                obj = resp.json()["result"]["status"]
        except Exception as e:
            return PrinterState(printer_id=self.printer.id, status=PrinterStatus.offline, message=str(e))

        extruder   = obj.get("extruder", {})
        bed        = obj.get("heater_bed", {})
        stats      = obj.get("print_stats", {})
        display    = obj.get("display_status", {})

        klippy_state = stats.get("state", "standby")
        status_map = {
            "printing":  PrinterStatus.printing,
            "paused":    PrinterStatus.idle,
            "standby":   PrinterStatus.idle,
            "error":     PrinterStatus.error,
            "complete":  PrinterStatus.idle,
        }
        status = status_map.get(klippy_state, PrinterStatus.online)

        return PrinterState(
            printer_id=self.printer.id,
            status=status,
            hotend_temp=extruder.get("temperature"),
            hotend_target=extruder.get("target"),
            bed_temp=bed.get("temperature"),
            bed_target=bed.get("target"),
            progress=display.get("progress"),
            filename=stats.get("filename"),
            eta_seconds=int(stats.get("print_duration", 0)) or None,
        )

    async def upload_and_print(self, gcode_path: str, filename: str) -> None:
        path = Path(gcode_path)
        async with self._client() as c:
            # 1. Datei hochladen
            with open(path, "rb") as f:
                resp = await c.post(
                    "/server/files/upload",
                    files={"file": (filename, f, "application/octet-stream")},
                    data={"path": "gcodes"},
                    timeout=120.0,
                )
            resp.raise_for_status()

            # 2. Druck starten
            resp = await c.post(
                "/printer/print/start",
                json={"filename": filename},
            )
            resp.raise_for_status()

    async def pause(self) -> None:
        async with self._client() as c:
            (await c.post("/printer/print/pause")).raise_for_status()

    async def resume(self) -> None:
        async with self._client() as c:
            (await c.post("/printer/print/resume")).raise_for_status()

    async def cancel(self) -> None:
        async with self._client() as c:
            (await c.post("/printer/print/cancel")).raise_for_status()
