from __future__ import annotations

import logging
from typing import Iterable, List, Optional, Sequence, Tuple

import requests
from requests import Session

from .models import Catalog, Product, ServiceSettings, build_catalog, parse_product

logger = logging.getLogger(__name__)


class CatalogLoaderError(RuntimeError):
    """Raised when the catalog cannot be retrieved from the upstream API."""


def _ensure_session(session: Optional[Session] = None) -> Session:
    return session or requests.Session()


def _normalize_payload(payload: object) -> Iterable[dict]:
    if isinstance(payload, dict):
        products_obj = payload.get("products")
        if isinstance(products_obj, Sequence) and not isinstance(products_obj, (str, bytes)):
            return products_obj  # type: ignore[return-value]
        return [payload]
    if isinstance(payload, Sequence) and not isinstance(payload, (str, bytes)):
        return payload  # type: ignore[return-value]
    raise CatalogLoaderError("Unexpected response format received from catalog API")


def _fetch_all_endpoint(session: Session, base_url: str, timeout: float) -> Tuple[List[Product], Optional[object]]:
    url = f"{base_url}/api/products/all"
    logger.debug("Attempting to load catalog from %s", url)
    response = session.get(url, timeout=timeout)

    if response.status_code == 404:
        logger.info("Endpoint %s returned 404, falling back to paginated loading", url)
        return [], None

    response.raise_for_status()
    payload = response.json()
    products = [parse_product(item) for item in _normalize_payload(payload)]
    return products, payload


def _fetch_paginated(
    session: Session,
    base_url: str,
    timeout: float,
    page_size: int,
) -> Tuple[List[Product], Optional[object]]:
    page = 1
    all_products: List[Product] = []
    last_payload: Optional[object] = None

    while True:
        params = {"page": page, "pageSize": page_size}
        url = f"{base_url}/api/products"
        logger.debug("Requesting page %s from %s with params %s", page, url, params)
        response = session.get(url, params=params, timeout=timeout)

        if response.status_code == 404 and page == 1:
            raise CatalogLoaderError(
                "The paginated products endpoint '/api/products' was not found."
            )

        response.raise_for_status()
        payload = response.json()
        items = _normalize_payload(payload)
        batch = [parse_product(item) for item in items]

        if not batch:
            logger.info("No products returned on page %s; assuming end of catalog", page)
            break

        all_products.extend(batch)
        last_payload = payload

        total_pages = None
        if isinstance(payload, dict):
            total_pages = payload.get("totalPages") or payload.get("total_pages")

        if total_pages is not None and page >= int(total_pages):
            break

        if len(batch) < page_size:
            break

        page += 1

    return all_products, last_payload


def load_catalog(
    settings: Optional[ServiceSettings] = None,
    session: Optional[Session] = None,
) -> Catalog:
    """Load the catalog from the upstream API using the provided settings."""

    settings = settings or ServiceSettings()
    session = _ensure_session(session)
    base_url = settings.catalog_api_base_url.rstrip("/")

    try:
        products, raw_payload = _fetch_all_endpoint(session, base_url, settings.request_timeout)

        if products:
            source = "all"
        else:
            products, raw_payload = _fetch_paginated(
                session,
                base_url,
                timeout=settings.request_timeout,
                page_size=settings.page_size,
            )
            source = "paginated"

        if not products:
            raise CatalogLoaderError("Catalog API returned an empty dataset")

        catalog = build_catalog(products=products, raw_payload=raw_payload, source=source)
        logger.info("Loaded %s products from the catalog API using %s strategy", len(products), source)
        return catalog
    except requests.RequestException as exc:
        logger.exception("Failed to load catalog: %s", exc)
        raise CatalogLoaderError(str(exc)) from exc
