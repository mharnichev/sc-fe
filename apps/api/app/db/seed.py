from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import Banner, Booking, Brand, Category, Customer, Master, Order, OrderItem, Page, Product, ProductImage, Service, User


def seed() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == "admin@barbershop.local")):
            return

        admin = User(
            email="admin@barbershop.local",
            password_hash=hash_password("admin123"),
            full_name="Main Admin",
            role="admin",
        )
        db.add(admin)

        skincare = Category(name="Skincare", slug="skincare", description="Daily skincare essentials")
        beard = Category(name="Beard Care", slug="beard-care", description="Beard oils, balms and grooming")
        styling = Category(name="Styling", slug="styling", description="Pomades, waxes and clays")
        db.add_all([skincare, beard, styling])

        brands = [
            Brand(name="North Ritual", slug="north-ritual", description="Premium men care", website="https://northritual.example"),
            Brand(name="Urban Blade", slug="urban-blade", description="Barber-grade styling"),
            Brand(name="Forge Lab", slug="forge-lab", description="Daily essentials for men"),
        ]
        db.add_all(brands)
        db.flush()

        products = [
            Product(
                category=beard,
                brand=brands[0],
                name="Cedar Beard Oil",
                slug="cedar-beard-oil",
                sku="NR-BO-001",
                short_description="Lightweight oil with cedar and citrus notes",
                description="A fast-absorbing beard oil that softens coarse hair and hydrates skin without shine.",
                price=Decimal("24.90"),
                compare_at_price=Decimal("29.90"),
                stock=40,
                seo_title="Cedar Beard Oil",
                seo_description="Premium cedar beard oil for daily grooming.",
                meta_keywords="beard oil, men grooming",
            ),
            Product(
                category=styling,
                brand=brands[1],
                name="Matte Clay Pomade",
                slug="matte-clay-pomade",
                sku="UB-CL-002",
                short_description="Strong hold, natural finish",
                description="Texturizing clay pomade with humidity resistance and easy restyling.",
                price=Decimal("19.50"),
                compare_at_price=Decimal("22.00"),
                stock=55,
                seo_title="Matte Clay Pomade",
                seo_description="Strong hold barber clay pomade.",
                meta_keywords="pomade, matte clay",
            ),
            Product(
                category=skincare,
                brand=brands[2],
                name="Cooling Face Wash",
                slug="cooling-face-wash",
                sku="FL-FW-003",
                short_description="Gentle cleanse for post-workout skin",
                description="Refreshing face wash with menthol and niacinamide for balanced skin.",
                price=Decimal("16.90"),
                stock=72,
                seo_title="Cooling Face Wash",
                seo_description="Refreshing men's face wash for daily use.",
                meta_keywords="face wash, skincare",
            ),
        ]
        for index, product in enumerate(products, start=1):
            product.images = [
                ProductImage(image=f"https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80&sig={index}", alt=product.name, sort_order=0)
            ]
        db.add_all(products)

        masters = [
            Master(name="Luca Moretti", slug="luca-moretti", title="Senior Barber", bio="Precision fades and classic scissor work.", description="Known for clean tailoring and beard design.", photo="https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=800&q=80"),
            Master(name="Jordan Vale", slug="jordan-vale", title="Style Director", bio="Texture, curls and editorial styling.", description="Focuses on modern looks and consultations.", photo="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80"),
        ]
        services = [
            Service(name="Classic Haircut", slug="classic-haircut", description="Consultation, cut and finish.", price=Decimal("35.00"), duration_minutes=45),
            Service(name="Haircut + Beard", slug="haircut-beard", description="Cut, beard shape and hot towel.", price=Decimal("55.00"), duration_minutes=60),
            Service(name="Royal Shave", slug="royal-shave", description="Traditional razor shave with hot towels.", price=Decimal("32.00"), duration_minutes=40),
        ]
        db.add_all(masters + services)

        pages = [
            Page(name="About", title="About the Studio", slug="about", description="Who we are", content="We are a contemporary barbershop blending classic service with modern style.", seo_title="About Our Barbershop", seo_description="Meet the team and studio philosophy."),
            Page(name="FAQ", title="Frequently Asked Questions", slug="faq", description="Common booking and service questions", content="Bookings can be rescheduled up to 12 hours in advance. Walk-ins depend on chair availability.", seo_title="Barbershop FAQ", seo_description="Answers about appointments, services and products."),
        ]
        banners = [
            Banner(name="Homepage Hero", title="Sharp cuts. Honest products.", slug="homepage-hero", description="Hero banner", image="https://images.unsplash.com/photo-1512690459411-b0fd34f8acfd?auto=format&fit=crop&w=1200&q=80", link="/shop", placement="homepage"),
            Banner(name="Shop Promo", title="Bundle beard care and save 15%", slug="shop-promo", description="Shop promo banner", image="https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=80", link="/categories/beard-care", placement="shop"),
        ]
        db.add_all(pages + banners)
        db.flush()

        customer = Customer(first_name="Marcus", last_name="Reed", email="marcus@example.com", phone="+1 312 555 0112")
        db.add(customer)
        db.flush()

        order = Order(
            customer=customer,
            status="paid",
            total_amount=Decimal("44.40"),
            shipping_address="214 West Elm Street, Chicago, IL",
            comment="Leave at front desk",
            items=[
                OrderItem(product=products[0], product_name=products[0].name, quantity=1, unit_price=products[0].price),
                OrderItem(product=products[2], product_name=products[2].name, quantity=1, unit_price=products[2].price),
            ],
        )
        booking = Booking(
            customer=customer,
            master=masters[0],
            service=services[1],
            status="confirmed",
            scheduled_at=datetime.now(UTC) + timedelta(days=2),
            note="Prefer a low fade and beard trim.",
        )
        db.add_all([order, booking])
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
