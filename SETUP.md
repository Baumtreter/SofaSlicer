# SofaSlicer Setup

## Voraussetzungen

- Docker + Docker Compose auf dem NAS
- NAS, Drucker und Handy/Tablet im selben Heimnetz
- NAS-IP ist fix (DHCP-Reservierung empfohlen)

---

## Drucker konfigurieren

Öffne `data/config.json` und ersetze die Platzhalter:

### Bambu Lab P1S

| Wert | Wo finden |
|---|---|
| `host` | Drucker-Display → Netzwerk → IP-Adresse |
| `serial` | Drucker-Display → Einstellungen → Geräteinfo → Seriennummer |
| `access_code` | Drucker-Display → Netzwerk → LAN-Modus → Zugangscode |

> LAN-Modus muss am Display aktiviert sein.
> Da du noch auf der offenen Firmware bist: einfach einschalten, kein Downgrade nötig.

---

### Creality K1 Max

| Wert | Wo finden |
|---|---|
| `host` | Router-DHCP-Tabelle oder Drucker-Display → Netzwerk |
| `port` | Standard `7125` |
| `moonraker_api_key` | Nur nötig wenn trusted_clients nicht greift (s.u.) |

**Moonraker trusted_clients** — da das Backend mit `network_mode: host` läuft,
kommen Anfragen direkt von der NAS-IP. Diese muss in der Moonraker-Konfiguration
des K1 Max erlaubt sein.

Auf dem K1 Max via SSH (`root@K1MAX_IP`):
```bash
vi /usr/data/printer_data/config/moonraker.conf
```

Unter `[authorization]` die NAS-IP oder das gesamte Heimnetz eintragen:
```ini
[authorization]
trusted_clients:
    192.168.1.0/24    # ← dein Heimnetz-Subnet anpassen
```

Dann Moonraker neu starten:
```bash
systemctl restart moonraker
```

---

## Deployment via Portainer (Synology)

1. Dateien auf das NAS kopieren — z.B. nach `/volume2/docker/sofaslicer/`
   ```bash
   # Von deinem Mac aus:
   scp -r /Users/flo/Documents/codestuff/sofaslicer user@NAS_IP:/volume2/docker/
   ```

2. In Portainer öffnen: `http://NAS_IP:9000`

3. **Stacks → Add Stack**

4. Name: `sofaslicer`

5. **Build method: Upload** → `docker-compose.yml` hochladen
   _(oder "Repository" wenn du es in Git hast)_

6. Unter **Env variables** nichts nötig — alles ist in der config.json

7. **Deploy the stack**

> Beim ersten Start dauert es länger — OrcaSlicer (~300 MB) wird heruntergeladen und extrahiert.

---

## Alternativ: direkt per SSH starten

```bash
ssh user@NAS_IP
cd /volume2/docker/sofaslicer
docker compose up -d
```

| Dienst | Adresse |
|---|---|
| Frontend (Handy/Tablet) | `http://NAS_IP:3000` |
| API | `http://NAS_IP:8000` |
| API-Docs (Swagger) | `http://NAS_IP:8000/docs` |

> Port 80 ist auf Synology DSM reserviert → wir nutzen 3000 für das Frontend.

---

## Verbindung testen

```bash
# P1S Status (von einem Gerät im Heimnetz)
curl http://NAS_IP:8000/printers/p1s-01/state

# K1 Max Status
curl http://NAS_IP:8000/printers/k1max-01/state
```

Erwartete Antwort (Beispiel P1S, Drucker idle):
```json
{
  "printer_id": "p1s-01",
  "status": "idle",
  "hotend_temp": 25.1,
  "bed_temp": 22.8,
  ...
}
```

Wenn `"status": "offline"` zurückkommt, steht im `"message"`-Feld der genaue Fehler.

---

## Drucker via App hinzufügen (alternativ zu config.json)

```bash
# P1S anlegen
curl -X POST http://NAS_IP:8000/printers/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bambu Lab P1S",
    "protocol": "bambu",
    "host": "192.168.1.XXX",
    "serial": "01P00AXXXXXXX",
    "access_code": "XXXXXXXX"
  }'

# K1 Max anlegen
curl -X POST http://NAS_IP:8000/printers/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Creality K1 Max",
    "protocol": "moonraker",
    "host": "192.168.1.YYY"
  }'
```
