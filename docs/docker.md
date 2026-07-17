# Docker Deploy Guide

This guide is ordered by the normal flow of commands: prepare env, build/start, create or update schema, seed if needed, then verify.

## Environment Files

- `.env`: local non-Docker development.
- `.env.docker`: local Docker Compose on your PC.
- `.env.production`: production Docker Compose on the VPS.

Production uses:

```bash
docker compose --env-file .env.production ...
```

Local Docker uses:

```cmd
docker compose --env-file .env.docker ...
```

## Required Auth Env

Production and Docker auth require server-only ERP admin bootstrap values:

```env
ADMIN_NAME=Minikoshk Admin
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-strong-admin-password
```

`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` are the source of truth for the
single admin account. The API reconciles the admin row to these values **at
startup** (`ensureBootstrapAdmin`), not during login. Changing them takes effect
on the next API restart/redeploy, not on the next login.

### Fail-closed secrets and CORS (production)

When `NODE_ENV=production`, the API refuses to boot if any of these is missing —
there is no public dev-default fallback:

```env
JWT_ACCESS_SECRET=your-long-random-access-secret
STOREFRONT_REVALIDATE_SECRET=your-long-random-revalidate-secret
# Comma-separated allowlist of browser origins permitted to send credentialed
# requests. No arbitrary-origin reflection in production.
CORS_ALLOWED_ORIGINS=https://erp.example.com,https://shop.example.com
```

Outside production these fall back to dev defaults / `localhost:3000,localhost:3001`.

Remove old ERP dev fallback variables from production and Docker env files:

```env
ALLOW_DEV_ADMIN_FALLBACK
DEV_ADMIN_EMAIL
DEV_ADMIN_PASSWORD
NEXT_PUBLIC_DEV_ADMIN_EMAIL
NEXT_PUBLIC_DEV_ADMIN_PASSWORD
```

## Production Fresh DB Flow

Use this only when the VPS database has no valuable data. `down -v` deletes the MySQL volume.

> `docker compose up -d` now includes a one-shot `migrate` service. It waits for
> MySQL, runs `db:migrate`, exits successfully, and only then allows the API to
> start. An exited `migrate` container is the expected healthy state.

Start on the VPS:

```bash
cd ~/minikoshk
git pull
```

Verify repo state before touching Docker:

```bash
git status --short
git log -1 --oneline
docker compose --env-file .env.production config >/tmp/minikoshk-compose.yml
```

Build and start from a clean database:

```bash
docker compose --env-file .env.production pull mysql
docker compose --env-file .env.production down -v
docker compose --env-file .env.production build --no-cache
docker compose --env-file .env.production up -d
```

Verify containers are created and healthy enough to run commands:

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs migrate --tail 80
docker compose --env-file .env.production logs api --tail 80
```

Verify auth tables exist:

```bash
docker compose --env-file .env.production exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE '\''admin_users'\''; SHOW TABLES LIKE '\''auth_sessions'\'';"'
```

Optional seed data:

```bash
docker compose --env-file .env.production exec api pnpm --filter @minikoshk/database db:seed
```

Verify seed data if you ran seed:

```bash
docker compose --env-file .env.production exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE '\''categories'\''; SELECT COUNT(*) AS categories FROM categories;"'
```

Verify public services:

```bash
docker compose --env-file .env.production ps
curl https://api.minikoshk.com/health
curl -I https://minikoshk.com
curl -I https://erp.minikoshk.com
```

## Production Existing DB Flow

Use this once production may contain valuable data. Do not use `down -v`.

Start on the VPS:

```bash
cd ~/minikoshk
git pull
```

Verify repo state before touching Docker:

```bash
git status --short
git log -1 --oneline
docker compose --env-file .env.production config >/tmp/minikoshk-compose.yml
```

Build and start:

```bash
docker compose --env-file .env.production pull mysql
docker compose --env-file .env.production build --no-cache
docker compose --env-file .env.production up -d
```

Verify containers are created and the API container can run commands:

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs migrate --tail 80
docker compose --env-file .env.production logs api --tail 80
```

Verify schema after the migrate service completes:

```bash
docker compose --env-file .env.production exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE '\''admin_users'\''; SHOW TABLES LIKE '\''auth_sessions'\'';"'
```

Restart app services after schema changes:

```bash
docker compose --env-file .env.production restart api storefront erp
```

Verify public services:

```bash
docker compose --env-file .env.production ps
curl https://api.minikoshk.com/health
curl -I https://minikoshk.com
curl -I https://erp.minikoshk.com
```

## Local Docker Fresh DB Flow

Use this when your local Docker database has no valuable data.

Run from the repo root on Windows:

```cmd
D:\Documents\currentwork\minikoshk\minikoshkstore>
```

Verify local Compose config:

```cmd
docker compose --env-file .env.docker config > nul
```

Build and start from a clean database:

```cmd
docker compose --env-file .env.docker pull mysql
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
```

Verify containers are running:

```cmd
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs migrate --tail 80
docker compose --env-file .env.docker logs api --tail 80
```

Verify auth tables exist:

```cmd
docker compose --env-file .env.docker exec mysql sh -lc "mysql -u\"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\" -e \"SHOW TABLES LIKE 'admin_users'; SHOW TABLES LIKE 'auth_sessions';\""
```

Optional seed data:

```cmd
docker compose --env-file .env.docker exec api pnpm --filter @minikoshk/database db:seed
```

Verify seed data if you ran seed:

```cmd
docker compose --env-file .env.docker exec mysql sh -lc "mysql -u\"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\" -e \"SHOW TABLES LIKE 'categories'; SELECT COUNT(*) AS categories FROM categories;\""
```

Verify local services:

```cmd
docker compose --env-file .env.docker ps
curl http://localhost:4000/health
```

## Local Docker Existing DB Flow

Use this when you want to keep your local Docker database volume and it was already bootstrapped with `db:migrate`.

```cmd
docker compose --env-file .env.docker config > nul
docker compose --env-file .env.docker pull mysql
docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs migrate --tail 80
docker compose --env-file .env.docker exec mysql sh -lc "mysql -u\"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\" -e \"SHOW TABLES LIKE 'admin_users'; SHOW TABLES LIKE 'auth_sessions';\""
docker compose --env-file .env.docker ps
curl http://localhost:4000/health
```

If this local DB was ever bootstrapped with `drizzle-kit push`, reset it once before adopting migrate-only:

```cmd
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d
```

## Local Non-Docker Fresh DB

Use this when MySQL is running on your host machine and `.env` points to it.

```cmd
pnpm --filter @minikoshk/database db:migrate
pnpm --filter @minikoshk/database db:seed
pnpm dev
```

For schema changes, generate a migration first:

```cmd
pnpm --filter @minikoshk/database db:generate
pnpm --filter @minikoshk/database db:migrate
```

Verify local non-Docker services:

```cmd
curl http://localhost:4000/health
```

## Common Commands

Build one service:

```bash
docker compose --env-file .env.production build api
docker compose --env-file .env.production build storefront
docker compose --env-file .env.production build erp
```

Stop without deleting data:

```bash
docker compose --env-file .env.production down
```

Stop and delete Docker volumes:

```bash
docker compose --env-file .env.production down -v
```

Restart services:

```bash
docker compose --env-file .env.production restart api storefront erp
docker compose --env-file .env.production restart api
docker compose --env-file .env.production restart erp
```

Show running containers:

```bash
docker compose --env-file .env.production ps
```

For local Docker, replace `.env.production` with `.env.docker`.

## Logs

All logs:

```bash
docker compose --env-file .env.production logs
```

Tail all logs:

```bash
docker compose --env-file .env.production logs --tail 100
```

Service logs:

```bash
docker compose --env-file .env.production logs migrate --tail 80
docker compose --env-file .env.production logs api --tail 80
docker compose --env-file .env.production logs storefront --tail 80
docker compose --env-file .env.production logs erp --tail 80
docker compose --env-file .env.production logs mysql --tail 80
```

For local Docker, replace `.env.production` with `.env.docker`.

## Database Checks

Open MySQL with the app user:

```bash
docker compose --env-file .env.production exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

Check whether a table exists:

```bash
docker compose --env-file .env.production exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE '\''auth_sessions'\'';"'
```

Describe a table:

```bash
docker compose --env-file .env.production exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "DESCRIBE admin_users;"'
```

List migration files inside the API container:

```bash
docker compose --env-file .env.production exec api sh -lc "ls -1 /app/packages/database/drizzle/migrations"
```

For local Docker, replace `.env.production` with `.env.docker`.

## URLs

Production:

- Storefront: `https://minikoshk.com`
- ERP: `https://erp.minikoshk.com`
- API: `https://api.minikoshk.com`
- API health: `https://api.minikoshk.com/health`

Local Docker:

- Storefront: `http://localhost:3000`
- ERP: `http://localhost:3001`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## Public DNS and Proxy Checks

Confirm that public resolvers point every production hostname at the VPS. Query
explicit resolvers because `/etc/hosts` or a stale local resolver can make a
normal `curl` misleading:

```bash
for host in minikoshk.com www.minikoshk.com api.minikoshk.com erp.minikoshk.com; do
  echo "=== $host ==="
  dig @1.1.1.1 +short A "$host"
  dig @8.8.8.8 +short A "$host"
  dig @1.1.1.1 +short AAAA "$host"
done
```

Test the application path on the VPS independently of public DNS:

```bash
curl -I http://127.0.0.1:3000
curl http://127.0.0.1:4000/health
curl -I http://127.0.0.1:3001
curl -I --resolve erp.minikoshk.com:443:127.0.0.1 https://erp.minikoshk.com
```

For public verification, run these without `--resolve` from a machine outside
the VPS:

```bash
curl -I https://minikoshk.com
curl https://api.minikoshk.com/health
curl -I https://erp.minikoshk.com
```

If authoritative DNS has the correct VPS address but clients still resolve an
old address, wait for the previous record's TTL and flush the client DNS cache.
Domain reactivation after registrar verification can also take time to reach
recursive resolvers.

## Rules

- Use `db:migrate` everywhere: local non-Docker, local Docker, staging, and production.
- `docker compose up -d` runs the one-shot `migrate` service automatically before `api`.
- Schema change workflow: edit `drizzle/schema.ts` → `db:generate` (commit the new migration file) → `db:migrate`.
- Separate multiple SQL commands in a hand-authored Drizzle migration with `--> statement-breakpoint`.
- If a local DB was ever bootstrapped with `drizzle-kit push`, reset it once with `down -v` before adopting migrate-only.
- `down -v` deletes Docker volumes, including MySQL data.
- `docker-compose.yml` reads deployment values from the `--env-file` argument.
- Inside Docker, services talk to each other by service name such as `mysql` and `api`, not `localhost`.

## Legacy Push Reset Warning

Older local databases that were created with `drizzle-kit push` do **not** have a usable `__drizzle_migrations` history. If you point `db:migrate` at one of those DBs, Drizzle can try to replay the initial migrations into tables that already exist and fail.

Reset any old local push-bootstrapped DB once:

```cmd
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
```

To debug a silent migrate failure, query the tracking table directly:

```bash
docker compose --env-file .env.docker exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at;"'
```

If the table is empty but business tables (e.g. `admin_users`, `products`) exist, the DB was bootstrapped with `push` and cannot be switched to `migrate` without manual hash backfill or a `down -v` reset.
