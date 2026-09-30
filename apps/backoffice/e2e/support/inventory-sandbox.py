"""Disposable real-backend inventory E2E harness.

This module is intentionally test-only. It refuses the normal PostgreSQL port,
uses a random schema inside a loopback ``*test*`` database, copies production
routes without the production lifespan, and deletes its schema on shutdown.
"""
from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


database_url = os.environ["INVENTORY_TEST_DATABASE_URL"]
parsed_url = make_url(database_url)
if parsed_url.host not in {"localhost", "127.0.0.1", "::1"}:
    raise RuntimeError("Refusing non-loopback inventory test database")
if "test" not in (parsed_url.database or "").lower():
    raise RuntimeError("Refusing inventory database whose name does not contain 'test'")
if parsed_url.port in {None, 5432}:
    raise RuntimeError("Refusing the normal PostgreSQL port; use the disposable database on 55440")

sys.path.insert(0, os.environ["INVENTORY_BACKEND_PATH"])
# Override a developer .env before importing any production module.
os.environ.update(
    DATABASE_URL=database_url,
    APP_ENV="test",
    SECRET_KEY="disposable-inventory-browser-smoke-only",
    SMS_PROVIDER="stub",
    SMS_CLUB_TOKEN="",
    TELEGRAM_BOT_TOKEN="",
    CAMPAIGN_RUN_SCHEDULER_ENABLED="false",
    SMS_QUEUE_WORKER_ENABLED="false",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, get_db_session
from app.core.security import create_access_token
from app.main import app as production_app
from app.models.admin_user import AdminUser
from app.models.inventory import InventoryMovement
from app.models.order import Order, OrderItem, OrderStatus, ProcurementStatus
from app.models.product import Product
from app.schemas.auth import AdminUserResponse


schema = "inventory_browser_test_" + uuid4().hex
admin_engine = create_async_engine(database_url)
engine = create_async_engine(database_url, connect_args={"server_settings": {"search_path": schema}})
database = async_sessionmaker(engine, expire_on_commit=False)
bootstrap: dict[str, object] = {}


async def isolated_session():
    async with database() as session:
        yield session


async def seed_baseline() -> None:
    async with database() as session:
        admin = AdminUser(email="inventory-browser@example.com", hashed_password="unused", is_superuser=True)
        inactive = AdminUser(
            email="inventory-inactive@example.com",
            hashed_password="unused",
            is_active=False,
            is_superuser=True,
        )
        products = {
            "available": Product(
                name="QA Available Pomade",
                slug="qa-available-pomade",
                price=Decimal("320.00"),
                sku="QA-AVAILABLE",
                barcode="QA-AVAILABLE-001",
                stock_quantity=10,
                reserved_quantity=2,
                allow_backorder=False,
                is_active=True,
                package_size="100 ml",
            ),
            "out_of_stock": Product(
                name="QA Out Shampoo",
                slug="qa-out-shampoo",
                price=Decimal("270.00"),
                sku="QA-OUT",
                barcode="QA-OUT-002",
                stock_quantity=0,
                reserved_quantity=0,
                allow_backorder=False,
                is_active=True,
            ),
            "missing_barcode": Product(
                name="QA Missing Barcode",
                slug="qa-missing-barcode",
                price=Decimal("180.00"),
                sku="QA-MISSING",
                barcode=None,
                stock_quantity=4,
                reserved_quantity=0,
                allow_backorder=False,
                is_active=True,
            ),
            "backorder": Product(
                name="QA Backorder Clay",
                slug="qa-backorder-clay",
                price=Decimal("410.00"),
                sku="QA-BACKORDER",
                barcode="QA-BACKORDER-004",
                stock_quantity=0,
                reserved_quantity=0,
                allow_backorder=True,
                is_active=True,
            ),
        }
        session.add_all([admin, inactive, *products.values()])
        await session.flush()

        order = Order(
            customer_name="QA Procurement Customer",
            customer_phone="+380501112233",
            customer_email="qa-procurement@example.com",
            comment="Disposable inventory sandbox order",
            subtotal_amount=Decimal("1230.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("1230.00"),
            status=OrderStatus.pending,
        )
        session.add(order)
        await session.flush()
        order_item = OrderItem(
            order_id=order.id,
            product_id=products["backorder"].id,
            quantity=3,
            quantity_from_stock=0,
            quantity_to_order=3,
            quantity_received_for_order=0,
            procurement_status=ProcurementStatus.to_order,
            base_price=Decimal("410.00"),
            price=Decimal("410.00"),
            discount_amount=Decimal("0.00"),
            product_name=products["backorder"].name,
            product_sku=products["backorder"].sku,
            total_price=Decimal("1230.00"),
        )
        session.add(order_item)
        await session.commit()

        bootstrap.clear()
        bootstrap.update(
            sandbox=True,
            schema=schema,
            access_token=create_access_token(str(admin.id)),
            inactive_access_token=create_access_token(str(inactive.id)),
            user=AdminUserResponse.model_validate(admin).model_dump(mode="json"),
            seed={
                "products": {
                    key: {
                        "id": product.id,
                        "name": product.name,
                        "sku": product.sku,
                        "barcode": product.barcode,
                        "on_hand": product.stock_quantity,
                        "reserved": product.reserved_quantity,
                    }
                    for key, product in products.items()
                },
                "order_id": order.id,
                "order_item_id": order_item.id,
            },
        )


async def reset_schema() -> None:
    # Every table is schema-qualified and ``engine`` can only see our random
    # schema. The runner must still use --workers=1 because reset is global to
    # this disposable harness.
    tables = ", ".join(f'"{schema}"."{table.name}"' for table in Base.metadata.tables.values())
    async with engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    await seed_baseline()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with admin_engine.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await seed_baseline()
    try:
        yield
    finally:
        await engine.dispose()
        async with admin_engine.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await admin_engine.dispose()


app = FastAPI(lifespan=lifespan)
# Copy route objects only. Including the production router/app lifespan would
# start schedulers and other unrelated background services.
app.router.routes.extend(production_app.router.routes)
app.dependency_overrides[get_db_session] = isolated_session
production_app.dependency_overrides[get_db_session] = isolated_session
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4042", "http://localhost:4042"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/__sandbox")
async def sandbox_status():
    return bootstrap


@app.post("/__sandbox/reset")
async def sandbox_reset():
    await reset_schema()
    return bootstrap


@app.get("/__sandbox/inspect")
async def sandbox_inspect():
    """Return only synthetic inventory state for E2E assertions."""
    async with database() as session:
        products = list((await session.execute(select(Product).order_by(Product.id))).scalars())
        order_items = list((await session.execute(select(OrderItem).order_by(OrderItem.id))).scalars())
        movement_count = int(await session.scalar(select(func.count()).select_from(InventoryMovement)) or 0)
        return {
            "schema": schema,
            "products": [
                {
                    "id": item.id,
                    "barcode": item.barcode,
                    "on_hand": item.stock_quantity,
                    "reserved": item.reserved_quantity,
                    "allow_backorder": item.allow_backorder,
                }
                for item in products
            ],
            "order_items": [
                {
                    "id": item.id,
                    "quantity_received": item.quantity_received_for_order,
                    "procurement_status": item.procurement_status.value,
                }
                for item in order_items
            ],
            "movement_count": movement_count,
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=58002)
