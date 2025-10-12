from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List

import numpy as np
from surprise import Dataset, Reader, SVD

from catalog_loader import CatalogLoaderError, load_catalog
from models import ServiceSettings
from ratings_loader import load_ratings

logger = logging.getLogger(__name__)

TOP_N = 20


def _build_product_index(products: Iterable) -> List[str]:
    product_ids: List[str] = []
    for product in products:
        product_id = getattr(product, "id", None)
        if product_id is None:
            continue
        product_ids.append(str(product_id))
    unique_ids = sorted(set(product_ids))
    logger.info("Collected %s unique products for recommendation scoring", len(unique_ids))
    return unique_ids


def _prepare_ratings(frame) -> Dataset | None:
    if frame is None or frame.empty:
        return None

    clean = frame.dropna(subset=["user_id", "product_id", "rating"]).copy()
    if clean.empty:
        return None

    clean["user_id"] = clean["user_id"].astype(str)
    clean["product_id"] = clean["product_id"].astype(str)
    clean["rating"] = clean["rating"].astype(float)

    reader = Reader(rating_scale=(1, 5))
    dataset = Dataset.load_from_df(clean[["user_id", "product_id", "rating"]], reader)
    return dataset


def _train_model(dataset: Dataset):
    trainset = dataset.build_full_trainset()
    algorithm = SVD()
    algorithm.fit(trainset)
    return algorithm, trainset


def _compute_user_recommendations(algorithm, frame, product_ids: List[str]) -> Dict[str, List[Dict[str, float]]]:
    rated_lookup: Dict[str, set[str]] = defaultdict(set)
    for row in frame.itertuples(index=False):
        rated_lookup[str(row.user_id)].add(str(row.product_id))

    recommendations: Dict[str, List[Dict[str, float]]] = {}

    for user_id, rated_products in rated_lookup.items():
        scored: List[tuple[str, float]] = []
        for product_id in product_ids:
            if product_id in rated_products:
                continue
            prediction = algorithm.predict(user_id, product_id)
            score = float(getattr(prediction, "est", 0.0))
            if not np.isfinite(score):
                continue
            scored.append((product_id, score))

        if not scored:
            continue

        scored.sort(key=lambda item: item[1], reverse=True)
        recommendations[user_id] = [
            {"product_id": product_id, "score": round(score, 6)}
            for product_id, score in scored[:TOP_N]
        ]

    logger.info("Computed recommendations for %s users", len(recommendations))
    return recommendations


def _write_payload(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    logger.info("Saved recommendations to %s", path)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = ServiceSettings()
    output_path = Path(settings.recommendations_output_path)

    ratings_frame = load_ratings(settings)
    if ratings_frame.empty:
        logger.warning("No ratings available; writing empty recommendation file")
        _write_payload(output_path, {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "users": {},
            "source": "empty",
        })
        return

    try:
        catalog = load_catalog(settings=settings)
        product_ids = _build_product_index(catalog.products)
    except CatalogLoaderError as exc:
        logger.error("Failed to load catalog: %s", exc)
        product_ids = []

    if not product_ids:
        logger.warning("No products available for recommendation scoring; aborting")
        _write_payload(output_path, {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "users": {},
            "source": "no-products",
        })
        return

    dataset = _prepare_ratings(ratings_frame)
    if dataset is None:
        logger.warning("Ratings dataset is empty after sanitisation; aborting")
        _write_payload(output_path, {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "users": {},
            "source": "empty",
        })
        return

    algorithm, _ = _train_model(dataset)
    recommendations = _compute_user_recommendations(algorithm, ratings_frame, product_ids)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "users": recommendations,
        "source": "svd",
    }
    _write_payload(output_path, payload)


if __name__ == "__main__":
    main()
