from models.printer import Printer, PrinterProtocol
from services.printers.base import PrinterBackend
from services.printers.moonraker import MoonrakerBackend
from services.printers.bambu import BambuBackend


def get_backend(printer: Printer) -> PrinterBackend:
    if printer.protocol == PrinterProtocol.moonraker:
        return MoonrakerBackend(printer)
    if printer.protocol == PrinterProtocol.bambu:
        return BambuBackend(printer)
    raise ValueError(f"Unbekanntes Protokoll: {printer.protocol}")
