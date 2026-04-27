# Development Quick Reference

Quick reference guide for common development tasks and commands.

## 🚀 Getting Started

```bash
# Start fresh
git clone <repo>
cd social-shop-assistant
pnpm install

# Backend setup
cd backend
cp .env.example .env
pnpm exec prisma migrate dev
pnpm run start:dev

# (New terminal) Frontend setup
cd frontend
pnpm run dev

# Open applications
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
```

## 📁 Project Structure Cheat Sheet

```yaml
social-shop-assistant/
├── backend/          ← NestJS API Server
├── frontend/         ← Next.js React App
├── README.md         ← Project overview
├── SETUP.md          ← Setup guide
└── ARCHITECTURE.md   ← Technical architecture
```

## 🔧 Backend Commands

### Development

```bash
cd backend

# Start dev server (watch mode)
pnpm run start:dev

# Start debug mode
pnpm run start:debug

# Build for production
pnpm run build

# Run production build locally
pnpm run start:prod
```

### Testing

```bash
cd backend

# Run unit tests
pnpm run test

# Run E2E tests
pnpm run test:e2e

# Coverage report
pnpm run test:cov

# Watch mode for testing
pnpm run test:watch
```

### Code Quality

```bash
cd backend

# Lint code
pnpm run lint

# Fix linting issues
pnpm run lint --fix

# Format code
pnpm run format
```

### Database

```bash
cd backend

# Create new migration
pnpm exec prisma migrate dev --name feature_name

# Apply existing migrations
pnpm exec prisma migrate deploy

# Reset database (⚠️ deletes data)
pnpm exec prisma migrate reset

# Check migration status
pnpm exec prisma migrate status

# Open Prisma Studio (database browser)
pnpm exec prisma studio

# Generate Prisma client
pnpm exec prisma generate

# Validate schema
pnpm exec prisma validate
```

## 🎨 Frontend Commands

### Frontend Development

```bash
cd frontend

# Start dev server
pnpm run dev

# Build for production
pnpm run build

# Run production build locally
pnpm run start

# Lint code
pnpm run lint
```

### Frontend Debugging

```bash
# Open Chrome DevTools
# F12 or Ctrl+Shift+I (Linux/Windows)
# Command+Option+I (macOS)

# React DevTools browser extension recommended
# Navigate to component and use React DevTools tab
```

## 👥 Backend API Endpoints

### Current

```text
GET  http://localhost:5000/health
     └─ Health check
     └─ No auth required
     └─ Returns: {"message": "Hello from NestJS"}
```

### Planned (Not yet implemented)

```text
Authentication
POST /auth/register        - Register new account
POST /auth/login           - Login (returns JWT)
POST /auth/logout          - Logout

Users
GET  /users/:id            - Get user profile
PUT  /users/:id            - Update profile
GET  /users/:id/posts      - Get user's posts

Posts
GET  /posts                - List all posts
POST /posts                - Create new post
GET  /posts/:id            - Get post details
PUT  /posts/:id            - Update post
DELETE /posts/:id          - Delete post
```

## 🌐 Frontend Routing

```text
(Public Routes)
/                          - Landing page
/sign-in                   - Login
/sign-up                   - Registration
/forgot-password           - Password recovery
/reset-password            - Password reset

(Protected Routes - Workspace)
/dashboard                 - Main dashboard
/posts-comments            - Posts management
/analytics                 - Analytics dashboard
/inbox                     - Messages
/accounts                  - Account management
/products                  - Products/Shop
/settings                  - Account settings
```

## 🔐 Authentication

### Environment Variables

```bashbash
# Backend
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRATION="24h"
DATABASE_URL="postgresql://user:pass@localhost:5432/db_name"
APP_PORT=5000

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

### JWT Token Flow

```bash
1. POST /auth/login with credentials
2. Backend returns JWT token
3. Frontend stores token
4. Include in headers: Authorization: Bearer <token>
5. Backend validates token via JWT Guard
6. Grant access if valid
```

## 🗄️ Database Quick Reference

### Main Tables

```sqlsql
-- Users
CREATE TABLE "User" (
  id STRING PRIMARY KEY,
  email STRING UNIQUE,
  username STRING UNIQUE,
  password STRING,
  firstName STRING,
  lastName STRING,
  isActive BOOLEAN,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- Posts
CREATE TABLE "Post" (
  id STRING PRIMARY KEY,
  title STRING,
  content STRING,
  published BOOLEAN,
  authorId STRING,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

### Common Queries (Prisma)

```typescripttypescript
// Users
prisma.user.findUnique({ where: { email } });
prisma.user.create({ data });
prisma.user.update({ where: { id }, data });
prisma.user.delete({ where: { id } });

// Posts
prisma.post.findMany({ include: { author: true } });
prisma.post.findUnique({ where: { id } });
prisma.post.create({ data });
prisma.post.update({ where: { id }, data });
prisma.post.delete({ where: { id } });
```

## 📦 Dependencies Quick Reference

### Backend

```jsonjson
"@nestjs/core": "^11.0.1"          - NestJS framework
"@nestjs/jwt": "^11.0.2"           - JWT auth
"@nestjs/passport": "^11.0.5"      - Passport auth
"@prisma/client": "^7.6.0"         - Database ORM
"bcrypt": "^6.0.0"                 - Password hashing
```

### Frontend

```jsonjson
"next": "16.2.2"                   - React framework
"react": "19.2.4"                  - React library
"tailwindcss": "^4"                - Utility CSS
"radix-ui": "^1.4.3"               - Component library
"recharts": "3.8.0"                - Charts library
```

## 🐛 Troubleshooting Commands

```bashbash
# Check Node version
node --version

# Check pnpm version
pnpm --version

# Check if PostgreSQL running
psql --version

# Test backend API
curl http://localhost:5000/health

# Check ports in use (Linux/Mac)
lsof -i :3000
lsof -i :5000
lsof -i :5432

# Kill process on port (Linux/Mac)
sudo lsof -ti:5000 | xargs kill -9
sudo lsof -ti:3000 | xargs kill -9

# Clear npm/pnpm cache
pnpm store prune

# Reset node_modules
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Check environment variables
echo $DATABASE_URL
```

## 📝 File Naming Conventions

### Backend Files

- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Modules: `*.module.ts`
- Tests: `*.spec.ts`
- E2E Tests: `*.e2e-spec.ts`

### Frontend Files

- Components: `ComponentName.tsx` (PascalCase)
- Pages: `page.tsx` in page directories
- Utilities: `utilityName.ts` (camelCase)
- Hooks: `useHookName.ts` (camelCase)
- Styles: Tailwind classes, no separate CSS files

## 🔄 Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Make changes
git add .
git commit -m "feat: describe changes"

# Push to remote
git push origin feature/feature-name

# Create pull request (on GitHub)

# After review and approval
git checkout main
git pull origin main
git merge feature/feature-name
git push origin main
```

## 🚢 Deployment Quick Reference

### Backend Deployment

```bashbashbash
cd backend
pnpm run build
NODE_ENV=production pnpm run start:prod
```

### Frontend Deployment

```bashbashbash
cd frontend
pnpm run build
pnpm run start
```

### Environment Variables to Set

### Backend Production

```bashbash
DATABASE_URL=postgresql://...
JWT_SECRET=<strong-random-secret>
NODE_ENV=production
APP_PORT=5000
```

### Frontend Production

```bashbash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NODE_ENV=production
```

## 📱 Component Usage Examples

### Backend - Creating a Controller

```typescripttypescript
import { Controller, Get, Post, Body } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller("feature")
export class FeatureController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getAll() {
    return this.appService.getAll();
  }

  @Post()
  create(@Body() data: any) {
    return this.appService.create(data);
  }
}
```

### Frontend - Creating a Component

```typescripttypescript
'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function MyComponent() {
  return (
    <Card className="p-4">
      <h1 className="text-2xl font-bold">Hello World</h1>
      <Button>Click me</Button>
    </Card>
  );
}
```

## 🔗 Useful Links

- [NestJS Docs](https://docs.nestjs.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

## 💡 Pro Tips

1. **Keep terminals organized**: One for backend, one for frontend
2. **Use Prisma Studio**: Visual way to inspect database
3. **Hot reload enabled**: Changes auto-load in dev mode
4. **Use TypeScript**: Catch errors before runtime
5. **Read error messages**: Usually contains the solution
6. **Check .env files**: Most issues are config-related
7. **Test locally first**: Before pushing to repository
8. **Commit frequently**: Easier to debug and revert
9. **Document as you code**: Future you will thank you
10. **Ask for help**: Team is here to assist

---

**Last Updated**: April 2026  
**Quick Reference Version**: 1.0
