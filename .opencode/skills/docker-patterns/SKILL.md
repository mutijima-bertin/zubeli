---
name: docker-patterns
description: "Use when creating or modifying Dockerfiles, docker-compose services, or container workflows in zubeli. Covers multi-stage builds, Postgres service, volume persistence, image size/security, and secrets in containers."
---

# Docker Patterns

Containerization for zubeli: a lean, secure Next.js image and a local Postgres service.

## When to use
- Writing or editing `Dockerfile`, `docker-compose.yml`, `.dockerignore`, or any container-related workflow (local dev, CI, deploy).

## Core rules
- **Multi-stage Next.js Dockerfile** (three stages: deps → builder → runner):
  ```dockerfile
  FROM node:22-alpine AS deps
  WORKDIR /app
  COPY package.json package-lock.json ./
  RUN npm ci

  FROM node:22-alpine AS builder
  WORKDIR /app
  COPY --from=deps /app/node_modules ./node_modules
  COPY . .
  RUN npx prisma generate && npm run build

  FROM node:22-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
  COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
  COPY --from=builder /app/public ./public
  COPY --from=builder /app/package.json ./package.json
  USER nextjs
  EXPOSE 3000
  CMD ["node", "node_modules/next/dist/bin/next", "start"]
  ```
  Copy only what the runner needs (`.next`, `public`, `package.json`, generated Prisma client); include `prisma/` if runtime migrations are needed elsewhere.
- **docker-compose with Postgres service** (local dev + CI):
  ```yaml
  services:
    db:
      image: postgres:16-alpine
      environment:
        POSTGRES_USER: zubeli
        POSTGRES_PASSWORD: zubeli_dev
        POSTGRES_DB: zubeli
      ports: ["5432:5432"]
      volumes: [pgdata:/var/lib/postgresql/data]
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U zubeli"]
        interval: 5s
        retries: 10
  volumes:
    pgdata:
  ```
- **Volume persistence**: DB data lives in a named volume — never ephemeral container storage. Compose restarts must survive; backups run against the volume-backed instance (deployment-patterns).
- **Image size/security**: non-root user (as above), pinned base image tags (`node:22-alpine`, `postgres:16-alpine` — no floating `latest`), `.dockerignore` excludes `node_modules`, `.next`, `.git`, `e2e/`, `.env*`. Prefer Alpine; use `npm ci` not `npm install` for deterministic installs.
- **Secrets in containers**: pass at runtime via environment or secret mounts — never baked into images (`docker build --build-arg` only for non-secret build values like `NEXT_PUBLIC_*`). For dev compose, `${VAR}` interpolation from `.env` (gitignored); production uses the secret manager (deployment-patterns).
- Migration on containerized deploy: run `prisma migrate deploy` in a one-off job/init container before app scale-up (deployment-patterns) — not on app boot.

## Do NOT
- Do NOT run containers as root, or mount the host's `.env` wholesale into images.
- Do NOT copy `node_modules` or dev dependencies into the final image.
- Do NOT use `latest` tags or unversioned base images.
- Do NOT skip `.dockerignore` — it's how secrets end up in images.

## Related
- deployment-patterns (deploy pipeline, env vars), postgres-patterns (backups, pooling), e2e-testing (Postgres service in CI). Agents: orchestrator, architect.
