# Setup & Installation Guide

Complete step-by-step guide for setting up the Social Shop Assistant project locally for development.

## 🎯 Prerequisites Checklist

Before starting, ensure you have the following installed:

- [ ] **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))

  ```bash
  node --version  # Should output v18.0.0 or higher
  ```

- [ ] **pnpm** >= 8.0.0 ([Install Guide](https://pnpm.io/installation))

  ```bash
  npm install -g pnpm
  pnpm --version  # Should output 8.0.0 or higher
  ```

- [ ] **PostgreSQL** >= 12 ([Download](https://www.postgresql.org/download/))

  ```bash
  psql --version  # Should show PostgreSQL version
  ```

- [ ] **Git** (for cloning repository)

  ```bash
  git --version
  ```

- [ ] **Text Editor/IDE** - VS Code recommended ([Download](https://code.visualstudio.com/))

## 📦 Installation Steps

### 1. Clone Repository

```bash
# Clone the repository
git clone <repository-url>
cd social-shop-assistant

# Navigate to project root
ls -la
# output should show: README.md, backend/, frontend/, automation/
```

### 2. Install Root Dependencies

```bash
# From project root
pnpm install

# This installs dependencies for both backend and frontend (monorepo setup)
```

### 3. Database Setup

#### Step 3a: Start PostgreSQL

**Linux (Ubuntu/Debian):**

```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Verify it's running
sudo systemctl status postgresql
```

**macOS (Homebrew):**

```bash
# Start PostgreSQL
brew services start postgresql

# Verify it's running
brew services list | grep postgresql
```

**Windows:**

- PostgreSQL should start automatically after installation
- Or use PostgreSQL menu to start the service

#### Step 3b: Create Development Database

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# You should see the psql prompt: postgres=#

# Create the development database
CREATE DATABASE social_shop_dev;

# Create a user with password
CREATE USER social_shop_user WITH ENCRYPTED PASSWORD 'dev_password_123';

# Grant privileges to the user
ALTER ROLE social_shop_user CREATEDB;

# Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE social_shop_dev TO social_shop_user;

# Connect to the database
\c social_shop_dev

# Grant schema privileges
GRANT ALL ON SCHEMA public TO social_shop_user;

# Exit psql
\q
```

**Verify Connection:**

```bash
psql -U social_shop_user -h localhost -d social_shop_dev

# You should be able to connect (password: dev_password_123)
# Exit with: \q
```

### 4. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
# You can use any text editor
nano .env

# OR use this one-liner to set up .env:
cat > .env << EOF
DATABASE_URL="postgresql://social_shop_user:dev_password_123@localhost:5432/social_shop_dev"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-min-32-chars!-$(openssl rand -hex 16)"
JWT_EXPIRATION="24h"
NODE_ENV="development"
APP_PORT=5000
EOF
```

#### Initialize Database Schema

```bash
# Create and run migrations
pnpm exec prisma migrate dev --name init

# This will:
# 1. Create database tables from schema.prisma
# 2. Generate Prisma Client
# 3. Seed database if seed function exists
```

**Expected Output:**

```bash
✔ Database prepared
✔ New migration created
✔ Prisma Client generated
```

**Verify Database:**

```bashbash
# Open Prisma Studio (database browser)
pnpm exec prisma studio

# This opens http://localhost:5555
# You can browse tables, add data, run queries
# Ctrl+C to exit
```

### 5. Start Backend Server

```bash
# From backend directory
# Start in development mode (watch for changes)
pnpm run start:dev

# You should see:
# [Nest] 12345  - 04/06/2026, 3:00:00 PM   LOG [NestApplication] Application is listening on port 5000
```

**Test Backend:**

```bashbash
# In a new terminal, test the health endpoint
curl http://localhost:5000/health

# Should return:
# {"message":"Hello from NestJS"}
```

**Stop Backend:**

```bashbash
# Press Ctrl+C in the backend terminal
```

### 6. Frontend Setup

```bashbash
# From project root, navigate to frontend
cd frontend

# Install dependencies
pnpm install

# Create environment file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL="http://localhost:5000"
NODE_ENV="development"
EOF

# Verify environment is set
cat .env.local
```

### 7. Start Frontend Server

```bash
# From frontend directory
# Start development server
pnpm run dev

# You should see:
# ▲ Next.js 16.2.2
# - Local: http://localhost:3000
# - Environments: .env.local
```

**Access Application:**

- Open browser to: `http://localhost:3000`
- You should see the Social Shop Assistant home page

**Stop Frontend:**

```bash
# Press Ctrl+C in the frontend terminal
```

## 🎉 Verification

You should now have:

- ✅ PostgreSQL database running
- ✅ Backend API at `http://localhost:5000`
- ✅ Frontend running at `http://localhost:3000`

```yaml
social-shop-assistant/
├── backend/
│   ├── .env                    # ← Environment variables (development)
│   ├── node_modules/           # ← Dependencies
│   ├── dist/                   # ← Compiled JavaScript
│   ├── prisma/
│   │   └── migrations/         # ← Database migration history
│   ├── src/
│   └── ...
├── frontend/
│   ├── .env.local              # ← Environment variables (development)
│   ├── node_modules/           # ← Dependencies
│   ├── .next/                  # ← Next.js build cache
│   ├── app/
│   ├── components/
│   └── ...
├── automation/
├── README.md
└── ...
```

## 🔧 Common Tasks During Development

### Running Both Servers

**Terminal 1 - Backend:**

```bash
cd backend
pnpm run start:dev
# Runs on http://localhost:5000
```

**Terminal 2 - Frontend:**

```bash
cd frontend
pnpm run dev
# Runs on http://localhost:3000
```

### Building for Production

```bash
# Backend
cd backend
pnpm run build    # Creates dist/ folder

# Frontend
cd frontend
pnpm run build    # Creates .next/ folder
```

### Database Management

```bash
# Open database browser
cd backend
pnpm exec prisma studio    # http://localhost:5555

# Reset database (⚠️ deletes all data)
cd backend
pnpm exec prisma migrate reset

# Check migration status
cd backend
pnpm exec prisma migrate status
```

### Running Tests

```bash
# Backend tests
cd backend
pnpm run test           # Unit tests
pnpm run test:e2e       # End-to-end tests

# Frontend tests
cd frontend
pnpm run lint           # Linting
```

## 🐛 Troubleshooting

### Issue: "command not found: pnpm"

**Solution:**

```bash
npm install -g pnpm
# Verify installation
pnpm --version
```

### Issue: PostgreSQL Connection Refused

**Solution:**

```bash
# Check if PostgreSQL is running
# Linux
sudo systemctl status postgresql

# macOS
brew services list | grep postgresql

# Windows - check Services app

# Start PostgreSQL if not running
# Linux
sudo systemctl start postgresql

# macOS
brew services start postgresql
```

### Issue: Database Already Exists

When running migrations, you might see:

```bash
Error: Database "social_shop_dev" already exists
```

**Solution:**

```bash
cd backend

# Option 1: Drop and recreate (removes all data)
pnpm exec prisma migrate reset

# Option 2: Skip creation (if schema differs)
pnpm exec prisma db push
```

### Issue: Port Already in Use

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**

```bash
# Find process using port 3000
# Linux/Mac: sudo lsof -ti:3000 | xargs kill -9
# Windows: netstat -ano | findstr :3000, then taskkill /PID <PID> /F

# Or change port in .env
# Backend:
APP_PORT=3001

# Frontend:
pnpm run dev -- -p 3001
```

### Issue: Dependencies Not Installing

```bash
pnpm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**

```bash
# Clear pnpm cache and reinstall
pnpm store prune
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install
```

### Issue: .env File Not Found

**Solution:**

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with correct values

# Frontend
cd frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL="http://localhost:5000"
EOF
```

## ✅ Checklist Before Starting Development

- [ ] Node.js and pnpm installed
- [ ] PostgreSQL installed and running
- [ ] Repository cloned
- [ ] `pnpm install` completed
- [ ] Database created and user setup
- [ ] Backend `.env` configured with DATABASE_URL and APP_PORT=5000
- [ ] Frontend `.env.local` configured with `NEXT_PUBLIC_API_URL="http://localhost:5000"`
- [ ] Backend migrations ran (`prisma migrate dev`)
- [ ] Backend starts without errors (`pnpm run start:dev`)
- [ ] Backend health check returns 200 (curl `http://localhost:5000/health`)
- [ ] Frontend `.env.local` created
- [ ] Frontend starts without errors (`pnpm run dev`)
- [ ] Frontend loads at `http://localhost:3000`

## 📚 Next Steps

1. **Backend Development**: See [backend/README.md](./backend/README.md)
2. **Frontend Development**: See [frontend/README.md](./frontend/README.md)
3. **Automation**: See [automation/README.md](./automation/README.md)
4. **Main Documentation**: See [README.md](./README.md)

## 🆘 Getting Help

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Review relevant README in the component folder
3. Check terminal output for error messages
4. Consult the team or create an issue

## 💾 Saving Your Setup

### Create Database Backup

```bash
# Backup database
pg_dump -U social_shop_user -d social_shop_dev > backup.sql

# Restore from backup
psql -U social_shop_user -d social_shop_dev < backup.sql
```

### Save Environment Configuration

```bash
# Save your environment variables (never commit to git)
cp backend/.env backend/.env.backup
cp frontend/.env.local frontend/.env.local.backup
```

---

**Setup Date**: April 2026  
**Last Updated**: April 2026  
**Support**: Refer to individual component READMEs
