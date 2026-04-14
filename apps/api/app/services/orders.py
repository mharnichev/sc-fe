from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.entities import Customer, Order, OrderItem, Product
from app.schemas.orders import OrderCreate


def create_order(db: Session, payload: OrderCreate) -> Order:
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

    items: list[OrderItem] = []
    total = Decimal("0.00")
    for item in payload.items:
        product = db.get(Product, item.product_id)
        if not product or product.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product {item.product_id} unavailable")
        if product.stock < item.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for {product.name}")
        product.stock -= item.quantity
        line_total = Decimal(product.price) * item.quantity
        total += line_total
        items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                quantity=item.quantity,
                unit_price=product.price,
            )
        )

    order = Order(
        customer=customer,
        shipping_address=payload.shipping_address,
        comment=payload.comment,
        total_amount=total,
        items=items,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order
