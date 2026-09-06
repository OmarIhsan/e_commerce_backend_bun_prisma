# ==============================================================================
# Production Dockerfile: High-Performance Bun.js + Prisma E-Commerce Engine
# ==============================================================================

# Stage 1: Build & Dependencies
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Install OpenSSL & libc compatibility for Prisma Query Engine on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy package manifests
COPY package.json bun.lock* ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for Prisma generate)
RUN bun install --frozen-lockfile

# Generate Prisma Client specifically for the Alpine Linux runtime
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
RUN bun x prisma generate

# Copy application source code
COPY tsconfig.json bunfig.toml ./
COPY src ./src

# Verify build and compile TypeScript assets
RUN bun x tsc --noEmit

# ==============================================================================
# Stage 2: Final Production Runtime Image
# ==============================================================================
FROM oven/bun:1.2-alpine AS runner

WORKDIR /app

# Install runtime OpenSSL libraries required by Prisma engine
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=3000

# Copy generated Prisma client, dependencies, and application source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bunfig.toml ./bunfig.toml

# Switch to non-privileged user for container security
USER bun

# Expose HTTP port
EXPOSE 3000

# Health check definition
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application with Bun native runtime
CMD ["bun", "run", "src/index.ts"]
