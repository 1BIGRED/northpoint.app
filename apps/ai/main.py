"""northpoint AI service.

FastAPI app exposing /health for monitoring. Future endpoints
(assist-onboarding-field, import-site, chat) land per PHASE_1.md Groups C–E.
"""

from __future__ import annotations

import logging
import time
import tomllib
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("northpoint-ai")

_PYPROJECT = Path(__file__).parent / "pyproject.toml"
with _PYPROJECT.open("rb") as _f:
    VERSION: str = tomllib.load(_f)["project"]["version"]

SERVICE_NAME = "northpoint-ai"
START_TIME = time.monotonic()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger.info("starting %s v%s", SERVICE_NAME, VERSION)
    yield
    logger.info("stopping %s", SERVICE_NAME)


app = FastAPI(title=SERVICE_NAME, version=VERSION, lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": VERSION,
        "uptime_seconds": round(time.monotonic() - START_TIME, 3),
    }
