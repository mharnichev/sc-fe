from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import asc, desc, or_, select
from sqlalchemy.orm import joinedload

from app.api.deps import DBSession
from app.models.entities import Banner, Brand, Category, Master, Page, Product, Service
from app.schemas.barbershop import BookingCreate, BookingRead, MasterRead, ServiceRead
from app.schemas.catalog import BrandRead, CategoryRead, ProductListItem, ProductRead
from app.schemas.cms import BannerRead, PageRead
from app.schemas.orders import OrderCreate, OrderRead
from app.services.bookings import create_booking
from app.services.orders import create_order

router = APIRouter()


@router.get("/categories", response_model=list[CategoryRead])
def categories(db: DBSession):
    return db.scalars(select(Category).where(Category.status == "active").order_by(Category.name)).all()


@router.get("/brands", response_model=list[BrandRead])
def brands(db: DBSession):
    return db.scalars(select(Brand).where(Brand.status == "active").order_by(Brand.name)).all()


@router.get("/products", response_model=list[ProductListItem])
def products(
    db: DBSession,
    category_id: int | None = None,
    brand_id: int | None = None,
    q: str | None = None,
    sort: str = "newest",
    limit: int = Query(default=12, le=100),
    offset: int = 0,
):
    statement = (
        select(Product)
        .where(Product.status == "active")
        .options(joinedload(Product.category), joinedload(Product.brand), joinedload(Product.images))
    )
    if category_id:
        statement = statement.where(Product.category_id == category_id)
    if brand_id:
        statement = statement.where(Product.brand_id == brand_id)
    if q:
        query = f"%{q.strip()}%"
        statement = statement.where(or_(Product.name.ilike(query), Product.description.ilike(query), Product.slug.ilike(query)))
    sorters = {
        "price_asc": asc(Product.price),
        "price_desc": desc(Product.price),
        "name": asc(Product.name),
        "newest": desc(Product.created_at),
    }
    statement = statement.order_by(sorters.get(sort, desc(Product.created_at))).offset(offset).limit(limit)
    return db.scalars(statement).unique().all()


@router.get("/products/{slug}", response_model=ProductRead)
def product_detail(slug: str, db: DBSession):
    product = db.scalar(
        select(Product)
        .where(Product.slug == slug, Product.status == "active")
        .options(joinedload(Product.category), joinedload(Product.brand), joinedload(Product.images))
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.post("/orders", response_model=OrderRead)
def create_shop_order(payload: OrderCreate, db: DBSession):
    return create_order(db, payload)


@router.get("/masters", response_model=list[MasterRead])
def masters(db: DBSession):
    return db.scalars(select(Master).where(Master.status == "active").order_by(Master.name)).all()


@router.get("/services", response_model=list[ServiceRead])
def services(db: DBSession):
    return db.scalars(select(Service).where(Service.status == "active").order_by(Service.name)).all()


@router.post("/bookings", response_model=BookingRead)
def booking_create(payload: BookingCreate, db: DBSession):
    return create_booking(db, payload)


@router.get("/pages", response_model=list[PageRead])
def pages(db: DBSession):
    return db.scalars(select(Page).where(Page.status == "active").order_by(Page.name)).all()


@router.get("/banners", response_model=list[BannerRead])
def banners(db: DBSession, placement: str | None = None):
    statement = select(Banner).where(Banner.status == "active")
    if placement:
        statement = statement.where(Banner.placement == placement)
    return db.scalars(statement.order_by(Banner.created_at.desc())).all()
