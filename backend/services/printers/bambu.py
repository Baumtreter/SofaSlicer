"""
Bambu Lab LAN-Protokoll Integration (P1S, A1).

Bambu nutzt im lokalen Netz:
  - MQTT über Port 8883 (TLS, kein Zertifikat-Check)
  - FTP über Port 21 für Datei-Upload
  - Username überall: "bblp"
  - Passwort: LAN-Zugangscode (am Drucker-Display unter Netzwerk → LAN)
  - Seriennummer: am Drucker-Display oder Bambu Studio

MQTT Topics:
  Subscribe: device/{serial}/report   ← Druckerstatus
  Publish:   device/{serial}/request  ← Befehle
"""
import asyncio
import ftplib
import json
import ssl
import time
import threading
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt

from models.printer import Printer, PrinterState, PrinterStatus
from services.printers.base import PrinterBackend


class BambuBackend(PrinterBackend):
    def __init__(self, printer: Printer):
        super().__init__(printer)
        if not printer.serial or not printer.access_code:
            raise ValueError("Bambu-Drucker benötigt serial und access_code")
        self._topic_report  = f"device/{printer.serial}/report"
        self._topic_request = f"device/{printer.serial}/request"
        self._last_report: dict[str, Any] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ #
    #  MQTT helpers                                                        #
    # ------------------------------------------------------------------ #

    def _make_client(self) -> mqtt.Client:
        tls_ctx = ssl.create_default_context()
        tls_ctx.check_hostname = False
        tls_ctx.verify_mode = ssl.CERT_NONE

        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.username_pw_set("bblp", self.printer.access_code)
        client.tls_set_context(tls_ctx)
        return client

    def _fetch_report(self, timeout: float = 6.0) -> dict[str, Any]:
        """Verbindet kurz mit MQTT, wartet auf ein Status-Paket, trennt wieder."""
        received: list[dict] = []
        event = threading.Event()

        client = self._make_client()

        def on_connect(c, userdata, flags, reason_code, properties):
            c.subscribe(self._topic_report, qos=0)

        def on_message(c, userdata, msg):
            try:
                received.append(json.loads(msg.payload))
            except Exception:
                pass
            event.set()

        client.on_connect = on_connect
        client.on_message = on_message

        client.connect(self.printer.host, 8883, keepalive=10)
        client.loop_start()
        event.wait(timeout=timeout)
        client.loop_stop()
        client.disconnect()

        return received[0] if received else {}

    def _publish(self, payload: dict) -> None:
        client = self._make_client()
        client.connect(self.printer.host, 8883, keepalive=10)
        client.loop_start()
        time.sleep(0.5)   # kurz warten bis verbunden
        client.publish(self._topic_request, json.dumps(payload), qos=0)
        time.sleep(0.3)
        client.loop_stop()
        client.disconnect()

    # ------------------------------------------------------------------ #
    #  Status                                                              #
    # ------------------------------------------------------------------ #

    async def get_state(self) -> PrinterState:
        try:
            report = await asyncio.to_thread(self._fetch_report)
        except Exception as e:
            return PrinterState(printer_id=self.printer.id, status=PrinterStatus.offline, message=str(e))

        if not report:
            return PrinterState(printer_id=self.printer.id, status=PrinterStatus.offline, message="Kein Status empfangen")

        print_data = report.get("print", {})

        gcode_state = print_data.get("gcode_state", "IDLE")
        status_map = {
            "RUNNING":  PrinterStatus.printing,
            "PAUSE":    PrinterStatus.idle,
            "IDLE":     PrinterStatus.idle,
            "FINISH":   PrinterStatus.idle,
            "FAILED":   PrinterStatus.error,
        }
        status = status_map.get(gcode_state, PrinterStatus.online)

        progress_raw = print_data.get("mc_percent", 0)
        eta          = print_data.get("mc_remaining_time")  # Minuten

        return PrinterState(
            printer_id=self.printer.id,
            status=status,
            hotend_temp=print_data.get("nozzle_temper"),
            hotend_target=print_data.get("nozzle_target_temper"),
            bed_temp=print_data.get("bed_temper"),
            bed_target=print_data.get("bed_target_temper"),
            progress=progress_raw / 100.0 if progress_raw else None,
            filename=print_data.get("subtask_name"),
            eta_seconds=eta * 60 if eta else None,
        )

    # ------------------------------------------------------------------ #
    #  Upload + Druck starten                                              #
    # ------------------------------------------------------------------ #

    async def upload_and_print(self, gcode_path: str, filename: str) -> None:
        path = Path(gcode_path)

        # 1. G-Code via FTP hochladen
        await asyncio.to_thread(self._ftp_upload, path, filename)

        # 2. Druck-Befehl via MQTT
        payload = {
            "print": {
                "sequence_id": str(int(time.time())),
                "command": "project_file",
                "param": f"Metadata/plate_1.gcode",
                "url": f"ftp:///cache/{filename}",
                "bed_type": "auto",
                "timelapse": False,
                "bed_leveling": True,
                "flow_cali": False,
                "vibration_cali": True,
                "layer_inspect": False,
                "use_ams": False,
            }
        }
        await asyncio.to_thread(self._publish, payload)

    def _ftp_upload(self, path: Path, filename: str) -> None:
        with ftplib.FTP() as ftp:
            ftp.connect(self.printer.host, 21, timeout=30)
            ftp.login("bblp", self.printer.access_code)
            ftp.cwd("/cache")
            with open(path, "rb") as f:
                ftp.storbinary(f"STOR {filename}", f)

    # ------------------------------------------------------------------ #
    #  Steuerung                                                           #
    # ------------------------------------------------------------------ #

    async def pause(self) -> None:
        await asyncio.to_thread(self._publish, {
            "print": {"sequence_id": str(int(time.time())), "command": "pause"}
        })

    async def resume(self) -> None:
        await asyncio.to_thread(self._publish, {
            "print": {"sequence_id": str(int(time.time())), "command": "resume"}
        })

    async def cancel(self) -> None:
        await asyncio.to_thread(self._publish, {
            "print": {"sequence_id": str(int(time.time())), "command": "stop"}
        })
