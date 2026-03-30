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

## OrcaSlicer 2.x CLI — vollständig dokumentiert

### Korrekter Befehl

```bash
xvfb-run -a orca-slicer \
  --load-settings "machine.json;process.json;overrides.json" \
  --load-filaments "filament.json" \
  --allow-newer-file \
  --slice 1 \
  --outputdir /tmp/out \
  input.stl
```

### Kritische Regeln

- **Kein `--set`** — existiert nicht in OrcaSlicer (PrusaSlicer-Syntax)
- **Kein `-o`** — Ausgabe geht nach `--outputdir`, Datei heißt automatisch `plate_1.gcode`
- **`compatible_printers`** in process/filament JSON muss **exakt** dem `"name"`-Feld in machine.json entsprechen (String-Vergleich, kein Fuzzy-Match) → Fehler -17 sonst
- **`--load-settings`** Reihenfolge: `machine → process → overrides` (letzte hat höchste Priorität)
- **`--allow-newer-file`** verhindert Versions-Mismatch-Fehler
- **`--slice 1`** = Platte 1 (für STL-Dateien immer korrekt); `--slice 0` = alle Platten
- OrcaSlicer schreibt `result.json` ins outputdir: `{"return_code": 0}` bei Erfolg, `{"return_code": -17, "error_string": "..."}` bei Fehler
- Slice-Fehler landen **nicht** in Container-Logs → nur in `job.error` via `GET /slice/<job_id>`

### Fehler-Codes

| Code | Bedeutung | Fix |
|---|---|---|
| 254 | Ungültige CLI-Option | Option prüfen (z.B. kein `--set`, kein `-o`) |
| 251 | Ungültiges Settings-JSON-Format | `type`, `from`, `name`, `version` Felder prüfen |
| 239 | Process nicht kompatibel mit Drucker | `compatible_printers` muss exakt machine `name` enthalten |

### Profil-System

Profile liegen in `/opt/orca-slicer/resources/profiles/{Vendor}/machine|process|filament/*.json`

Profil-JSON benötigt Pflichtfelder:
```json
{
  "type": "process",       // oder "machine" / "filament"
  "from": "user",
  "name": "mein-profil",
  "version": "2.2.0.0",
  "compatible_printers": ["Exakter Maschinenname aus machine.json"]
}
```

API-Endpunkte für Profile:
- `GET /profiles/machines` — alle Maschinen-Profile
- `GET /profiles/processes` — alle Prozess-Profile
- `GET /profiles/filaments` — alle Filament-Profile

---

## Dockerfile — aktuelle System-Libs

Base: `python:3.12-slim-bookworm` (Bookworm nötig wegen `libwebkit2gtk-4.0-37`)

Benötigte Pakete (ermittelt via `ldd ... | grep "not found"`):
- `libgtk-3-0`, `libegl1`, `libegl-mesa0`, `libgl1`, `libglu1-mesa`
- `libwebkit2gtk-4.0-37` (zieht `libjavascriptcoregtk-4.0-18` als Dep mit)
- `libgstreamer1.0-0`, `libgstreamer-plugins-base1.0-0`
- `libcurl4`, `libdbus-1-3`
- `xvfb`, `xauth`, `wget`, `ca-certificates`

Symlink muss auf `AppRun` zeigen (nicht auf `bin/orca-slicer`):
```dockerfile
ln -s /opt/orca-slicer/AppRun /usr/local/bin/orca-slicer
```
AppRun setzt LD_LIBRARY_PATH auf gebündelte Libs — direkter Binary-Aufruf umgeht das.

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

## Gelöste Probleme (chronologisch)

1. Volume-Pfad `volume1` → `volume2`
2. data/uploads + data/gcodes fehlend → ins Repo aufgenommen
3. config.json fehlt beim Start → auto-create
4. bind-mount → named volume (Portainer-Kompatibilität)
5. UPLOADS_DIR Pfad falsch im slice router
6. Symlink auf `bin/orca-slicer` → auf `AppRun` geändert
7. `libwebkit2gtk-4.0-37` fehlte (via ldd ermittelt)
8. Base-Image auf `bookworm` gepinnt (`libwebkit2gtk-4.0-37` nicht in Trixie)
9. `--set` existiert nicht → temporäre JSON + `--load-settings`
10. `-o` existiert nicht → `--outputdir` + automatischer Dateiname
11. `compatible_printers` muss exakt machine `name` matchen → Fehler -17

## Nächster Schritt

Pull and redeploy in Portainer, dann Slice mit Maschinen- + Prozess- + Filament-Profil testen.
Falls Generic-Profile in Dropdowns fehlen: Profilstruktur im Container prüfen:
```bash
sudo docker exec <container> find /opt/orca-slicer/resources/profiles -maxdepth 3 -name "*.json" | head -40
```
