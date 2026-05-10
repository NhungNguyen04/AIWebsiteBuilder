# Codis - AI Website Builder

![Codis home page](public\screenshots\home.png)

Codis is an AI-powered full-stack website generation platform built with Next.js, Prisma, BullMQ, Redis, PostgreSQL, and isolated sandbox execution.

The platform allows users to generate, edit, preview, and manage web projects through AI agents running inside secure sandbox environments.

---

# Features

- AI-powered website generation
- Real-time code editing and preview
- Sandboxed code execution
- Background job processing with BullMQ
- Attach files with prompt for use case specifications
- Persistent storage with PostgreSQL
- AI agent orchestration system
- Async distributed worker architecture
- Real-time messaging workflow
- Dockerized infrastructure
- Scalable queue-based processing pipeline

---

# Architecture

```txt
Client
   ↓
Next.js Frontend
   ↓
TRPC API Layer
   ↓
BullMQ Queue
   ↓
Redis Broker
   ↓
Worker Service
   ↓
E2B Sandbox Environment
   ↓
Generated Website Preview
```

## Core Components

### Frontend

- Next.js App Router
- React-based UI system
- Monaco editor integration
- File explorer and preview interface

### Backend

- TRPC API layer
- Prisma ORM
- PostgreSQL persistence
- Queue management with BullMQ

### Worker System

- Dedicated asynchronous worker service
- AI agent execution pipeline
- Sandbox lifecycle management
- File generation and synchronization

### Sandbox Execution

- Isolated execution environments using E2B
- Terminal command execution
- Dynamic file creation and updates
- Runtime preview hosting

---

# Tech Stack

## Frontend

- Next.js 15
- React 19
- TypeScript
- TailwindCSS
- Radix UI
- TanStack Query

## Backend

- TRPC
- Prisma ORM
- PostgreSQL
- BullMQ
- Redis

## AI & Sandbox

- OpenAI
- Inngest Agent Kit
- E2B Code Interpreter

## Infrastructure

- Docker
- Docker Compose
- Linux VPS Deployment

---

# Distributed System Design

The platform follows an asynchronous distributed architecture:

- Frontend handles user interaction
- API layer queues AI generation jobs
- Redis acts as message broker
- Workers process jobs independently
- Sandboxes execute generated code securely

This separation allows:

- Horizontal worker scaling
- Fault isolation
- Non-blocking request handling
- Independent service deployment
- Better resource utilization

---

# Project Structure

```txt
src/
├── app/                  # Next.js app router
├── components/           # Shared UI components
├── lib/                  # Utilities, Prisma, queues
├── server/               # TRPC server logic
├── workers/              # BullMQ workers
├── prompt/               # AI system prompts
└── generated/            # Prisma generated client

prisma/
├── schema.prisma
└── migrations/

public/
sandbox-templates/
```

---

# Future Improvements

- Authentication and authorization
- Multi-user collaboration
- Streaming AI responses
- Live collaborative editing
- Horizontal worker autoscaling
- Kubernetes deployment
- Sandbox snapshot persistence
- Git integration
- Template marketplace
- Real-time collaborative sessions

---

# License

MIT License.