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
ADMIN_NAME=Capella Admin
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-strong-admin-password
```

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

Start on the VPS:

```bash
cd ~/capellcares.js.com
git pull
```

Verify repo state before touching Docker:

```bash
git status --short
git log -1 --oneline
docker compose --env-file .env.production config >/tmp/capella-compose.yml
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
docker compose --env-file .env.production logs api --tail 80
```

Push the current schema directly:

```bash
docker compose --env-file .env.production exec api pnpm --filter @capella/database exec drizzle-kit push --config=drizzle.config.ts
```

Verify auth tables exist:

```bash
docker compose --env-file .env.production exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE '\''admin_users'\''; SHOW TABLES LIKE '\''auth_sessions'\'';"'
```

Optional seed data:

```bash
docker compose --env-file .env.production exec api pnpm --filter @capella/database db:seed
```

Verify seed data if you ran seed:

```bash
docker compose --env-file .env.production exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE '\''categories'\''; SELECT COUNT(*) AS categories FROM categories;"'
```

Verify public services:

```bash
docker compose --env-file .env.production ps
curl https://api.capellacares.com/health
curl -I https://capellacares.com
curl -I https://erp.capellacares.com
```

## Production Existing DB Flow

Use this once production may contain valuable data. Do not use `down -v`.

Start on the VPS:

```bash
cd ~/capellcares.js.com
git pull
```

Verify repo state before touching Docker:

```bash
git status --short
git log -1 --oneline
docker compose --env-file .env.production config >/tmp/capella-compose.yml
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
docker compose --env-file .env.production logs api --tail 80
```

Apply migrations:

```bash
docker compose --env-file .env.production exec api pnpm --filter @capella/database db:migrate
```

Verify schema after migrations:

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
curl https://api.capellacares.com/health
curl -I https://capellacares.com
curl -I https://erp.capellacares.com
```

## Local Docker Fresh DB Flow

Use this when your local Docker database has no valuable data.

Run from the repo root on Windows:

```cmd
D:\Documents\currentwork\capella\capellastore\capellacares.js.com>
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
docker compose --env-file .env.docker logs api --tail 80
```

Push the current schema directly:

```cmd
docker compose --env-file .env.docker exec api pnpm --filter @capella/database exec drizzle-kit push --config=drizzle.config.ts
```

Verify auth tables exist:

```cmd
docker compose --env-file .env.docker exec mysql sh -lc "mysql -u\"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\" -e \"SHOW TABLES LIKE 'admin_users'; SHOW TABLES LIKE 'auth_sessions';\""
```

Optional seed data:

```cmd
docker compose --env-file .env.docker exec api pnpm --filter @capella/database db:seed
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

Use this when you want to keep your local Docker database volume.

```cmd
docker compose --env-file .env.docker config > nul
docker compose --env-file .env.docker pull mysql
docker compose --env-file .env.docker build --no-cache
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker exec api pnpm --filter @capella/database db:migrate
docker compose --env-file .env.docker exec mysql sh -lc "mysql -u\"$MYSQL_USER\" -p\"$MYSQL_PASSWORD\" \"$MYSQL_DATABASE\" -e \"SHOW TABLES LIKE 'admin_users'; SHOW TABLES LIKE 'auth_sessions';\""
docker compose --env-file .env.docker ps
curl http://localhost:4000/health
```

## Local Non-Docker Fresh DB

Use this when MySQL is running on your host machine and `.env` points to it.

```cmd
pnpm --filter @capella/database exec drizzle-kit push --config=drizzle.config.ts
pnpm --filter @capella/database db:seed
pnpm dev
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

- Storefront: `https://capellacares.com`
- ERP: `https://erp.capellacares.com`
- API: `https://api.capellacares.com`
- API health: `https://api.capellacares.com/health`

Local Docker:

- Storefront: `http://localhost:3000`
- ERP: `http://localhost:3001`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## Rules

- Fresh/disposable DBs can use `drizzle-kit push`.
- Databases with valuable data should use `db:migrate`.
- `down -v` deletes Docker volumes, including MySQL data.
- `docker-compose.yml` reads deployment values from the `--env-file` argument.
- Inside Docker, services talk to each other by service name such as `mysql` and `api`, not `localhost`.

## Migration Tracking Gotcha

`drizzle-kit push` does **not** populate the `__drizzle_migrations` tracking table. A DB that was first bootstrapped with `push` will reject a later `db:migrate` run with a silent failure (the spinner hides the real `CREATE TABLE ... already exists` error):

```
$ drizzle-kit migrate
[⣯] applying migrations...
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] Exit status 1
```

Pick a tool per DB and stick with it for that DB's entire lifetime:

- **Local Docker / disposable DBs:** continue using `drizzle-kit push` for every schema sync. Do not switch to `db:migrate` against a `push`-bootstrapped DB.
- **Production / DBs with valuable data:** use `db:migrate` from the very first apply against a fresh DB. Never run `push` against a DB you intend to migrate later.

To debug a silent migrate failure, query the tracking table directly:

```bash
docker compose --env-file .env.docker exec mysql sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at;"'
```

If the table is empty but business tables (e.g. `admin_users`, `products`) exist, the DB was bootstrapped with `push` and cannot be switched to `migrate` without manual hash backfill or a `down -v` reset.
