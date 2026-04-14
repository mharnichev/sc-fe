from decimal import Decimal

from pydantic import BaseModel, EmailStr

from app.schemas.barbershop import CustomerRead
from app.schemas.common import TimestampedModel


class OrderItemPayload(BaseModel):
    product_id: int
    quantity: int


class OrderCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    shipping_address: str
    comment: str | None = None
    items: list[OrderItemPayload]


class OrderItemRead(TimestampedModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal


class OrderRead(TimestampedModel):
    status: str
    total_amount: Decimal
    currency: str
    shipping_address: str
    comment: str | None
    customer: CustomerRead
    items: list[OrderItemRead]


class OrderAdminUpdate(BaseModel):
    status: str
    shipping_address: str
    comment: str | None = None
