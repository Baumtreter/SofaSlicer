from fastapi import APIRouter
from services.profiles import list_machine_profiles, list_filament_profiles

router = APIRouter()


@router.get("/machines")
def get_machines():
    return list_machine_profiles()


@router.get("/filaments")
def get_filaments():
    return list_filament_profiles()
