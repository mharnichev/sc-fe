from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr

from app.schemas.common import TimestampedModel


class MasterBase(BaseModel):
    name: str
    slug: str
    title: str
    description: str | None = None
    bio: str | None = None
    photo: str | None = None
    status: str = "active"


class MasterRead(TimestampedModel, MasterBase):
    pass


class ServiceBase(BaseModel):
    name: str
    slug: str
    description: str | None = None
    price: Decimal
    duration_minutes: int
    status: str = "active"


class ServiceRead(TimestampedModel, ServiceBase):
    pass


class BookingCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    master_id: int
    service_id: int
    scheduled_at: datetime
    note: str | None = None


class BookingAdminCreate(BaseModel):
    customer_id: int
    master_id: int
    service_id: int
    scheduled_at: datetime
    note: str | None = None
    status: str = "pending"


class CustomerRead(TimestampedModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None
    notes: str | None


class CustomerWrite(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str | None = None
    notes: str | None = None


class BookingRead(TimestampedModel):
    id: int
    status: str
    scheduled_at: datetime
    note: str | None
    customer: CustomerRead
    master: MasterRead
    service: ServiceRead
