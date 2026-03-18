# ─── Stage 1: Build ────────────────────────────────────────────────────────
# Uses all devDependencies to compile TypeScript via `nest build`.
# The compiled output is then copied into the lean production stage.
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first — Docker caches this layer until package files change,
# avoiding a full `npm ci` on every source-only edit.
COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: Production ───────────────────────────────────────────────────
# Starts fresh from a clean base image — no compiler, no devDependencies,
# no source files. Only the compiled output and runtime dependencies ship.
FROM node:22-alpine AS production

# curl is used only for the HEALTHCHECK instruction below.
# addgroup/adduser creates a non-root user — running as root in a container
# is a security risk; any exploit gets host-root if the container is privileged.
RUN apk add --no-cache curl \
    && addgroup -S app \
    && adduser -S app -G app

WORKDIR /app

# Install production dependencies only — strips all dev tooling from the image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Pull compiled application from the builder stage.
COPY --from=builder /app/dist ./dist

USER app

EXPOSE 3000

# Liveness check: confirms the event loop is responding.
# Matches the /health liveness endpoint defined in HealthController.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main"]
