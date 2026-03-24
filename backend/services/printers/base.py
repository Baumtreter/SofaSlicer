from abc import ABC, abstractmethod
from models.printer import Printer, PrinterState


class PrinterBackend(ABC):
    def __init__(self, printer: Printer):
        self.printer = printer

    @abstractmethod
    async def get_state(self) -> PrinterState: ...

    @abstractmethod
    async def upload_and_print(self, gcode_path: str, filename: str) -> None: ...

    @abstractmethod
    async def pause(self) -> None: ...

    @abstractmethod
    async def resume(self) -> None: ...

    @abstractmethod
    async def cancel(self) -> None: ...
