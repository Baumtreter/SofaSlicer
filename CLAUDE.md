# SofaSlicer — Projektkontext für Claude

## Projekt

Self-hosted Slicing-Backend: STL-Dateien hochladen → OrcaSlicer CLI sliced sie → G-Code zurück.

**Stack:**
- Backend: FastAPI (Python 3.12), läuft in `python:3.12-slim` Docker-Image
- OrcaSlicer v2.2.0 als AppImage, extrahiert via `--appimage-extract` nach `/opt/orca-slicer/`
- xvfb-run für headless-Betrieb (OrcaSlicer ist eine GUI-App)
- Deployment: Synology DS920+ über Portainer Git Stack, Volume auf `volume2`

**Leitprinzip Dockerfile:** Minimaler Footprint — kein apt-Paket ohne konkreten Fehler hinzufügen.

---

## Bisheriger Fortschritt (Stand 2026-03-29)

### Problem-Kette: OrcaSlicer AppImage in schlankem Container

Das AppImage bündelt die meisten seiner Abhängigkeiten selbst. **`AppRun`** setzt dabei `LD_LIBRARY_PATH` auf die gebündelten Libs, bevor das eigentliche Binary startet. Ein direkter Symlink auf `bin/orca-slicer` umgeht diesen Schritt → führt zu einer endlosen Kette fehlender System-Libs (libglib, libGL, libgstreamer, …).

### Gelöste Fehler (chronologisch)

1. **Volume-Pfad falsch** → `volume1` → `volume2` korrigiert
2. **data/uploads + data/gcodes fehlend** → Verzeichnisse ins Repo aufgenommen
3. **config.json nicht vorhanden beim ersten Start** → auto-create on startup
4. **bind-mount → named volume** → Portainer Git Stack Kompatibilität
5. **UPLOADS_DIR Pfad falsch** in slice router
6. **`libEGL.so.1` fehlt** → Symlink fälschlicherweise auf `bin/orca-slicer` gesetzt, libegl1 + alle GTK/X11-Libs als System-Pakete installiert — **falscher Ansatz**
7. **`libgstreamer-1.0.so.0` fehlt** → Auslöser der Erkenntnis: direkter Binary-Symlink ist das eigentliche Problem

### Aktueller Stand (commit `1b74ff9` + Dockerfile-Update)

**Fix:** Symlink zeigt auf `AppRun` (nicht auf `bin/orca-slicer`):
```dockerfile
ln -s /opt/orca-slicer/AppRun /usr/local/bin/orca-slicer
```

Das Dockerfile enthält aktuell präventiv mehr Libs als das CLAUDE.md-Minimum, weil Slice-Fehler durch fehlende Libs auftraten und das Log dazu noch aussteht:
- `libgtk-3-0`, `libegl1`, `libegl-mesa0`, `libgl1`, `libglu1-mesa`
- `libgstreamer1.0-0`, `libgstreamer-plugins-base1.0-0`
- `libcurl4`, `libdbus-1-3`
- `xvfb`, `xauth`, `wget`, `ca-certificates`

### Kritisch: Portainer-Build-Methode

**Problem:** Portainer "Dockerfile Upload" lädt NUR das Dockerfile hoch — kein Build-Kontext. `COPY requirements.txt .` schlägt deshalb mit "file not found" fehl.

**Lösung (eine davon wählen):**

Option A — SCP + SSH auf dem NAS (empfohlen, funktioniert sicher):
```bash
scp -r /Users/flo/Documents/codestuff/sofaslicer user@NAS_IP:/volume2/docker/
ssh user@NAS_IP
cd /volume2/docker/sofaslicer
docker compose build --no-cache
docker compose up -d
```

Option B — Portainer Git Stack: Repo in Git pushen → Portainer "Repository" als Build-Methode wählen → ganzer Kontext verfügbar.

### OrcaSlicer 2.2.0 CLI — wichtige Erkenntnisse

- **Kein `--set`** (PrusaSlicer-Syntax, existiert nicht in OrcaSlicer)
- **Kein `-o`** für Ausgabedatei → stattdessen `--outputdir <verzeichnis>`
- **`--slice 0`** = alle Platten (0 = all, i = Platte i)
- Parameter-Overrides: temporäre JSON-Datei + `--load-settings`
- OrcaSlicer-Parameternamen: `wall_loops`, `sparse_infill_density`, `sparse_infill_pattern`, `enable_support`, `nozzle_temperature` (Liste!), `outer_wall_speed`
- Korrekter Aufruf: `xvfb-run -a orca-slicer --load-settings overrides.json --slice 0 --outputdir /tmp/out input.stl`
- Output-Datei wird automatisch benannt → im outputdir nach `*.gcode` suchen
- Slice-Fehler tauchen **nicht** in Container-Logs auf → nur in `job.error` via `GET /slice/<job_id>`

### Nächster Schritt

Slice testen. Falls erneut ein Fehler: `GET http://NAS_IP:8000/slice/<job_id>` → Feld `"error"` zeigen.
