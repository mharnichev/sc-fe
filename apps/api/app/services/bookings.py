from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import Booking, Customer, Master, Service
from app.schemas.barbershop import BookingCreate


def create_booking(db: Session, payload: BookingCreate) -> Booking:
    master = db.get(Master, payload.master_id)
    service = db.get(Service, payload.service_id)
    if not master or master.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Master unavailable")
    if not service or service.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Service unavailable")

    customer = db.query(Customer).filter(Customer.email == payload.email).first()
    if not customer:
        customer = Customer(
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            phone=payload.phone,
        )
        db.add(customer)
        db.flush()

    booking = Booking(
        customer=customer,
        master=master,
        service=service,
        scheduled_at=payload.scheduled_at,
        note=payload.note,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking
