# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies only
FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Production image
FROM base AS runner
WORKDIR /app

# Install dependencies for canvas (required for chart generation)
RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 homina

# Copy application files
COPY --from=builder --chown=homina:nodejs /app ./

# Create log directories with proper permissions
RUN mkdir -p logs/app logs/error && \
    chown -R homina:nodejs logs

USER homina

# Health check using the testDb script
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD bun run testDb || exit 1

CMD ["bun", "run", "index.ts"]
