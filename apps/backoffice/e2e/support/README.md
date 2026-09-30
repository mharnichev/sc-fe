# Customer segment browser sandbox

These smoke tests use the real `sc-be` FastAPI routes, bearer authentication,
SQLAlchemy models and PostgreSQL audience/run engine. The data is synthetic and
SMS/Telegram providers only record messages in memory. This is not a staging,
migration or real-provider verification. No production application lifespan or
scheduler is started.

Prerequisites: backend Python dependencies, local Docker, frontend dependencies
and Playwright Chromium. Run from the frontend repository root. Use a fresh
harness for a complete run, because the tests intentionally create marketing
contact history and exercise the real frequency cap.

Start a disposable database:

```sh
docker run --rm --name soulcuts-fe-segments-smoke \
  -e POSTGRES_USER=segments_test -e POSTGRES_PASSWORD=segments_test \
  -e POSTGRES_DB=segments_test -p 127.0.0.1:55439:5432 -d postgres:16
```

Start the isolated backend in another terminal (set the actual backend checkout):

```sh
SEGMENTS_BACKEND_PATH=/path/to/sc-be \
SEGMENTS_TEST_DATABASE_URL=postgresql+asyncpg://segments_test:segments_test@127.0.0.1:55439/segments_test \
python3 apps/backoffice/e2e/support/segments-sandbox.py
```

The harness binds only to `127.0.0.1:58001`, refuses non-local/non-test databases,
creates a unique temporary schema, overrides the real database dependency and
removes that schema on graceful shutdown. Its test-only bootstrap and process
endpoints must never be deployed.

Start the dedicated frontend in a third terminal:

```sh
NUXT_PUBLIC_API_BASE=http://127.0.0.1:58001/api/v1 TMPDIR=/tmp \
pnpm --filter @apps/backoffice exec nuxt dev --host 127.0.0.1 --port 4041
```

Run the tests:

```sh
SEGMENTS_SANDBOX_URL=http://127.0.0.1:58001 PLAYWRIGHT_PORT=4041 \
pnpm --filter @apps/backoffice exec playwright test customer-segments segments-rules segments-connected-modules --workers=1
```

Without `SEGMENTS_SANDBOX_URL`, these tests skip; they never fall back to the
application's configured database or provider. All successful responses come
from the real backend. The race test delays a genuine backend response, and the
failure test explicitly injects one HTTP 503 response.

The connected-module and rule suites use `POST /__sandbox/reset` to truncate only
the harness-owned schema and restore deterministic seed IDs. Run them with one
worker; simultaneous reset flows are unsupported. Bootstrap exposes these IDs
under `seed`. The original five customers remain unchanged, with additional
template and promotion resources. `POST /__sandbox/rules-fixtures` adds separate,
idempotent calendar-boundary, master/service, contact-history and pagination data
and returns its IDs and fixed evaluation timestamp. These endpoints are only in
the disposable harness and must never be deployed.

Connected-module tests require all browser API requests to succeed and fail on
uncaught exceptions or console errors. They cover customer service history and
consent, shared templates, service notification status, overlapping audience
selection, historical service IDs and audience-mode switching, schedule
retention/removal, offer references, explicit UI launch,
sandbox worker outcomes, immutable results, and journal/customer/promotion links.
The only transport exception is Chromium reporting `net::ERR_ABORTED` after an
observed successful HTTP 204 DELETE response; template deletion and retention of
the original template are still asserted. Requests aborted before a successful
response, all HTTP errors and all browser errors fail the tests.

Stop the dedicated frontend and backend with Ctrl-C, then stop only the test
container:

```sh
docker stop soulcuts-fe-segments-smoke
```

The September 6, 2026 verification used container
`soulcuts-fe-segments-smoke-20260906`. Screenshots and the recorded test output are
under `output/customer-segments/` in the frontend checkout.

The expanded September 6 verification also used
`soulcuts-segments-fulltest-20260906`; its final logs and screenshots are under
`output/segments-full-test/`, with coverage and limitations in
`docs/segments-full-test-report.md`.

## Inventory browser sandbox

`inventory.smoke.spec.ts` exercises the real inventory, procurement, receiving,
count, order-fulfillment, product and movement routes against PostgreSQL. It
does not mock successful inventory responses. The seed is entirely synthetic:
an administrator, available/out-of-stock/missing-barcode/backorder products and
one pending customer order with a three-unit procurement shortage.

Start the dedicated disposable database (never use the normal port 5432):

```sh
docker run --rm --name soulcuts-fe-inventory-smoke \
  -e POSTGRES_USER=inventory_test -e POSTGRES_PASSWORD=inventory_test \
  -e POSTGRES_DB=inventory_test -p 127.0.0.1:55440:5432 -d postgres:16
```

Start the isolated backend from the frontend repository root, replacing the
backend path when the checkouts are elsewhere:

```sh
INVENTORY_BACKEND_PATH=/Users/markgarnicev/sc/sc-be \
INVENTORY_TEST_DATABASE_URL=postgresql+asyncpg://inventory_test:inventory_test@127.0.0.1:55440/inventory_test \
python3 apps/backoffice/e2e/support/inventory-sandbox.py
```

The harness listens only on `127.0.0.1:58002`. It rejects non-loopback hosts,
database names without `test`, the default PostgreSQL port, and missing explicit
configuration. It creates a random `inventory_browser_test_*` schema, overrides
the production database dependency, never starts the production lifespan, and
drops only its own schema on graceful shutdown. `POST /__sandbox/reset` and
`GET /__sandbox/inspect` are test-only endpoints and must never be deployed.

Start the dedicated frontend in another terminal:

```sh
NUXT_PUBLIC_API_BASE=http://127.0.0.1:58002/api/v1 TMPDIR=/tmp \
pnpm --filter @apps/backoffice exec nuxt dev --host 127.0.0.1 --port 4042
```

Run the suite serially so a reset cannot race another test:

```sh
INVENTORY_SANDBOX_URL=http://127.0.0.1:58002 PLAYWRIGHT_PORT=4042 \
NUXT_PUBLIC_API_BASE=http://127.0.0.1:58002/api/v1 \
pnpm --filter @apps/backoffice exec playwright test inventory.smoke.spec.ts --workers=1
```

The suite covers admin session rejection, private-field isolation, overview
search and local stock filters, duplicate barcode validation, procurement and
order fulfillment, scanner/repeat/manual-quantity receipt entry, allocations,
posting and read-only reload, count upsert/difference/post/reload, all supported
manual operation types, the product-scoped movement journal and idempotent
retries. Screenshots are attached to the Playwright test output.

Known API limitations remain explicit: there is no generic manual adjustment
operation (inventory counts are the reconciliation path), no global movement
endpoint, and movement type/date filters operate on the currently loaded
product page rather than server-side across the full ledger.
