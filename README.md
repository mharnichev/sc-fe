# Barbershop Monorepo

Production-ready monorepo for a barbershop business with:

- Public barbershop website: Nuxt 3 SSR
- E-commerce storefront: Nuxt 3 SSR
- Backoffice admin panel: Nuxt 3 + JWT auth
- Unified backend API (FastAPI + PostgreSQL + SQLAlchemy + Alembic) maintained in [`mharnichev/sc-be`](https://github.com/mharnichev/sc-be)

## Monorepo Structure

```text
.
├── apps
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
- Booking request form connected to the FastAPI backend (`mharnichev/sc-be`)
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

### Backend (`mharnichev/sc-be`)

The FastAPI backend powering these apps is maintained separately in [`mharnichev/sc-be`](https://github.com/mharnichev/sc-be). It provides:

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

Start the FastAPI backend from [`mharnichev/sc-be`](https://github.com/mharnichev/sc-be) (for example via `docker compose up` in that repo) so that these frontends can reach `http://localhost:8000`, then run:

```bash
docker compose up --build
```

Apps:

- Barbershop: [http://localhost:3001](http://localhost:3001)
- Shop: [http://localhost:3002](http://localhost:3002)
- Backoffice: [http://localhost:3003](http://localhost:3003)
- API docs (served by `mharnichev/sc-be`): [http://localhost:8000/docs](http://localhost:8000/docs)

Default admin credentials:

- Email: `admin@barbershop.local`
- Password: `admin123`

## Local Development

Install frontend dependencies:

```bash
pnpm install
```

Run individual apps (while the backend from [`mharnichev/sc-be`](https://github.com/mharnichev/sc-be) is running locally):

```bash
pnpm dev:barbershop
pnpm dev:shop
pnpm dev:backoffice
```

## API Notes

The FastAPI backend in [`mharnichev/sc-be`](https://github.com/mharnichev/sc-be) exposes:

- Public endpoints under `/api/v1/public`
- Admin endpoints under `/api/v1/admin`
- Auth endpoints under `/api/v1/auth`

## Database

Core PostgreSQL tables (defined in [`mharnichev/sc-be`](https://github.com/mharnichev/sc-be)):

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

When you start the backend via Docker Compose inside [`mharnichev/sc-be`](https://github.com/mharnichev/sc-be), the API container runs:

- `alembic upgrade head`
- `python -m app.db.seed`

See that repository for any additional seed commands or data tweaks.
