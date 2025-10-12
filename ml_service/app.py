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

app = FastAPI(title="ML Service", version="1.0.0")

_recommendations_cache: Dict[str, object] = {"mtime": None, "data": {}}


@lru_cache
def get_settings() -> ServiceSettings:
    return ServiceSettings()


@lru_cache
def get_neighbors_map() -> Dict[str, List[Dict[str, float]]]:
    settings = get_settings()
    path = Path(settings.fallback_neighbors_path)
    if not path.exists():
        logger.warning("Neighbour file %s not found; returning empty mapping", path)
        return {}

    try:
        with path.open("r", encoding="utf-8") as fp:
            payload = json.load(fp)
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("Failed to load neighbours from %s: %s", path, exc)
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


def _load_recommendations() -> Dict[str, List[Dict[str, float]]]:
    settings = get_settings()
    path = Path(settings.recommendations_output_path)

    try:
        mtime = path.stat().st_mtime
    except OSError:
        return {}

    cache_mtime = _recommendations_cache.get("mtime")
    if cache_mtime == mtime:
        cached = _recommendations_cache.get("data")
        if isinstance(cached, dict):
            return cached  # type: ignore[return-value]

    try:
        with path.open("r", encoding="utf-8") as fp:
            payload = json.load(fp)
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("Failed to load personalized recommendations: %s", exc)
        return {}

    users_obj = payload.get("users") if isinstance(payload, dict) else None
    recommendations: Dict[str, List[Dict[str, float]]] = {}
    if isinstance(users_obj, dict):
        for key, value in users_obj.items():
            if not isinstance(value, list):
                continue
            cleaned: List[Dict[str, float]] = []
            for item in value:
                if not isinstance(item, dict):
                    continue
                product_id = item.get("product_id") or item.get("productId")
                score = item.get("score")
                if product_id is None or score is None:
                    continue
                try:
                    cleaned.append({"product_id": str(product_id), "score": float(score)})
                except (TypeError, ValueError):
                    continue
            if cleaned:
                recommendations[str(key)] = cleaned

    _recommendations_cache["mtime"] = mtime
    _recommendations_cache["data"] = recommendations
    logger.info("Loaded personalized recommendations for %s users", len(recommendations))
    return recommendations


def _build_fallback(neighbours: Dict[str, List[Dict[str, float]]], limit: int) -> List[Dict[str, float]]:
    scores: Dict[str, float] = {}
    for items in neighbours.values():
        for item in items:
            product_id = str(item.get("product_id"))
            if not product_id:
                continue
            try:
                score = float(item.get("score", 0.0))
            except (TypeError, ValueError):
                score = 0.0
            if product_id not in scores or score > scores[product_id]:
                scores[product_id] = score

    ranked = sorted(scores.items(), key=lambda entry: entry[1], reverse=True)
    return [{"product_id": product_id, "score": score} for product_id, score in ranked[:limit]]


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


@app.get("/recs/personalized")
async def personalized_recommendations(
    user_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1),
    neighbours: Dict[str, List[Dict[str, float]]] = Depends(get_neighbors_map),
) -> List[Dict[str, float]]:
    """Return personalized recommendations for a specific user."""

    if not user_id:
        return []

    recommendations = _load_recommendations()
    items = recommendations.get(str(user_id))
    if items:
        return items[:limit]

    fallback = _build_fallback(neighbours, limit)
    if fallback:
        logger.info("Fallback recommendations returned for user %s", user_id)
    return fallback
