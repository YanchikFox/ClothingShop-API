"""Utility script to build product similarity neighbours.

This script loads the product catalog using the existing loader and
creates a feature matrix composed of:

* TF-IDF features built from the product title, description, brand and category
* One-hot encoded categorical features for category, brand and price bin

After building and normalising the features, cosine similarity is computed and
for each product the top-N neighbours are stored in ``product_neighbors.json``.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import OneHotEncoder, normalize

from .catalog_loader import CatalogLoaderError, load_catalog
from .models import Product, ServiceSettings

logger = logging.getLogger(__name__)

DEFAULT_TOP_K = 50
NEIGHBORS_FILE = Path(__file__).with_name("product_neighbors.json")


def _products_to_dataframe(products: Iterable[Product]) -> pd.DataFrame:
    """Convert raw product models into a pandas DataFrame."""

    records: List[Dict[str, Any]] = []
    for product in products:
        data = product.model_dump() if hasattr(product, "model_dump") else product.dict()
        records.append(data)

    frame = pd.DataFrame(records)
    if frame.empty:
        raise ValueError("No products available for feature generation")
    return frame


def _compose_text_features(row: pd.Series) -> str:
    parts = [
        row.get("name") or row.get("title") or "",
        row.get("description") or "",
        row.get("brand") or "",
        row.get("category")
        or row.get("category_id")
        or row.get("categoryId")
        or row.get("gender")
        or "",
    ]
    return " ".join(str(part) for part in parts if part)


def _assign_price_bins(prices: pd.Series, n_bins: int = 5) -> pd.Series:
    numeric = pd.to_numeric(prices, errors="coerce")
    if numeric.notna().sum() < 2:
        # All values identical or missing.
        return pd.Series(
            ["bin_single" if not np.isnan(value) else "missing" for value in numeric],
            index=prices.index,
        )

    try:
        bins = pd.qcut(numeric, q=min(n_bins, numeric.nunique()), duplicates="drop")
    except ValueError:
        bins = pd.cut(numeric, bins=n_bins)

    labels = bins.astype(str)
    labels = labels.fillna("missing")
    labels[numeric.isna()] = "missing"
    return labels


def build_feature_matrix(frame: pd.DataFrame) -> sparse.csr_matrix:
    start = time.perf_counter()

    text_corpus = frame.apply(_compose_text_features, axis=1)
    tfidf = TfidfVectorizer(min_df=1, ngram_range=(1, 2))
    tfidf_matrix = tfidf.fit_transform(text_corpus)
    logger.info("TF-IDF matrix shape: %s", tfidf_matrix.shape)

    frame = frame.copy()
    frame["price_bin"] = _assign_price_bins(frame.get("price"))

    categorical = frame[["brand", "category_id", "price_bin"]].fillna("unknown")
    encoder = OneHotEncoder(sparse=True, handle_unknown="ignore", dtype=np.float32)
    categorical_matrix = encoder.fit_transform(categorical)
    logger.info("Categorical matrix shape: %s", categorical_matrix.shape)

    feature_matrix = sparse.hstack([tfidf_matrix, categorical_matrix]).tocsr()
    feature_matrix = normalize(feature_matrix, norm="l2")

    elapsed = time.perf_counter() - start
    logger.info(
        "Feature matrix built with shape %s and %s non-zero values in %.2f seconds",
        feature_matrix.shape,
        feature_matrix.nnz,
        elapsed,
    )
    return feature_matrix


def compute_neighbors(
    feature_matrix: sparse.csr_matrix, top_k: int = DEFAULT_TOP_K
) -> List[List[Dict[str, float]]]:
    logger.info("Computing cosine similarity for %s products", feature_matrix.shape[0])
    start = time.perf_counter()

    similarity = feature_matrix @ feature_matrix.T
    similarity = similarity.tocsr()
    similarity.setdiag(0)

    neighbors: List[List[Dict[str, float]]] = []
    for idx in range(similarity.shape[0]):
        row = similarity.getrow(idx)
        if row.nnz == 0:
            neighbors.append([])
            continue
        sorted_idx = np.argsort(row.data)[::-1][:top_k]
        top_indices = row.indices[sorted_idx]
        top_scores = row.data[sorted_idx]
        neighbors.append(
            [
                {"index": int(neighbor_idx), "score": float(score)}
                for neighbor_idx, score in zip(top_indices, top_scores)
            ]
        )

    elapsed = time.perf_counter() - start
    logger.info("Computed neighbours in %.2f seconds", elapsed)
    return neighbors


def save_neighbors(
    products: List[Product],
    neighbors: List[List[Dict[str, float]]],
    output_path: Path,
) -> None:
    product_ids = [str(prod.id) for prod in products]
    mapping: Dict[str, List[Dict[str, float]]] = {}

    for product_id, row_neighbors in zip(product_ids, neighbors):
        formatted = []
        for neighbor in row_neighbors:
            neighbor_id = product_ids[neighbor["index"]]
            formatted.append({"product_id": neighbor_id, "score": neighbor["score"]})
        mapping[product_id] = formatted

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fp:
        json.dump(mapping, fp, ensure_ascii=False, indent=2)
    logger.info("Saved neighbours for %s products to %s", len(mapping), output_path)


def build_product_neighbors(top_k: int = DEFAULT_TOP_K, output_path: Path = NEIGHBORS_FILE) -> None:
    settings = ServiceSettings()
    try:
        catalog = load_catalog(settings=settings)
    except CatalogLoaderError as exc:
        logger.error("Failed to load catalog: %s", exc)
        raise

    products = catalog.products
    logger.info("Loaded %s products for neighbour computation", len(products))

    frame = _products_to_dataframe(products)
    feature_matrix = build_feature_matrix(frame)
    neighbors = compute_neighbors(feature_matrix, top_k=top_k)
    save_neighbors(products, neighbors, output_path)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    build_product_neighbors()
