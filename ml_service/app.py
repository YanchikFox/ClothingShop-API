from __future__ import annotations

import logging
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException

from .catalog_loader import CatalogLoaderError, load_catalog
from .models import CatalogResponse, ServiceSettings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ML Service", version="1.0.0")


@lru_cache
def get_settings() -> ServiceSettings:
    return ServiceSettings()


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Simple health-check endpoint used for readiness probes."""

    return {"status": "ok"}


@app.get("/catalog", response_model=CatalogResponse)
async def catalog_endpoint(settings: ServiceSettings = Depends(get_settings)) -> CatalogResponse:
    """Expose the loaded catalog via HTTP for troubleshooting and integrations."""

    try:
        catalog = load_catalog(settings=settings)
    except CatalogLoaderError as exc:
        logger.error("Catalog loading failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return CatalogResponse(
        products=catalog.products,
        total_products=len(catalog.products),
        source=catalog.source or "unknown",
    )
