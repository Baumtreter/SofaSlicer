# SofaSlicer — Projektkontext für Claude

## Projekt

Self-hosted Slicing-Backend: STL-Dateien hochladen → OrcaSlicer CLI sliced sie → G-Code zurück.

**Stack:**
- Backend: FastAPI (Python 3.12), läuft in `python:3.12-slim-bookworm` Docker-Image
- OrcaSlicer v2.2.0 als AppImage, extrahiert via `--appimage-extract` nach `/opt/orca-slicer/`
- xvfb-run für headless-Betrieb (OrcaSlicer ist eine GUI-App)
- Deployment: Synology DS920+ über Portainer Git Stack, Volume auf `volume2`

**Leitprinzip Dockerfile:** Minimaler Footprint — kein apt-Paket ohne konkreten Fehler hinzufügen.

---

## Aktueller Stand (2026-03-30, Session 3)

### Was komplett funktioniert
- Docker-Image baut + läuft (python:3.12-slim-bookworm, alle nötigen Libs)
- OrcaSlicer AppImage headless via xvfb-run + AppRun-Symlink
- Backend-API: Upload, Slice, G-Code-Download, Drucker-Verwaltung (Netzwerk)
- **Profil-System Backend + Frontend komplett (Session 2+3):**
  - `GET /setup/printers/available` — Vendor-Liste vom OrcaSlicer GitHub-Repo
  - `GET /setup/printers/available/{vendor}` — Machine-JSONs für einen Vendor
  - `POST /setup/printers` — Drucker hinzufügen: Profile werden im Hintergrund heruntergeladen
  - `GET /setup/printers` — Eingerichtete Drucker auflisten
  - `GET /setup/printers/{id}/profiles` — Verfügbare process/filament-Dateien
  - `DELETE /setup/printers/{id}` — Drucker + Profile entfernen
- **Frontend komplett auf neues System umgestellt (Session 3):**
  - PrintersPage: Tab "Profil-Drucker" (Vendor → Gerät → Download) + Tab "Netzwerk"
  - SettingsPanel: 3 Dropdowns (Drucker, Druckprofil, Filament)
  - SlicerPage/ActionBar: nutzt printer_id + process_file + filament_file

### Was noch fehlt
1. **Testen auf dem NAS** — Setup-Flow durchspielen (Drucker hinzufügen → slice)
2. **Custom-Profil-Upload** (`POST /setup/printers/custom`) — für K1 Max, U1

---

## Architektur (Profil-System)

### Datenfluss Setup
1. `GET /setup/printers/available` → GitHub API → Vendor-Liste
2. `GET /setup/printers/available/{vendor}` → GitHub API → Machine-JSONs
3. `POST /setup/printers {display_name, vendor, machine_file}` → Download startet im Hintergrund
4. Drucker ist bereit wenn `ready: true` (per Polling prüfen)

### Datenfluss Slicing
1. STL hochladen → `POST /files/` → Filename zurück
2. `GET /setup/printers/{id}/profiles` → verfügbare process/filament Dateien
3. `POST /slice/ {filename, params: {printer_id, process_file, filament_file}}`
4. `GET /slice/{job_id}` → Status + G-Code

### Profil-Storage
```
/data/printers/{printer_id}/
  machine/    ← genau eine JSON (die beim Setup gewählte)
  process/    ← alle process JSONs des Vendors
  filament/   ← alle filament JSONs des Vendors (Root-Ebene)
```

### Config
`/data/config.json` enthält zwei Drucker-Listen:
- `printers` — Netzwerk-Drucker (IP, Protokoll für G-Code-Übertragung)
- `setup_printers` — OrcaSlicer-Profil-Drucker (vendor, machine_file, ready-Flag)

---

## OrcaSlicer 2.x CLI — vollständig dokumentiert

### Korrekter Befehl

```bash
xvfb-run -a orca-slicer \
  --load-settings "machine.json;process.json" \
  --load-filaments "filament.json" \
  --allow-newer-file \
  --slice 1 \
  --outputdir /tmp/out \
  input.stl
```

### Kritische Regeln

- **Kein `--set`** — existiert nicht in OrcaSlicer (PrusaSlicer-Syntax)
- **Kein `-o`** — Ausgabe geht nach `--outputdir`, Datei heißt automatisch `plate_1.gcode`
- **`compatible_printers`** in process/filament JSON muss **exakt** dem `"name"`-Feld in machine.json entsprechen → Fehler -17 sonst. Offizielle Profile haben das bereits korrekt gesetzt.
- **`--load-settings`** Reihenfolge: `machine → process` (letzte hat höchste Priorität)
- **`--allow-newer-file`** verhindert Versions-Mismatch-Fehler
- **`--slice 1`** = Platte 1 (für STL-Dateien immer korrekt)
- OrcaSlicer schreibt `result.json` ins outputdir: `{"return_code": 0}` bei Erfolg
- Slice-Fehler landen **nicht** in Container-Logs → nur in `job.error` via `GET /slice/<job_id>`

### Fehler-Codes

| Code | Bedeutung | Fix |
|---|---|---|
| -5  | Ungültiges Profil-JSON-Format | Profile aus offiziellem Repo verwenden, nicht selbst generieren |
| 254 | Ungültige CLI-Option | Option prüfen (z.B. kein `--set`, kein `-o`) |
| 251 | Ungültiges Settings-JSON-Format | `type`, `from`, `name`, `version` Felder prüfen |
| -17 / 239 | Process nicht kompatibel mit Drucker | `compatible_printers` muss exakt machine `name` enthalten |

---

## GitHub-Profil-Repo Struktur

```
https://github.com/SoftFever/OrcaSlicer/tree/main/resources/profiles/
  {Vendor}/
    machine/   ← z.B. "Bambu Lab P1S.json"
    process/   ← z.B. "0.20mm Standard @BBL P1S.json"
    filament/  ← z.B. "Bambu PLA @BBL P1S.json"
```

Wichtige Vendor-Namen:
- Bambu Lab → `BBL`
- Creality → `Creality`
- Snapmaker → `Snapmaker`

---

## Flös Drucker
- Bambu Lab P1S — Vendor: `BBL`, machine: `Bambu Lab P1S.json`
- Bambu Lab A1 — Vendor: `BBL`, machine: `Bambu Lab A1.json`
- Creality K1 Max — Custom-Profil (noch kein Upload-Endpoint!)
- Snapmaker U1 — Vendor: `Snapmaker`, alternativ Custom-Profil
- Creality Ender-3 — Vendor: `Creality`

---

## Dockerfile — aktuelle System-Libs

Base: `python:3.12-slim-bookworm` (Bookworm nötig wegen `libwebkit2gtk-4.0-37`)

Benötigte Pakete:
- `libgtk-3-0`, `libegl1`, `libegl-mesa0`, `libgl1`, `libglu1-mesa`
- `libwebkit2gtk-4.0-37` (zieht `libjavascriptcoregtk-4.0-18` als Dep mit)
- `libgstreamer1.0-0`, `libgstreamer-plugins-base1.0-0`
- `libcurl4`, `libdbus-1-3`
- `xvfb`, `xauth`, `wget`, `ca-certificates`

Symlink muss auf `AppRun` zeigen:
```dockerfile
ln -s /opt/orca-slicer/AppRun /usr/local/bin/orca-slicer
```

---

## Portainer-Deployment

**Problem:** Portainer "Dockerfile Upload" = kein Build-Kontext → `COPY requirements.txt` schlägt fehl.
**Lösung:** Git Stack verwenden (Portainer → Stack → Repository → Branch main).

Alternativ SCP + SSH:
```bash
scp -r /Users/flo/Documents/codestuff/sofaslicer user@NAS_IP:/volume2/docker/
ssh user@NAS_IP "cd /volume2/docker/sofaslicer && sudo docker compose build --no-cache && sudo docker compose up -d"
```

SSH braucht `sudo` für docker-Befehle (User nicht in docker-Gruppe).

---

## Fehlerdiagnose

- Slice-Fehler: `GET http://NAS_IP:8000/slice/<job_id>` → Feld `"error"`
- Fehlende Libs prüfen: `sudo docker exec <container> bash -c "LD_LIBRARY_PATH=/opt/orca-slicer/lib ldd /opt/orca-slicer/bin/orca-slicer | grep 'not found'"`
- Portainer Console funktioniert nicht mit `python:3.12-slim` → SSH + docker exec verwenden

---

## Nächster Schritt (nächste Session)

**Priorität 1 — Testen auf dem NAS:**
- Portainer: Stack neu deployen (Pull + Redeploy)
- Unter "Drucker" → "Profil-Drucker" → Drucker einrichten (z.B. BBL → Bambu Lab P1S.json)
- Warten bis "Bereit" erscheint (Profile werden heruntergeladen)
- Unter "Slicer": STL hochladen, Drucker/Profil/Filament wählen → Slicen

**Priorität 2 — Custom-Profil-Upload:**
- `POST /setup/printers/custom` — ZIP oder einzelne JSONs hochladen
- Für K1 Max und evtl. U1
