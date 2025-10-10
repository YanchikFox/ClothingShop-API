from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

from fastapi import Depends, FastAPI, HTTPException, Query

from catalog_loader import CatalogLoaderError, load_catalog
from models import CatalogResponse, ServiceSettings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NEIGHBORS_PATH = Path(__file__).with_name("product_neighbors.json")

app = FastAPI(title="ML Service", version="1.0.0")


@lru_cache
def get_settings() -> ServiceSettings:
    return ServiceSettings()


@lru_cache
def get_neighbors_map() -> Dict[str, List[Dict[str, float]]]:
    if not NEIGHBORS_PATH.exists():
        logger.warning("Neighbour file %s not found; returning empty mapping", NEIGHBORS_PATH)
        return {}

    try:
        with NEIGHBORS_PATH.open("r", encoding="utf-8") as fp:
            payload = json.load(fp)
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("Failed to load neighbours from %s: %s", NEIGHBORS_PATH, exc)
        return {}

    neighbours: Dict[str, List[Dict[str, float]]] = {}
    if isinstance(payload, dict):
        for key, value in payload.items():
            if not isinstance(value, list):
                continue
            cleaned: List[Dict[str, float]] = []
            for item in value:
                if not isinstance(item, dict):
                    continue
                neighbour_id = item.get("product_id")
                score = item.get("score")
                if neighbour_id is None or score is None:
                    continue
                try:
                    cleaned.append({"product_id": str(neighbour_id), "score": float(score)})
                except (TypeError, ValueError):
                    continue
            neighbours[str(key)] = cleaned

    logger.info("Loaded neighbours for %s products", len(neighbours))
    return neighbours


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


@app.get("/recs/similar")
async def similar_recommendations(
    product_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1),
    neighbours: Dict[str, List[Dict[str, float]]] = Depends(get_neighbors_map),
) -> List[Dict[str, float]]:
    """Return similar products ranked by cosine similarity."""

    if not product_id:
        return []

    candidates = neighbours.get(str(product_id), [])
    if not candidates:
        return []

    return candidates[:limit]
