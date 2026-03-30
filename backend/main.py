from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routers import printers, slice, files, profiles, setup


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Verzeichnisse + config.json automatisch anlegen
    import config
    config._ensure_dirs()
    config._load()
    yield


app = FastAPI(
    title="SofaSlicer API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(printers.router, prefix="/printers", tags=["Printers"])
app.include_router(slice.router,    prefix="/slice",    tags=["Slice"])
app.include_router(files.router,    prefix="/files",    tags=["Files"])
app.include_router(profiles.router, prefix="/profiles", tags=["Profiles"])
app.include_router(setup.router,    prefix="/setup/printers", tags=["Setup"])


@app.get("/health")
async def health():
    return {"status": "ok"}
