from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class Product(BaseModel):
    """Represents a single product entry returned by the catalog API."""

    id: Optional[Any] = Field(default=None, description="Primary identifier of the product")
    name: Optional[str] = Field(default=None, description="Human readable product name")
    price: Optional[float] = Field(default=None, description="Unit price of the product")

    class Config:
        extra = "allow"


class Catalog(BaseModel):
    """Container for the list of products returned by the loader."""

    products: List[Product]
    source: Optional[str] = Field(
        default=None,
        description="Indicates which loading strategy was used (all or paginated).",
    )
    raw_payload: Optional[Any] = Field(
        default=None,
        description="Original payload returned by the upstream API, useful for debugging.",
    )


class ServiceSettings(BaseSettings):
    """Runtime configuration for the FastAPI application."""

    catalog_api_base_url: str = Field(
        default="http://localhost:8080",
        env="CATALOG_API_BASE_URL",
        description="Base URL of the upstream catalog API.",
    )
    request_timeout: float = Field(
        default=10.0,
        env="CATALOG_REQUEST_TIMEOUT",
        description="Timeout (in seconds) used for outbound HTTP requests.",
    )
    page_size: int = Field(
        default=100,
        env="CATALOG_PAGE_SIZE",
        description="Number of items fetched per page when pagination is required.",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


class CatalogResponse(BaseModel):
    """Response shape returned by the API layer when exposing the catalog endpoint."""

    products: List[Product]
    total_products: int
    source: str


def parse_product(payload: Dict[str, Any]) -> Product:
    """Convert a dictionary returned by the upstream API into a Product model."""

    try:
        return Product.model_validate(payload)  # type: ignore[attr-defined]
    except AttributeError:
        return Product.parse_obj(payload)


def build_catalog(
    products: List[Product],
    raw_payload: Any = None,
    source: Optional[str] = None,
) -> Catalog:
    """Construct a Catalog DTO from a list of products."""

    return Catalog(products=products, raw_payload=raw_payload, source=source)
