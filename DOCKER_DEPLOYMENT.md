# Docker Deployment Guide

This guide explains how to deploy the Website Builder application to a virtual machine using Docker.

## Prerequisites

- Docker Engine (v20.10+) installed on your VM
- Docker Compose (v2.0+) installed on your VM
- PostgreSQL database (can be containerized)
- Redis (can be containerized)
- Port 3000 exposed for the application

## Quick Start with Docker Compose

### 1. Clone or transfer the project to your VM

```bash
# On your VM
cd /path/to/websitebuilder
```

### 2. Set up environment variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your production values
nano .env
```

#### Option A: Use Containerized Databases (Easiest for development/testing)
```
DATABASE_URL=postgresql://websitebuilder:changeme@postgres:5432/websitebuilder
REDIS_URL=redis://redis:6379
DB_USER=websitebuilder
DB_PASSWORD=changeme
DB_NAME=websitebuilder
```

#### Option B: Use External Databases (Recommended for production)
```
DATABASE_URL=postgresql://user:password@your-postgres-host:5432/database
REDIS_URL=redis://your-redis-host:6379
NODE_ENV=production
```

Then comment out the `postgres` and `redis` services in docker-compose.yml if not needed.

### 3. Start the application

```bash
# Build and start all services (app, database, Redis)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app
```

### 4. Run database migrations (if needed)

```bash
# Connect to the app container and run migrations
docker-compose exec app npx prisma migrate deploy
```

### 5. Stop the application

```bash
docker-compose down
```

## Manual Docker Deployment (Without Docker Compose)

### 1. Build the Docker image

```bash
docker build -t websitebuilder:latest .
```

### 2. Run the container

```bash
docker run -d \
  --name websitebuilder \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  -e REDIS_URL="redis://host:6379" \
  websitebuilder:latest
```

## Production Deployment Tips

### Using External Databases

If you have existing PostgreSQL and Redis instances, you can use them instead of containerizing:

**Edit docker-compose.yml:**
```yaml
# Remove or comment out the postgres and redis services
# Keep only the app service

app:
  build: .
  ports:
    - "3000:3000"
  environment:
    NODE_ENV: production
    DATABASE_URL: postgresql://user:pass@external-db:5432/dbname
    REDIS_URL: redis://external-redis:6379
```

**Or just use `.env`:**
```
DATABASE_URL=postgresql://user:password@your-db-host:5432/database
REDIS_URL=redis://your-redis-host:6379
```

Then run without database services:
```bash
docker-compose up -d app
```

Create a `.env` file with:
```
NODE_ENV=production
DATABASE_URL=postgresql://user:password@hostname:5432/database
REDIS_URL=redis://hostname:6379
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

### Resource Limits

```bash
# Run with memory and CPU limits
docker run -d \
  --name websitebuilder \
  --memory=2g \
  --cpus=1 \
  -p 3000:3000 \
  websitebuilder:latest
```

### Health Checks

The container includes built-in health checks. Monitor them:
```bash
docker inspect --format='{{.State.Health.Status}}' websitebuilder
```

### Persistent Storage

For production, ensure database and Redis data persists:
```bash
# Create volumes
docker volume create websitebuilder-postgres
docker volume create websitebuilder-redis

# Use in docker-compose or docker run with -v flag
```

### SSL/TLS with Nginx Reverse Proxy

```bash
# Run app on localhost only
docker run -d \
  --name websitebuilder \
  -p 127.0.0.1:3000:3000 \
  websitebuilder:latest
```

Then configure Nginx as a reverse proxy with SSL.

## Troubleshooting

### View logs
```bash
docker-compose logs app
# or
docker logs websitebuilder
```

### Database connection issues
```bash
# Test database connectivity
docker-compose exec app npx prisma db push
```

### Clear Redis cache
```bash
docker-compose exec redis redis-cli FLUSHALL
```

### Restart application
```bash
docker-compose restart app
# or
docker restart websitebuilder
```

## Updating the Application

```bash
# Pull latest code
git pull

# Rebuild image
docker-compose build --no-cache

# Restart services
docker-compose up -d
```

## Performance Optimization

- Use `.dockerignore` to exclude unnecessary files (already included)
- Multi-stage build reduces final image size (~300MB)
- Alpine base image keeps footprint small
- Non-root user improves security
- Health checks prevent traffic to unhealthy containers

## Security Best Practices

✓ Non-root user (nextjs)
✓ No secrets in Dockerfile
✓ Minimal base image (Alpine)
✓ Health checks enabled
✓ dumb-init for proper signal handling

## Next Steps

1. Update environment variables in `.env`
2. Ensure database and Redis are accessible
3. Configure firewall rules on your VM
4. Set up monitoring (optional)
5. Configure log rotation
6. Set up auto-restart policies

---

For more information about Next.js deployment: https://nextjs.org/docs/deployment
