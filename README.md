
# 🛡️ Klarheit
**High-Performance Fintech Fraud Detection & Transaction Streaming**

`Klarheit` is a modern, full-stack monorepo designed for real-time financial monitoring. Built with a focus on type-safety, low latency, and cinematic UI, it leverages the **Better-T-Stack** to deliver a robust fraud detection engine.

---

## ⚡ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | [Bun](https://bun.sh/) (High-performance JS runtime) |
| **Frontend** | [Next.js](https://nextjs.org/) (App Router, React) |
| **Backend** | [ElysiaJS](https://elysiajs.com/) (High-performance web framework) |
| **API Layer** | [oRPC](https://orpc.org/) (End-to-end type-safety & OpenAPI) |
| **Database** | PostgreSQL + [Prisma ORM](https://www.prisma.io/) |
| **Auth** | [Better-Auth](https://better-auth.com/) |
| **Styling** | TailwindCSS + [Shadcn/UI](https://ui.shadcn.com/) |
| **Monorepo** | [Turborepo](https://turbo.build/) |

---

## ✨ Key Features

- **Real-time Streaming:** Live transaction monitoring via WebSockets / Socket.io.
- **Fraud Detection Engine:** High-speed data processing architecture inspired by Kafka/RabbitMQ patterns.
- **Unified Type-Safety:** Shared types across frontend and backend via oRPC.
- **Modern Aesthetics:** Minimalist, "Noir" fintech dashboard optimized for clarity and speed.
- **Monorepo Architecture:** Clean separation of concerns between `apps/web`, `apps/server`, and shared `packages`.



## 📂 Project Structure

Klarheit/
├── apps/
│   ├── web/         # Next.js Dashboard UI
│   └── server/      # Elysia + oRPC Backend Engine
├── packages/
│   ├── ui/          # Shared shadcn/ui primitives & global styles
│   ├── api/         # Core business logic & API definitions
│   ├── auth/        # Authentication configuration
│   └── db/          # Prisma schema & PostgreSQL connection
├── docker-compose.yml # Infrastructure (PostgreSQL, Redis, etc.)
└── turbo.json       # Build pipeline configuration




## 🚀 Getting Started

### 1. Prerequisites

Ensure you have [Bun](https://bun.sh/) installed on your system.

---

### 2. Installation

```bash
bun install
```

---

### 3. Environment Setup

Create a `.env` file in both `apps/server/` and `apps/web/`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/klarheit"
BETTER_AUTH_SECRET="your_secret_here"
```

---

### 4. Database Initialization

```bash
bun run db:push
bun run db:generate
```

---

### 5. Development

Run the entire stack (Frontend + Backend):

```bash
bun run dev
```

* Web Dashboard → [http://localhost:3001](http://localhost:3001)
* API Server → [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Development Scripts

| Command               | Action                       |
| :-------------------- | :--------------------------- |
| `bun run dev`         | Start all apps in watch mode |
| `bun run build`       | Production build             |
| `bun run check`       | Lint + format (Biome)        |
| `bun run db:studio`   | Open Prisma Studio           |
| `bun run check-types` | TypeScript validation        |

---

## 🌐 Deployment

Optimized for **Cloudflare via Alchemy**:

```bash
cd apps/web
bun run deploy
```

---

## 👤 Author

**Udit**
GitHub: [https://github.com/BuddyCodez](https://github.com/BuddyCodez)

---

> *Klarheit: Because financial systems deserve absolute clarity.*

```
```
