# Docker Setup Guide for Homina

This guide covers how to containerize and run Homina using Docker for both development (Windows) and production (Linux) environments.

---

## Table of Contents

-   [Prerequisites](#prerequisites)
-   [Windows Development Setup](#windows-development-setup)
-   [Linux Production Setup](#linux-production-setup)
-   [Database Migration](#database-migration)
-   [Common Commands](#common-commands)
-   [Automated Backups](#automated-backups)
-   [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Windows 11 (Development)

1. **Install Docker Desktop**

    - Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
    - Run the installer
    - Enable **WSL 2 backend** when prompted (recommended)
    - Restart your computer if required

2. **Install WSL 2** (if not already installed)

    ```powershell
    wsl --install
    ```

3. **Start Docker Desktop**

    - Launch Docker Desktop from the Start menu
    - Wait for it to fully start (icon in system tray shows "Docker Desktop is running")

4. **Verify installation**
    ```bash
    docker --version
    docker compose version
    ```

### Linux (Production)

1. **Install Docker Engine**

    ```bash
    # Ubuntu/Debian
    curl -fsSL https://get.docker.com | sh

    # Add your user to the docker group (avoid using sudo)
    sudo usermod -aG docker $USER

    # Log out and back in for group changes to take effect
    exit
    ```

2. **Install Docker Compose Plugin**

    ```bash
    sudo apt-get update
    sudo apt-get install docker-compose-plugin
    ```

3. **Verify installation**

    ```bash
    docker --version
    docker compose version
    ```

4. **Enable Docker to start on boot**
    ```bash
    sudo systemctl enable docker
    ```

---

## Windows Development Setup

### 1. Ensure Environment Variables

Make sure your `.env` file exists in the project root with:

```env
DB_NAME=homina
DB_USER=your_db_user
DB_PWD=your_db_password
INFISICAL_SECRET=your_infisical_secret
INFISICAL_ID=your_infisical_id
INFISICAL_WORKSPACE=your_infisical_workspace
```

### 2. Build and Start Containers

```bash
# Navigate to project directory
cd /path/to/Homina

# Build and start in development mode
docker compose -f docker-compose.dev.yml up --build
```

This will:

-   Build the bot container with hot-reload enabled
-   Start a PostgreSQL database on port 5432
-   Mount your source code for live changes

### 3. Run in Background (Detached Mode)

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### 4. View Logs

```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Bot only
docker compose -f docker-compose.dev.yml logs -f bot

# Database only
docker compose -f docker-compose.dev.yml logs -f db
```

### 5. Stop Containers

```bash
# Stop and remove containers
docker compose -f docker-compose.dev.yml down

# Stop and remove containers + volumes (WARNING: deletes database data)
docker compose -f docker-compose.dev.yml down -v
```

### 6. Run Migrations

```bash
docker exec homina-bot-dev bun run migrate
```

### 7. Deploy Discord Commands

```bash
docker exec homina-bot-dev bun run deployCommands
```

---

## Linux Production Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/Homina.git
cd Homina
```

### 2. Create Environment File

```bash
cp .env.example .env
nano .env
```

Add your production values:

```env
DB_NAME=homina
DB_USER=your_db_user
DB_PWD=your_secure_password
INFISICAL_SECRET=your_infisical_secret
INFISICAL_ID=your_infisical_id
INFISICAL_WORKSPACE=your_infisical_workspace
```

### 3. Build and Start Containers

```bash
# Build and start in production mode (detached)
docker compose up -d --build
```

### 4. View Logs

```bash
# Follow all logs
docker compose logs -f

# Bot logs only
docker compose logs -f bot
```

### 5. Run Migrations

```bash
docker exec homina-bot bun run migrate
```

### 6. Deploy Discord Commands

```bash
docker exec homina-bot bun run deployCommands
```

### 7. Check Container Health

```bash
docker ps
docker compose ps
```

---

## Database Migration

### Migrating from Existing PostgreSQL to Docker

If you have an existing PostgreSQL database, follow these steps:

#### 1. Backup Existing Database (on current server)

```bash
pg_dump -U your_db_user -h localhost homina > homina_backup.sql
```

#### 2. Start Only the Database Container

```bash
docker compose up -d db
```

#### 3. Restore the Backup

```bash
# Copy backup file into container and restore
docker exec -i homina-db psql -U your_db_user -d homina < homina_backup.sql
```

#### 4. Start the Bot

```bash
docker compose up -d bot
```

#### 5. Run Any New Migrations

```bash
docker exec homina-bot bun run migrate
```

---

## Common Commands

### Container Management

| Command                        | Description                   |
| ------------------------------ | ----------------------------- |
| `docker compose up -d --build` | Build and start in background |
| `docker compose down`          | Stop and remove containers    |
| `docker compose restart`       | Restart all containers        |
| `docker compose restart bot`   | Restart only the bot          |
| `docker compose ps`            | List running containers       |
| `docker compose logs -f`       | Follow logs                   |

### Executing Commands in Containers

| Command                                                  | Description              |
| -------------------------------------------------------- | ------------------------ |
| `docker exec homina-bot bun run migrate`                 | Run database migrations  |
| `docker exec homina-bot bun run deployCommands`          | Deploy Discord commands  |
| `docker exec homina-bot bun run testDb`                  | Test database connection |
| `docker exec -it homina-db psql -U $DB_USER -d $DB_NAME` | Open PostgreSQL shell    |

### Updating the Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build

# Run migrations if needed
docker exec homina-bot bun run migrate
```

---

## Automated Backups

### Setup Automated Backups (Linux Production)

1. **Make the backup script executable**

    ```bash
    chmod +x scripts/backup.sh
    ```

2. **Test the backup script**

    ```bash
    ./scripts/backup.sh
    ```

3. **Add to crontab for daily backups at 2 AM**

    ```bash
    crontab -e
    ```

    Add this line:

    ```
    0 2 * * * /path/to/Homina/scripts/backup.sh >> /var/log/homina-backup.log 2>&1
    ```

4. **Verify crontab**
    ```bash
    crontab -l
    ```

### Manual Backup

```bash
# Create a backup
docker exec homina-db pg_dump -U $DB_USER homina > backups/homina_$(date +%Y%m%d).sql

# Compress it
gzip backups/homina_$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
# Decompress if needed
gunzip backups/homina_20260117.sql.gz

# Restore
docker exec -i homina-db psql -U $DB_USER -d homina < backups/homina_20260117.sql
```

---

## Troubleshooting

### Common Issues

#### "Cannot connect to the Docker daemon"

-   **Windows**: Make sure Docker Desktop is running
-   **Linux**: Start the Docker service: `sudo systemctl start docker`

#### "Port 5432 already in use"

-   Another PostgreSQL instance is running
-   Stop it: `sudo systemctl stop postgresql` (Linux) or stop the service in Windows
-   Or change the port mapping in `docker-compose.dev.yml`

#### "Container keeps restarting"

-   Check logs: `docker compose logs bot`
-   Usually indicates missing environment variables or database connection issues

#### "Database connection refused"

-   The database container might not be ready yet
-   Wait a few seconds and try again
-   Check if db container is healthy: `docker compose ps`

#### "Permission denied" on logs folder (Linux)

```bash
sudo chown -R 1001:1001 logs
```

#### Bot can't connect to database in container

-   Ensure `DB_HOST=db` in your environment (not `localhost`)
-   The `db` hostname refers to the database service name in docker-compose

### Viewing Container Details

```bash
# Inspect a container
docker inspect homina-bot

# Check container resource usage
docker stats

# View container processes
docker top homina-bot
```

### Cleaning Up

```bash
# Remove unused images
docker image prune

# Remove all stopped containers
docker container prune

# Remove unused volumes (WARNING: may delete data)
docker volume prune

# Nuclear option: remove everything unused
docker system prune -a
```

---

## File Structure Reference

```
Homina/
├── Dockerfile              # Multi-stage build for production
├── docker-compose.yml      # Production configuration
├── docker-compose.dev.yml  # Development configuration
├── .dockerignore           # Files excluded from Docker build
├── .env                    # Environment variables (not in git)
├── scripts/
│   └── backup.sh           # Automated backup script
├── backups/                # Database backups (created automatically)
└── logs/                   # Application logs (persisted)
    ├── app/
    └── error/
```
