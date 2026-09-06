# High-Performance E-Commerce Backend (Bun.js + Elysia + Prisma)

Production-grade e-commerce REST engine engineered for sub-millisecond cold starts, strict end-to-end type safety, and atomic concurrent checkout transactions backed by PostgreSQL and Prisma ORM.

---

## Architecture & Technology Stack

* **Runtime:** [Bun.js](https://bun.sh/) (v1.2+) - High-performance JavaScript/TypeScript runtime with native bundler, test runner, and cryptographic primitives.
* **Web Framework:** [Elysia.js](https://elysiajs.com/) (v1.4+) - Ergonomic web framework leveraging TypeBox for edge validation and OpenAPI generation.
* **ORM & Database:** [Prisma ORM](https://www.prisma.io/) (v6+) + [PostgreSQL](https://www.postgresql.org/) - Type-safe database client adhering to `prisma-expert` indexing and connection pooling guidelines.
* **Authentication:** Stateless HMAC-SHA256 JWT pipeline with native crypto verification and Role-Based Access Control (RBAC).
* **Concurrency:** Pessimistic row locking (`SELECT ... FOR UPDATE`) within interactive transactions (`$transaction`) guaranteeing zero overselling.
* **Containerization:** Multi-stage Alpine Dockerfile with non-root security.

---

## Directory Structure

```
├── prisma/
│   └── schema.prisma                   # Production PostgreSQL Prisma schema
├── src/
│   ├── index.ts                        # Application bootstrap & plugin pipeline
│   ├── db/
│   │   └── prisma.ts                   # Singleton PrismaClient (Connection pooling & graceful shutdown)
│   ├── common/
│   │   ├── config/
│   │   │   └── env.ts                  # Strictly typed environment configuration
│   │   ├── errors/
│   │   │   └── app-error.ts            # Typed domain error classes
│   │   └── middleware/
│   │       ├── auth.ts                 # Stateless JWT derive & RBAC guard
│   │       ├── security.ts             # Security headers & sliding-window rate limiting
│   │       └── error-handler.ts        # Global error response transformer
│   └── modules/                        # Domain feature modules
│       ├── products/
│       │   └── product.cache.ts        # TTL catalog caching & invalidation
│       └── orders/
│           ├── order.model.ts          # TypeBox validation schemas
│           ├── order.service.ts        # Atomic $transaction checkout engine
│           └── order.routes.ts         # /api/v1/orders routes
├── test/
│   ├── health.test.ts                  # System & health test suite
│   └── checkout.test.ts                # Checkout & auth guard tests
├── .env.example
├── bunfig.toml                         # Bun runtime & test runner configuration
├── Dockerfile                          # Multi-stage production container
├── package.json
└── tsconfig.json
```

---

## Getting Started

### 1. Prerequisites
* [Bun](https://bun.sh/) installed (`curl -fsSL https://bun.sh/install | bash` or via PowerShell on Windows).
* PostgreSQL running locally or in Docker.

### 2. Installation
```bash
bun install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and configure your database connection and secrets:
```bash
cp .env.example .env
```

### 4. Database Setup
```bash
# Generate Prisma Client
bun run prisma:generate

# Run Migrations
bun run prisma:migrate
```

### 5. Running the Application
```bash
# Development mode with hot-reloading
bun run dev

# Production start
bun run start
```

### 6. Interactive API Documentation
Once running, explore the OpenAPI documentation and Swagger UI at:
```
http://localhost:3000/docs
```

---

## Testing & Quality Assurance
Run the test suite using Bun's native test runner:
```bash
bun test
```
Verify TypeScript types:
```bash
bun x tsc --noEmit
```

---

## Docker Deployment

Build and run the production image:
```bash
docker build -t ecommerce-backend-bun .
docker run -p 3000:3000 --env-file .env ecommerce-backend-bun
```

---

## License
MIT
