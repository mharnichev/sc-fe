# Barbershop Monorepo

Production-ready monorepo for a barbershop business with:

- Public barbershop website: Nuxt 3 SSR
- E-commerce storefront: Nuxt 3 SSR
- Backoffice admin panel: Nuxt 3 + JWT auth
- Unified backend API: FastAPI + PostgreSQL + SQLAlchemy + Alembic

## Monorepo Structure

```text
.
├── apps
│   ├── api
│   │   ├── alembic
│   │   ├── app
│   │   │   ├── api
│   │   │   ├── core
│   │   │   ├── db
│   │   │   ├── models
│   │   │   ├── repositories
│   │   │   ├── schemas
│   │   │   └── services
│   ├── backoffice
│   ├── barbershop
│   └── shop
├── packages
│   ├── shared-types
│   ├── shared-ui
│   └── shared-utils
├── docker-compose.yml
├── Makefile
├── package.json
└── pnpm-workspace.yaml
```

## Included Features

### Barbershop app

- Home, about, services, masters, contacts, blog/faq
- Booking request form connected to FastAPI
- SEO metadata for public pages

### Shop app

- Catalog, filters, search, sort
- Product detail pages
- Cart, favorites, checkout
- Basic reviews UI
- SEO metadata and Product schema.org JSON-LD

### Backoffice

- JWT login/logout
- Dashboard
- Entity management for products, categories, brands, orders, customers, bookings, masters, services, pages, banners
- Reusable table and form components

### FastAPI backend

- Auth: login, refresh, current user
- Public catalog and barbershop endpoints
- Admin endpoints with role protection
- Upload endpoint with local storage
- Alembic migration
- Seed data for products, categories, brands, services, masters, orders, bookings

## Environment

Copy the environment file:

```bash
cp .env.example .env
```

## Run With Docker

```bash
docker compose up --build
```

Apps:

- Barbershop: [http://localhost:3001](http://localhost:3001)
- Shop: [http://localhost:3002](http://localhost:3002)
- Backoffice: [http://localhost:3003](http://localhost:3003)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

Default admin credentials:

- Email: `admin@barbershop.local`
- Password: `admin123`

## Local Development

Install frontend dependencies:

```bash
pnpm install
```

Run individual apps:

```bash
pnpm dev:barbershop
pnpm dev:shop
pnpm dev:backoffice
pnpm dev:api
```

## API Notes

- Public endpoints live under `/api/v1/public`
- Admin endpoints live under `/api/v1/admin`
- Auth endpoints live under `/api/v1/auth`

## Database

Core tables:

- users
- customers
- categories
- brands
- products
- product_images
- orders
- order_items
- masters
- services
- bookings
- pages
- banners

## Seed Data

The API container runs:

- `alembic upgrade head`
- `python -m app.db.seed`

Standalone seed command:

```bash
make api-seed
```
