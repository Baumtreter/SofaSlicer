"""
GitHub-Profil-Discovery für OrcaSlicer.

Lädt Drucker-Profile direkt aus dem offiziellen OrcaSlicer GitHub-Repo:
  https://github.com/SoftFever/OrcaSlicer/tree/main/resources/profiles

Struktur im Repo:
  resources/profiles/{Vendor}/machine/*.json
  resources/profiles/{Vendor}/process/*.json
  resources/profiles/{Vendor}/filament/*.json
"""
import asyncio
from pathlib import Path

import httpx

REPO = "SoftFever/OrcaSlicer"
PROFILES_PATH = "resources/profiles"
GITHUB_API = "https://api.github.com"
RAW_BASE = f"https://raw.githubusercontent.com/{REPO}/main"
API_HEADERS = {"Accept": "application/vnd.github.v3+json", "User-Agent": "SofaSlicer/1.0"}


async def list_vendors() -> list[dict]:
    """
    Gibt alle Vendor-Ordner aus dem OrcaSlicer-Profil-Repo zurück.
    Jedes Dict: {"name": "BBL", "display_name": "BBL"}
    """
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get(
            f"{GITHUB_API}/repos/{REPO}/contents/{PROFILES_PATH}",
            headers=API_HEADERS,
            timeout=15,
        )
        r.raise_for_status()
        return [
            {"name": item["name"]}
            for item in r.json()
            if item["type"] == "dir"
        ]


async def list_machines(vendor: str) -> list[str]:
    """
    Gibt alle Machine-JSON-Dateinamen für einen Vendor zurück.
    z.B. ["Bambu Lab P1S.json", "Bambu Lab A1.json", ...]
    """
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get(
            f"{GITHUB_API}/repos/{REPO}/contents/{PROFILES_PATH}/{vendor}/machine",
            headers=API_HEADERS,
            timeout=15,
        )
        r.raise_for_status()
        return [item["name"] for item in r.json() if item["name"].endswith(".json")]


async def _download_one(client: httpx.AsyncClient, url: str, dest: Path) -> None:
    """Lädt eine einzelne Datei herunter und speichert sie."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = await client.get(url, timeout=30, follow_redirects=True)
    r.raise_for_status()
    dest.write_bytes(r.content)


async def download_printer_profiles(
    vendor: str,
    machine_file: str,
    dest_dir: Path,
) -> dict:
    """
    Lädt alle Profile für einen Drucker herunter:
      - Die gewählte machine JSON
      - Alle process JSONs des Vendors
      - Alle filament JSONs des Vendors (nur auf Root-Ebene, keine Unterordner)

    dest_dir: Zielordner, z.B. /data/printers/{printer_id}/

    Gibt {"machine": str, "process_count": int, "filament_count": int} zurück.
    """
    raw_vendor = f"{RAW_BASE}/{PROFILES_PATH}/{vendor}"
    api_vendor = f"{GITHUB_API}/repos/{REPO}/contents/{PROFILES_PATH}/{vendor}"

    async with httpx.AsyncClient(follow_redirects=True) as client:
        # 1. Machine JSON
        machine_dest = dest_dir / "machine" / machine_file
        await _download_one(client, f"{raw_vendor}/machine/{machine_file}", machine_dest)

        # 2. Alle process JSONs auflisten
        process_r = await client.get(
            f"{api_vendor}/process", headers=API_HEADERS, timeout=15
        )
        process_r.raise_for_status()
        process_files = [
            item["name"]
            for item in process_r.json()
            if item["type"] == "file" and item["name"].endswith(".json")
        ]

        # 3. Alle filament JSONs auflisten (nur Root-Ebene)
        filament_r = await client.get(
            f"{api_vendor}/filament", headers=API_HEADERS, timeout=15
        )
        filament_r.raise_for_status()
        filament_files = [
            item["name"]
            for item in filament_r.json()
            if item["type"] == "file" and item["name"].endswith(".json")
        ]

        # 4. Alle Downloads parallel ausführen
        tasks = []
        for name in process_files:
            dest = dest_dir / "process" / name
            tasks.append(_download_one(client, f"{raw_vendor}/process/{name}", dest))
        for name in filament_files:
            dest = dest_dir / "filament" / name
            tasks.append(_download_one(client, f"{raw_vendor}/filament/{name}", dest))

        await asyncio.gather(*tasks)

    return {
        "machine": machine_file,
        "process_count": len(process_files),
        "filament_count": len(filament_files),
    }
