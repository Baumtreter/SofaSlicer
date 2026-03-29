"""
Liest verfügbare OrcaSlicer-Profile aus dem installierten AppImage.
Struktur: /opt/orca-slicer/resources/profiles/{Vendor}/machine|filament/*.json
"""
from pathlib import Path

ORCA_PROFILES = Path("/opt/orca-slicer/resources/profiles")


def _scan(category: str) -> list[dict]:
    if not ORCA_PROFILES.exists():
        return []
    results = []
    for vendor_dir in sorted(ORCA_PROFILES.iterdir()):
        if not vendor_dir.is_dir():
            continue
        cat_dir = vendor_dir / category
        if not cat_dir.is_dir():
            continue
        for f in sorted(cat_dir.glob("*.json")):
            results.append({
                "vendor": vendor_dir.name,
                "name": f.stem,
                "path": str(f),
            })
    return results


def list_machine_profiles() -> list[dict]:
    return _scan("machine")


def list_filament_profiles() -> list[dict]:
    return _scan("filament")
