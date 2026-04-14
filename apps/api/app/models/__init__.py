from app.models.entities import Banner, Booking, Brand, Category, Customer, Master, Order, OrderItem, Page, Product, ProductImage, Service, User

all_models = [
    User,
    Customer,
    Category,
    Brand,
    Product,
    ProductImage,
    Order,
    OrderItem,
    Master,
    Service,
    Booking,
    Page,
    Banner,
]

__all__ = [model.__name__ for model in all_models]
