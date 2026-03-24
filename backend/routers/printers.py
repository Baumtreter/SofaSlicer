from fastapi import APIRouter, HTTPException
from models.printer import Printer, PrinterState
from services.printers.factory import get_backend
import config

router = APIRouter()


@router.get("/", response_model=list[Printer])
async def list_printers():
    return config.get_printers()


@router.post("/", response_model=Printer, status_code=201)
async def add_printer(printer: Printer):
    config.save_printer(printer)
    return printer


@router.put("/{printer_id}", response_model=Printer)
async def update_printer(printer_id: str, printer: Printer):
    if not config.get_printer(printer_id):
        raise HTTPException(404, "Drucker nicht gefunden")
    printer.id = printer_id
    config.save_printer(printer)
    return printer


@router.delete("/{printer_id}", status_code=204)
async def delete_printer(printer_id: str):
    if not config.delete_printer(printer_id):
        raise HTTPException(404, "Drucker nicht gefunden")


@router.get("/{printer_id}/state", response_model=PrinterState)
async def get_printer_state(printer_id: str):
    printer = config.get_printer(printer_id)
    if not printer:
        raise HTTPException(404, "Drucker nicht gefunden")
    backend = get_backend(printer)
    return await backend.get_state()


@router.post("/{printer_id}/pause", status_code=204)
async def pause(printer_id: str):
    printer = config.get_printer(printer_id)
    if not printer:
        raise HTTPException(404, "Drucker nicht gefunden")
    await get_backend(printer).pause()


@router.post("/{printer_id}/resume", status_code=204)
async def resume(printer_id: str):
    printer = config.get_printer(printer_id)
    if not printer:
        raise HTTPException(404, "Drucker nicht gefunden")
    await get_backend(printer).resume()


@router.post("/{printer_id}/cancel", status_code=204)
async def cancel(printer_id: str):
    printer = config.get_printer(printer_id)
    if not printer:
        raise HTTPException(404, "Drucker nicht gefunden")
    await get_backend(printer).cancel()
