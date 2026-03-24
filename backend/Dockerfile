FROM python:3.12-slim

WORKDIR /app

# System-Abhängigkeiten für OrcaSlicer AppImage + FUSE-less Ausführung
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libglu1-mesa \
    libgbm1 \
    libegl1 \
    libegl-mesa0 \
    libdbus-1-3 \
    libfontconfig1 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libgtk-3-0 \
    libgdk-pixbuf-2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libwayland-client0 \
    libwayland-egl1 \
    xvfb \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# OrcaSlicer AppImage herunterladen und extrahieren
# AppImage kann ohne FUSE direkt extrahiert werden (--appimage-extract)
ARG ORCA_VERSION=2.2.0
RUN wget -q "https://github.com/SoftFever/OrcaSlicer/releases/download/v${ORCA_VERSION}/OrcaSlicer_Linux_V${ORCA_VERSION}.AppImage" \
        -O /tmp/orca.AppImage \
    && chmod +x /tmp/orca.AppImage \
    && cd /tmp && /tmp/orca.AppImage --appimage-extract \
    && mv /tmp/squashfs-root /opt/orca-slicer \
    && ln -s /opt/orca-slicer/bin/orca-slicer /usr/local/bin/orca-slicer \
    && rm /tmp/orca.AppImage

ENV ORCA_SLICER_BIN=/usr/local/bin/orca-slicer

# Python-Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads gcodes profiles

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
