# Troubleshooting Guide

Comprehensive troubleshooting guide for common issues and solutions.

## 🆘 Table of Contents

- [Installation Issues](#installation-issues)
- [Backend Issues](#backend-issues)
- [Frontend Issues](#frontend-issues)
- [Database Issues](#database-issues)
- [Environment Issues](#environment-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)

---

## Installation Issues

### Issue: "command not found: pnpm"

**Symptoms:**

```bash
bash: pnpm: command not found
```

**Causes:**

- pnpm not installed
- PATH not updated after installation

**Solutions:**

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version

# If still not found, update npm first
npm install -g npm@latest
npm install -g pnpm
```

### Issue: "command not found: node"

**Symptoms:**

```bash
bash: node: command not found
```

**Causes:**

- Node.js not installed
- Incorrect Node version

**Solutions:**

```bash
# Check if Node is installed
node --version

# If not installed, download from https://nodejs.org/
# Then verify
node --version  # Should be v18.0.0 or higher

# If wrong version, use nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Issue: Dependencies won't install

**Symptoms:**

```bash
pnpm ERR! ERESOLVE unable to resolve dependency tree
```

**Causes:**

- Incompatible package versions
- Corrupted lock file
- Outdated pnpm version

**Solutions:**

```bash
# Update pnpm
npm install -g pnpm@latest

# Clear cache
pnpm store prune

# Remove lock files and node_modules
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install

# If still failing, try with force
pnpm install --force
```

### Issue: Git clone fails

**Symptoms:**

```bash
fatal: not a git repository
git: command not found
```

**Solutions:**

```bash
# Check if Git is installed
git --version

# Install Git if needed
# Linux: sudo apt-get install git
# macOS: brew install git
# Windows: Download from https://git-scm.com/

# Try cloning again
git clone <repository-url>
```

---

## Backend Issues

### Issue: Backend won't start - Port already in use

**Symptoms:**

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Causes:**

- Another process using port 3000
- Backend already running in another terminal

**Solutions:**

```bash
# Linux/macOS - Find and kill process
sudo lsof -i :5000
sudo lsof -ti:5000 | xargs kill -9

# Windows - Find process
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or change port in .env
# Edit backend/.env
APP_PORT=5001

# Restart backend
pnpm run start:dev
```

### Issue: Backend crashes on startup

**Symptoms:**

```bash
TypeError: Cannot read property of undefined
Error in module initialization
```

**Causes:**

- Missing environment variables
- Database connection failed
- Module import error

**Solutions:**

```bash
cd backend

# Check .env file exists
ls -la .env

# Check if all required variables are set
echo $DATABASE_URL
echo $JWT_SECRET

# If missing, copy from example
cp .env.example .env
# Then edit .env with correct values

# Try debug mode
pnpm run start:debug

# Check for syntax errors in code
pnpm run lint
```

### Issue: Database migrations fail

**Symptoms:**

```bash
Error: Connection to database failed
Error: Table already exists
```

**Causes:**

- Database not running
- Connection string incorrect
- Migrations already applied

**Solutions:**

```bash
cd backend

# Check if PostgreSQL is running
sudo systemctl status postgresql    # Linux
brew services list | grep postgresql # macOS

# Verify connection string
echo $DATABASE_URL

# Check database exists
psql -U postgres -l | grep social_shop_dev

# Try resetting migrations (⚠️ deletes data)
pnpm exec prisma migrate reset

# Or apply migrations fresh
pnpm exec prisma db push
```

### Issue: Prisma Client not found

**Symptoms:**

```bash
Error: @prisma/client: Prisma Client could not be found
```

**Causes:**

- Prisma Client not generated
- node_modules corrupted

**Solutions:**

```bash
cd backend

# Regenerate Prisma Client
pnpm exec prisma generate

# Or reinstall dependencies
pnpm install

# Rebuild
pnpm run build

# Restart
pnpm run start:dev
```

### Issue: TypeScript compilation errors

**Symptoms:**

```bash
error TS2307: Cannot find module
error TS2322: Type 'X' is not assignable to type 'Y'
```

**Causes:**

- Missing type definitions
- Type mismatch
- Import errors

**Solutions:**

```bash
cd backend

# Type check
tsc --noEmit

# Check for obvious issues
pnpm run lint

# Clear and rebuild
rm -rf dist
pnpm run build

# If still failing, check specific file
nano src/main.ts  # or file with error
```

---

## Frontend Issues

### Issue: Frontend won't start

**Symptoms:**

```bash
error - Configuration file ...
Error: Could not find a valid build in the '.next' directory
```

**Causes:**

- .next cache corrupted
- Missing dependencies
- Configuration error

**Solutions:**

```bash
cd frontend

# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
pnpm install

# Rebuild
pnpm run build

# Start fresh
pnpm run dev
```

### Issue: "Module not found" errors

**Symptoms:**

```bash
Module not found: Can't resolve '@/components/ui/button'
```

**Causes:**

- Import path incorrect
- Component file missing
- Alias not configured

**Solutions:**

```bash
# Check if file exists
ls -la frontend/components/ui/button.tsx

# Verify import path
# Correct: import { Button } from '@/components/ui/button';
# Wrong: import { Button } from './components/ui/button';

# Verify tsconfig.json has path alias
cat frontend/tsconfig.json | grep -A 5 "paths"

# Clear cache and rebuild
cd frontend
rm -rf .next
pnpm run build
pnpm run dev
```

### Issue: Tailwind CSS not applying

**Symptoms:**

- Styles not showing
- Classes being stripped
- Colors not working

**Causes:**

- Content path not configured
- PurgeCSS removing used classes
- Build cache issue

**Solutions:**

```bash
cd frontend

# Check tailwind.config.ts
cat tailwind.config.ts

# Should include content paths:
# content: ["./app/**/*.{js,ts,jsx,tsx}"]

# Clear cache
rm -rf .next
pnpm run build

# Check if globals.css is imported
grep "globals.css" app/layout.tsx

# Rebuild
pnpm run dev
```

### Issue: Port 3000 already in use

**Symptoms:**

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

```bash
# Use different port
pnpm run dev -- -p 3001

# Or kill existing process
sudo lsof -ti:3000 | xargs kill -9

# Then restart
pnpm run dev
```

### Issue: API connection errors

**Symptoms:**

```bash
Failed to fetch from http://localhost:3000
CORS error
```

**Causes:**

- Backend not running
- Wrong API URL in .env.local
- CORS not configured

**Solutions:**

```bash
# Verify backend is running
curl http://localhost:5000/health

# Check .env.local
cat frontend/.env.local

# Should have:
# NEXT_PUBLIC_API_URL="http://localhost:5000"

# Check browser console for specific error (F12)

# Verify network tab shows correct URL

# Restart frontend
cd frontend
pnpm run dev

# Or check CORS configuration in backend
```

### Issue: Dark mode not working

**Symptoms:**

- Theme switcher not appearing
- Dark classes not applied
- Theme not persisting

**Causes:**

- next-themes not configured
- Theme provider missing
- localStorage blocked

**Solutions:**

```bash
# Check root layout.tsx
cat app/layout.tsx

# Should include ThemeProvider

# Verify next-themes installed
cd frontend
npm list next-themes

# If missing:
pnpm add next-themes

# Clear browser storage
# F12 → Application → LocalStorage → Clear

# Restart dev server
pnpm run dev
```

---

## Database Issues

### Issue: PostgreSQL connection refused

**Symptoms:**

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causes:**

- PostgreSQL not running
- Connection string incorrect
- PostgreSQL not installed

**Solutions:**

```bash
# Start PostgreSQL
# Linux
sudo systemctl start postgresql

# macOS
brew services start postgresql

# Windows - Use Services app or:
postgres -i

# Verify it's running
sudo systemctl status postgresql

# Test connection
psql -U postgres

# Check connection string in .env
echo $DATABASE_URL

# Should look like:
# postgresql://username:password@localhost:5432/database_name
```

### Issue: Database doesn't exist

**Symptoms:**

```bash
Error: database "social_shop_dev" does not exist
```

**Solutions:**

```bash
# Connect to PostgreSQL
psql -U postgres

# List existing databases
\l

# Create database
CREATE DATABASE social_shop_dev;

# Create user
CREATE USER social_shop_user WITH ENCRYPTED PASSWORD 'password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE social_shop_dev TO social_shop_user;

# Exit
\q

# Test connection
psql -U social_shop_user -d social_shop_dev
```

### Issue: Migration failed

**Symptoms:**

```bash
Error: P3001 Migration reverted
```

**Causes:**

- Schema conflict
- Previous migration failed
- Foreign key constraint

**Solutions:**

```bash
cd backend

# Check migration status
pnpm exec prisma migrate status

# View failed migrations
ls -la prisma/migrations/

# Reset (if development only!)
pnpm exec prisma migrate reset

# Or manually fix and create new migration
pnpm exec prisma migrate dev --name fix_schema
```

### Issue: Too many connections

**Symptoms:**

```bash
Error: too many connections
```

**Causes:**

- Connection pool exhausted
- Multiple processes connecting
- Connection leak

**Solutions:**

```bash
# Stop all Node processes
pkill -f "node"

# Limit connections in connection string
# Add: ?connection_limit=5

# Or modify postgresql.conf
# max_connections = 100
```

### Issue: Data hasn't been saved

**Symptoms:**

- Data visible during session
- Disappears after restart
- No errors shown

**Causes:**

- Using in-memory database
- Transaction not committed
- Connection closed before save

**Solutions:**

```bash
# Verify using real database, not in-memory
echo $DATABASE_URL

# Should point to PostgreSQL, not SQL:memory:

# Check Prisma models are correct
pnpm exec prisma validate

# Add explicit transaction if needed
# In service:
const result = await prisma.$transaction([...])
```

---

## Environment Issues

### Issue: Environment variables not loading

**Symptoms:**

```bash
process.env.DATABASE_URL is undefined
```

**Causes:**

- .env file not in root
- Variable name typo
- .env not committed (if needed)

**Solutions:**

```bash
# Check .env exists
ls -la backend/.env
ls -la frontend/.env.local

# Check variables are set
echo $DATABASE_URL

# Restart application to reload env
pnpm run start:dev

# For Node, .env must be in project root
# Check location:
pwd  # Current directory

# Frontend uses NEXT_PUBLIC_ prefix
# Only prefixed variables are accessible in browser
```

### Issue: NODE_ENV not set correctly

**Symptoms:**

- Production features in development
- Development warnings in production

**Solutions:**

```bash
# Set NODE_ENV explicitly
NODE_ENV=development pnpm run start:dev
NODE_ENV=production pnpm run start:prod

# Or in .env
NODE_ENV="development"

# Verify
echo $NODE_ENV
```

### Issue: Secret keys exposed

**Symptoms:**

- Keys in version control
- Keys in logs

**Prevention:**

```bash
# Add .env to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore

# Use .env.example for template
cp backend/.env.example backend/.env

# Never commit real .env
git status  # Should not show .env

# Regenerate secrets if exposed
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Performance Issues

### Issue: Slow API responses

**Symptoms:**

- API requests take > 1 second
- Database queries slow

**Solutions:**

```bash
cd backend

# Enable query logging
# Add to prisma/schema.prisma logging option

# Check database indexes
# In Prisma Studio, verify indexes exist

# Use prometheus for monitoring:
pnpm add @nestjs/common@^11 @prometheus-prom/client

# Profile with Chrome DevTools
# Backend: Node inspector
pnpm run start:debug
```

### Issue: Large bundle size

**Symptoms:**

- Frontend loads slowly
- Build size > 500MB

**Solutions:**

```bash
cd frontend

# Analyze bundle
pnpm run build --analyze

# Remove unused dependencies
pnpm prune

# Use dynamic imports for heavy components
import dynamic from 'next/dynamic';
const HeavyComponent = dynamic(() => import('./heavy'));
```

### Issue: Memory leak

**Symptoms:**

- Memory usage grows over time
- Process crashes after hours

**Solutions:**

```bash
# Use memory profiler
node --inspect-brk main.js

# Check for:
# - Unclosed database connections
# - Event listeners not removed
# - Large arrays accumulating

# Restart process regularly (deployment)
```

---

## Deployment Issues

### Issue: Application won't build

**Symptoms:**

```bash
Build failed
error: could not compile
```

**Solutions:**

```bash
# Build locally first
pnpm run build

# Fix any errors shown

# Check all dependencies are installed
pnpm install --prod

# Verify environment variables are set in deployment
# Check CI/CD logs

# Common issues:
# - TypeScript errors not caught locally
# - Missing environment variables
# - Version mismatches
```

### Issue: Application crashes in production

**Symptoms:**

- Works locally, crashes on server
- Random errors

**Solutions:**

```bash
# Check logs
# Application should log to file or service

# Verify environment variables
# All required vars must be set

# Test production build locally
NODE_ENV=production pnpm run start

# Use process manager like PM2
npm install -g pm2
pm2 start dist/main.js
pm2 logs
```

### Issue: Database migrations fail in production

**Symptoms:**

- Deployment blocked
- Schema mismatch

**Solutions:**

```bash
# Never run migrate reset in production!

# Use migrate deploy (safe)
pnpm exec prisma migrate deploy

# If column conflicts:
# Create careful migration avoiding data loss

# Backup database first
pg_dump -U user -d db_name > backup.sql

# Test migration on staging first
```

---

## 🆘 Getting More Help

1. **Check the specific README:**
   - Backend issues → [backend/README.md](backend/README.md)
   - Frontend issues → [frontend/README.md](frontend/README.md)

2. **Review documentation:**
   - Setup issues → [SETUP.md](SETUP.md)
   - Architecture questions → [ARCHITECTURE.md](ARCHITECTURE.md)

3. **Check error logs:**
   - Browser console (F12)
   - Terminal output
   - Application logs

4. **Enable debug mode:**
   - `pnpm run start:debug` (backend)
   - Browser DevTools (frontend)
   - `NODE_DEBUG=*` (Node.js)

5. **Search GitHub issues:**
   - Check if issue reported before
   - Provide reproduction steps

---

**Last Updated**: April 2026  
**Troubleshooting Guide Version**: 1.0
