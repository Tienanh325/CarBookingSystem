# Backend integration tests

These tests exercise the real Express application, authentication middleware, business services, and Prisma database. Business services are not mocked.

## Prerequisites

1. Point `DATABASE_URL` at a migrated MySQL test database. A local `.env` file is loaded automatically.
2. Run `npm run prisma:deploy` (and `npm run prisma:generate` after schema changes).
3. Run `npm run test:integration` from `backend/`.

If `DATABASE_URL` is absent, the integration suite is skipped so fast local/unit workflows remain safe. If it is present but the database is unreachable or not migrated, the integration command fails with a focused setup error.

The suite never resets or drops the database. Every run creates uniquely marked fixtures and removes only records whose exact IDs were created by that run. Shared role/reference rows are reused through idempotent upserts and are not deleted.
