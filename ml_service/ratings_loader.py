from __future__ import annotations

import logging
from typing import Optional

import pandas as pd
import psycopg2
import requests

from models import ServiceSettings

logger = logging.getLogger(__name__)


def _load_from_database(database_url: str) -> pd.DataFrame:
    logger.info("Loading ratings from database")
    with psycopg2.connect(database_url) as connection:
        query = "SELECT user_id, product_id, rating FROM ratings"
        frame = pd.read_sql_query(query, connection)
    return frame


def _load_from_api(base_url: str, token: Optional[str], timeout: float) -> pd.DataFrame:
    url = f"{base_url.rstrip('/')}/ratings/export"
    logger.info("Loading ratings from API %s", url)
    headers = {}
    if token:
        headers["x-export-token"] = token
    response = requests.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()
    payload = response.json()

    records = []
    if isinstance(payload, list):
        for item in payload:
            if not isinstance(item, dict):
                continue
            user_id = item.get("userId")
            product_id = item.get("productId")
            rating = item.get("rating")
            if user_id is None or product_id is None or rating is None:
                continue
            records.append({
                "user_id": user_id,
                "product_id": product_id,
                "rating": rating,
            })

    return pd.DataFrame.from_records(records, columns=["user_id", "product_id", "rating"])


def load_ratings(settings: Optional[ServiceSettings] = None) -> pd.DataFrame:
    settings = settings or ServiceSettings()

    if settings.database_url:
        try:
            frame = _load_from_database(settings.database_url)
            if not frame.empty:
                return frame
            logger.warning("Ratings table in database is empty; falling back to API if configured")
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Failed to load ratings from database: %s", exc)

    if settings.ratings_api_base_url:
        try:
            frame = _load_from_api(
                settings.ratings_api_base_url,
                settings.ratings_api_token,
                settings.ratings_request_timeout,
            )
            return frame
        except requests.RequestException as exc:
            logger.warning("Failed to load ratings from API: %s", exc)

    logger.info("No ratings source available; returning empty dataset")
    return pd.DataFrame(columns=["user_id", "product_id", "rating"])
