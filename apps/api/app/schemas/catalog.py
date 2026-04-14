from decimal import Decimal

from pydantic import BaseModel

from app.schemas.common import ORMModel, TimestampedModel


class CategoryBase(BaseModel):
    name: str
    slug: str
    description: str | None = None
    status: str = "active"


class CategoryRead(TimestampedModel, CategoryBase):
    pass


class BrandBase(BaseModel):
    name: str
    slug: str
    description: str | None = None
    website: str | None = None
    status: str = "active"


class BrandRead(TimestampedModel, BrandBase):
    pass


class ProductImagePayload(BaseModel):
    image: str
    alt: str | None = None
    sort_order: int = 0


class ProductBase(BaseModel):
    category_id: int
    brand_id: int
    name: str
    slug: str
    sku: str
    short_description: str | None = None
    description: str
    price: Decimal
    compare_at_price: Decimal | None = None
    stock: int
    status: str = "active"
    seo_title: str | None = None
    seo_description: str | None = None
    meta_keywords: str | None = None


class ProductCreate(ProductBase):
    images: list[ProductImagePayload] = []


class ProductUpdate(ProductCreate):
    pass


class ProductImageRead(TimestampedModel, ProductImagePayload):
    id: int


class ProductRead(TimestampedModel, ProductBase):
    category: CategoryRead
    brand: BrandRead
    images: list[ProductImageRead]


class ProductListItem(ORMModel):
    id: int
    name: str
    slug: str
    short_description: str | None
    price: Decimal
    compare_at_price: Decimal | None
    stock: int
    status: str
    seo_title: str | None
    seo_description: str | None
    category: CategoryRead
    brand: BrandRead
    images: list[ProductImageRead]
