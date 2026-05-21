# Docker Deploy Guide

This file is a practical command list for running the Capella stack with Docker.

## Environment Files

- `.env`: normal local non-Docker development.
- `.env.docker`: local Docker Compose on your PC.
- `.env.production`: production Docker Compose on the VPS.

## Local Docker On PC

Commands in this section assume you are in the repo root on Windows:

```cmd
D:\Documents\currentwork\capella\capellastore\capellacares.js.com>
```

### Main Commands

Pull required service images:

```cmd
docker compose --env-file .env.docker pull mysql
```

Build everything:

```cmd
docker compose --env-file .env.docker build --no-cache
```

Build one service:

```cmd
docker compose --env-file .env.docker build api
docker compose --env-file .env.docker build storefront
docker compose --env-file .env.docker build erp
```

Start the full stack:

```cmd
docker compose --env-file .env.docker up -d
```

Stop the full stack:

```cmd
docker compose --env-file .env.docker down
```

Stop only selected services without removing them:

```cmd
docker compose --env-file .env.docker stop storefront erp
docker compose --env-file .env.docker stop api
```

Start selected stopped services again:

```cmd
docker compose --env-file .env.docker start storefront erp
docker compose --env-file .env.docker start api
```

Stop and remove volumes:

```cmd
docker compose --env-file .env.docker down -v
```

Restart selected services:

```cmd
docker compose --env-file .env.docker restart api storefront
docker compose --env-file .env.docker restart api
docker compose --env-file .env.docker restart erp
```

Show running containers:

```cmd
docker compose --env-file .env.docker ps
```

### Logs

All logs:

```cmd
docker compose --env-file .env.docker logs
```

Tail all logs:

```cmd
docker compose --env-file .env.docker logs --tail 100
```

Service logs:

```cmd
docker compose --env-file .env.docker logs api
docker compose --env-file .env.docker logs storefront
docker compose --env-file .env.docker logs erp
docker compose --env-file .env.docker logs mysql
```

Short service logs:

```cmd
docker compose --env-file .env.docker logs api --tail 80
docker compose --env-file .env.docker logs storefront --tail 80
docker compose --env-file .env.docker logs erp --tail 80
docker compose --env-file .env.docker logs mysql --tail 80
```

### Database And Migrations

Apply Drizzle migrations:

```cmd
docker compose --env-file .env.docker exec api pnpm --filter @capella/database db:migrate
```

Run seed data:

```cmd
docker compose --env-file .env.docker exec api pnpm --filter @capella/database db:seed
```

Open MySQL with the app user:

```cmd
docker compose --env-file .env.docker exec mysql mysql -ucapella -pnewapppassword capella
```

Check whether a table exists:

```cmd
docker compose --env-file .env.docker exec mysql mysql -ucapella -pnewapppassword capella -e "SHOW TABLES LIKE 'advices';"
```

Describe a table:

```cmd
docker compose --env-file .env.docker exec mysql mysql -ucapella -pnewapppassword capella -e "DESCRIBE advices;"
```

### Useful Service Checks

Test API health from host:

```cmd
curl http://localhost:4000/health
```

Test API health from inside the API container:

```cmd
docker compose --env-file .env.docker exec api node -e "fetch('http://127.0.0.1:4000/health').then(r=>r.text()).then(console.log).catch(err=>{console.error(err);process.exit(1)})"
```

Test storefront-facing advices endpoint from inside the API container:

```cmd
docker compose --env-file .env.docker exec api node -e "fetch('http://127.0.0.1:4000/api/v1/advices').then(r=>r.text()).then(console.log).catch(err=>{console.error(err);process.exit(1)})"
```

List migration files inside the running API container:

```cmd
docker compose --env-file .env.docker exec api sh -lc "ls -1 /app/packages/database/drizzle/migrations"
```

### Local URLs

- Storefront: `http://localhost:3000`
- ERP: `http://localhost:3001`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

### Common Recovery Flow

If Docker state becomes confusing:

```cmd
docker compose --env-file .env.docker pull mysql
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker exec api pnpm --filter @capella/database db:migrate
docker compose --env-file .env.docker ps
```

## Production On VPS

Commands in this section assume you are on the Linux server:

```bash
cd ~/capellcares.js.com
```

### Main Commands

Pull required service images:

```bash
docker compose --env-file .env.production pull mysql
```

Build everything:

```bash
docker compose --env-file .env.production build --no-cache
```

Build one service:

```bash
docker compose --env-file .env.production build api
docker compose --env-file .env.production build storefront
docker compose --env-file .env.production build erp
```

Start the full stack:

```bash
docker compose --env-file .env.production up -d
```

Stop the full stack:

```bash
docker compose --env-file .env.production down
```

Stop only selected services without removing them:

```bash
docker compose --env-file .env.production stop storefront erp
docker compose --env-file .env.production stop api
```

Start selected stopped services again:

```bash
docker compose --env-file .env.production start storefront erp
docker compose --env-file .env.production start api
```

Stop and remove volumes:

```bash
docker compose --env-file .env.production down -v
```

Restart selected services:

```bash
docker compose --env-file .env.production restart api storefront
docker compose --env-file .env.production restart api
docker compose --env-file .env.production restart erp
```

Show running containers:

```bash
docker compose --env-file .env.production ps
```

### Logs

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
docker compose --env-file .env.production logs api
docker compose --env-file .env.production logs storefront
docker compose --env-file .env.production logs erp
docker compose --env-file .env.production logs mysql
```

Short service logs:

```bash
docker compose --env-file .env.production logs api --tail 80
docker compose --env-file .env.production logs storefront --tail 80
docker compose --env-file .env.production logs erp --tail 80
docker compose --env-file .env.production logs mysql --tail 80
```

### Database And Migrations

Apply Drizzle migrations:

```bash
docker compose --env-file .env.production exec api pnpm --filter @capella/database db:migrate
```

For a fresh production database, this command is still required. MySQL creates the empty database, and Drizzle migrations create the application tables.

Run seed data:

```bash
docker compose --env-file .env.production exec api pnpm --filter @capella/database db:seed
```

Open MySQL with the app user:

```bash
docker compose --env-file .env.production exec mysql mysql -ucapella -pnewapppassword capella
```

Check whether a table exists:

```bash
docker compose --env-file .env.production exec mysql mysql -ucapella -pnewapppassword capella -e "SHOW TABLES LIKE 'advices';"
```

Describe a table:

```bash
docker compose --env-file .env.production exec mysql mysql -ucapella -pnewapppassword capella -e "DESCRIBE advices;"
```

### Useful Service Checks

Test API health from VPS:

```bash
curl https://api.capellacares.com/health
curl http://127.0.0.1:4000/health
```

Test storefront from VPS:

```bash
curl -I https://capellacares.com
curl -I https://capellacares.com/ar/products
```

Test ERP from VPS:

```bash
curl -I https://erp.capellacares.com
```

List migration files inside the running API container:

```bash
docker compose --env-file .env.production exec api sh -lc "ls -1 /app/packages/database/drizzle/migrations"
```

### Public URLs

- Storefront: `https://capellacares.com`
- ERP: `https://erp.capellacares.com`
- API: `https://api.capellacares.com`
- API health: `https://api.capellacares.com/health`

### Common Recovery Flow

If production Docker state becomes confusing:

```bash
docker compose --env-file .env.production pull mysql
docker compose --env-file .env.production down -v
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose --env-file .env.production exec api pnpm --filter @capella/database db:migrate
docker compose --env-file .env.production ps
```

## Notes

- Use `.env` for normal local development outside Docker.
- Use `.env.docker` for local Docker Compose on your PC.
- Use `.env.production` for VPS deployment commands.
- Inside Docker, services talk to each other by service name such as `mysql` and `api`, not `localhost`.
- `docker-compose.yml` reads deployment values from the `--env-file` argument; production should use `--env-file .env.production`.
- Production auth requires server-only `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env.production`.
- Remove old ERP dev fallback variables from production env files: `ALLOW_DEV_ADMIN_FALLBACK`, `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD`, `NEXT_PUBLIC_DEV_ADMIN_EMAIL`, and `NEXT_PUBLIC_DEV_ADMIN_PASSWORD`.
- If the app works outside Docker but fails inside Docker, inspect DB schema drift first.
