from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import DBSession, require_roles
from app.models.entities import Banner, Booking, Brand, Category, Customer, Master, Order, Page, Product, ProductImage, Service
from app.repositories.base import SQLAlchemyRepository
from app.schemas.barbershop import BookingAdminCreate, BookingRead, CustomerRead, CustomerWrite, MasterBase, MasterRead, ServiceBase, ServiceRead
from app.schemas.catalog import BrandBase, BrandRead, CategoryBase, CategoryRead, ProductCreate, ProductRead, ProductUpdate
from app.schemas.cms import BannerBase, BannerRead, PageBase, PageRead
from app.schemas.orders import OrderAdminUpdate

router = APIRouter(dependencies=[Depends(require_roles("admin", "manager", "editor"))])

T = TypeVar("T")


def list_entities(repo: SQLAlchemyRepository, db: DBSession, offset: int = 0, limit: int = 20):
    items, total = repo.list(db, offset=offset, limit=limit)
    return {"items": items, "total": total}


category_repo = SQLAlchemyRepository(Category)
brand_repo = SQLAlchemyRepository(Brand)
master_repo = SQLAlchemyRepository(Master)
service_repo = SQLAlchemyRepository(Service)
page_repo = SQLAlchemyRepository(Page)
banner_repo = SQLAlchemyRepository(Banner)
customer_repo = SQLAlchemyRepository(Customer)


def create_crud_routes(path: str, repo: SQLAlchemyRepository, read_schema: type[T], create_schema: type, update_schema: type):
    @router.get(path)
    def list_route(db: DBSession, offset: int = 0, limit: int = Query(default=20, le=100)):
        return list_entities(repo, db, offset=offset, limit=limit)

    @router.post(path, response_model=read_schema)
    def create_route(payload: create_schema, db: DBSession):
        return repo.create(db, payload.model_dump())

    @router.get(f"{path}/{{entity_id}}", response_model=read_schema)
    def detail_route(entity_id: int, db: DBSession):
        entity = repo.get(db, entity_id)
        if not entity:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        return entity

    @router.put(f"{path}/{{entity_id}}", response_model=read_schema)
    def update_route(entity_id: int, payload: update_schema, db: DBSession):
        entity = repo.update(db, entity_id, payload.model_dump())
        if not entity:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        return entity

    @router.delete(f"{path}/{{entity_id}}")
    def delete_route(entity_id: int, db: DBSession):
        if not repo.delete(db, entity_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        return {"success": True}


create_crud_routes("/categories", category_repo, CategoryRead, CategoryBase, CategoryBase)
create_crud_routes("/brands", brand_repo, BrandRead, BrandBase, BrandBase)
create_crud_routes("/masters", master_repo, MasterRead, MasterBase, MasterBase)
create_crud_routes("/services", service_repo, ServiceRead, ServiceBase, ServiceBase)
create_crud_routes("/pages", page_repo, PageRead, PageBase, PageBase)
create_crud_routes("/banners", banner_repo, BannerRead, BannerBase, BannerBase)
create_crud_routes("/customers", customer_repo, CustomerRead, CustomerWrite, CustomerWrite)


@router.get("/dashboard")
def dashboard(db: DBSession):
    return {
        "products": db.query(Product).count(),
        "orders": db.query(Order).count(),
        "customers": db.query(Customer).count(),
        "bookings": db.query(Booking).count(),
    }


@router.get("/orders")
def orders(db: DBSession, offset: int = 0, limit: int = Query(default=20, le=100)):
    statement = (
        select(Order)
        .options(joinedload(Order.customer), joinedload(Order.items))
        .order_by(Order.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    total = db.query(Order).count()
    return {"items": db.scalars(statement).unique().all(), "total": total}


@router.get("/orders/{order_id}")
def order_detail(order_id: int, db: DBSession):
    order = db.scalar(select(Order).where(Order.id == order_id).options(joinedload(Order.customer), joinedload(Order.items)))
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return order


@router.put("/orders/{order_id}")
def update_order(order_id: int, payload: OrderAdminUpdate, db: DBSession):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for key, value in payload.model_dump().items():
        setattr(order, key, value)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.delete("/orders/{order_id}")
def delete_order(order_id: int, db: DBSession):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(order)
    db.commit()
    return {"success": True}


@router.post("/products", response_model=ProductRead)
def create_product(payload: ProductCreate, db: DBSession):
    images = payload.images
    product = Product(**payload.model_dump(exclude={"images"}))
    product.images = [ProductImage(**image.model_dump()) for image in images]
    db.add(product)
    db.commit()
    db.refresh(product)
    return db.scalar(
        select(Product)
        .where(Product.id == product.id)
        .options(joinedload(Product.category), joinedload(Product.brand), joinedload(Product.images))
    )


@router.get("/products")
def list_products(db: DBSession, offset: int = 0, limit: int = Query(default=20, le=100)):
    statement = (
        select(Product)
        .options(joinedload(Product.category), joinedload(Product.brand), joinedload(Product.images))
        .order_by(Product.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    total = db.query(Product).count()
    return {"items": db.scalars(statement).unique().all(), "total": total}


@router.get("/products/{product_id}", response_model=ProductRead)
def product_detail(product_id: int, db: DBSession):
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(joinedload(Product.category), joinedload(Product.brand), joinedload(Product.images))
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return product


@router.put("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: DBSession):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for key, value in payload.model_dump(exclude={"images"}).items():
        setattr(product, key, value)
    product.images = [ProductImage(**image.model_dump()) for image in payload.images]
    db.add(product)
    db.commit()
    return db.scalar(
        select(Product)
        .where(Product.id == product.id)
        .options(joinedload(Product.category), joinedload(Product.brand), joinedload(Product.images))
    )


@router.delete("/products/{product_id}")
def delete_product(product_id: int, db: DBSession):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(product)
    db.commit()
    return {"success": True}


@router.get("/bookings")
def bookings(db: DBSession, offset: int = 0, limit: int = Query(default=20, le=100)):
    statement = (
        select(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.master), joinedload(Booking.service))
        .order_by(Booking.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    total = db.query(Booking).count()
    return {"items": db.scalars(statement).unique().all(), "total": total}


@router.post("/bookings", response_model=BookingRead)
def create_booking_admin(payload: BookingAdminCreate, db: DBSession):
    booking = Booking(**payload.model_dump())
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return db.scalar(
        select(Booking)
        .where(Booking.id == booking.id)
        .options(joinedload(Booking.customer), joinedload(Booking.master), joinedload(Booking.service))
    )


@router.get("/bookings/{booking_id}", response_model=BookingRead)
def booking_detail(booking_id: int, db: DBSession):
    booking = db.scalar(
        select(Booking)
        .where(Booking.id == booking_id)
        .options(joinedload(Booking.customer), joinedload(Booking.master), joinedload(Booking.service))
    )
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return booking


@router.put("/bookings/{booking_id}", response_model=BookingRead)
def update_booking(booking_id: int, payload: BookingAdminCreate, db: DBSession):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    for key, value in payload.model_dump().items():
        setattr(booking, key, value)
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return db.scalar(
        select(Booking)
        .where(Booking.id == booking.id)
        .options(joinedload(Booking.customer), joinedload(Booking.master), joinedload(Booking.service))
    )


@router.delete("/bookings/{booking_id}")
def delete_booking(booking_id: int, db: DBSession):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(booking)
    db.commit()
    return {"success": True}
