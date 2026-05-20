# Docker Deploy Guide

This file is a practical command list for running the Capella stack with Docker.

## Environment Files

- `.env`: normal local non-Docker development.
- `.env.docker`: Docker Compose environment.

Docker commands in this file assume you are in the repo root:

```cmd
D:\Documents\currentwork\capella\capellastore\capellacares.js.com>
```

## Main Docker Commands

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

## Logs

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

## Database And Migrations

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

## Useful Service Checks

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

## Local URLs

- Storefront: `http://localhost:3000`
- ERP: `http://localhost:3001`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## Common Recovery Flow

If Docker state becomes confusing:

```cmd
docker compose --env-file .env.docker pull mysql
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker exec api pnpm --filter @capella/database db:migrate
docker compose --env-file .env.docker ps
```

## Notes

- Use `.env` for normal local development outside Docker.
- Use `.env.docker` for Docker Compose.
- Inside Docker, services talk to each other by service name such as `mysql` and `api`, not `localhost`.
- If the app works outside Docker but fails inside Docker, inspect DB schema drift first.
