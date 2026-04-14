from pydantic import BaseModel

from app.schemas.common import TimestampedModel


class PageBase(BaseModel):
    name: str
    title: str
    slug: str
    description: str | None = None
    content: str
    seo_title: str | None = None
    seo_description: str | None = None
    status: str = "active"


class PageRead(TimestampedModel, PageBase):
    pass


class BannerBase(BaseModel):
    name: str
    title: str
    slug: str
    description: str | None = None
    image: str
    link: str | None = None
    placement: str
    status: str = "active"


class BannerRead(TimestampedModel, BannerBase):
    pass
