# Backend - Social Shop Assistant API

NestJS + Prisma backend providing RESTful endpoints for user management, products, and related services.

## 🚀 Quick Start

```bash
# Install
pnpm install

# Setup environment
cp .env.example .env

# Initialize database
pnpm exec prisma migrate dev

# Start development server
pnpm run start:dev
```

API available at `http://localhost:5000`

## ⚙️ Configuration

### Environment Variables

Create `.env` in backend root:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/social_shop_dev"

# JWT
JWT_SECRET="your-secret-key-min-32-characters"
JWT_EXPIRATION="24h"

# App
NODE_ENV="development"
APP_PORT=5000
```

## 📋 Commands

```bash
# Development
pnpm run start:dev          # Watch mode
pnpm run start:debug        # Debug mode

# Production
pnpm run build
pnpm run start:prod

# Code Quality
pnpm run lint
pnpm run format

# Database
pnpm exec prisma migrate dev --name <name>
pnpm exec prisma migrate reset
pnpm exec prisma studio

# Testing
pnpm test
pnpm test:watch
pnpm test:cov
pnpm test:e2e
```

## 📁 Architecture

```yaml
src/
├── prisma/                 # Database service & module
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── user/                   # User feature
│   ├── user.service.ts
│   ├── user.controller.ts
│   └── user.module.ts
├── product/                # Product feature
│   ├── product.service.ts
│   ├── product.controller.ts
│   └── product.module.ts
├── app.module.ts           # Root module
└── main.ts                 # Entry point

prisma/
├── schema.prisma           # Database schema definition
└── migrations/             # Schema version control

test/
├── app.e2e-spec.ts         # End-to-end tests
└── jest-e2e.json           # Test configuration
```

**Design Pattern:**

- Feature modules (User, Product) with Service → Controller structure
- Prisma service manages database lifecycle (OnModuleInit, OnModuleDestroy)
- Full TypeScript typing with Prisma types

## 🗄️ Database

### Setup

```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE social_shop_dev;"

# Initialize migrations
pnpm exec prisma migrate dev
```

### Migration Management

```bash
# Apply pending migrations
pnpm exec prisma migrate deploy

# Create new migration after schema changes
pnpm exec prisma migrate dev --name feature_name

# Reset database (development only)
pnpm exec prisma migrate reset

# Check migration status
pnpm exec prisma migrate status

# Browse database
pnpm exec prisma studio
```

## � API Endpoints

| Resource    | GET  | POST   | PUT           | DELETE        |
| ----------- | ---- | ------ | ------------- | ------------- |
| `/users`    | List | Create | Update (/:id) | Delete (/:id) |
| `/products` | List | Create | Update (/:id) | Delete (/:id) |

**Example:**

```bash
# Create user
curl -X POST http://localhost:5000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"user","password":"hashed_pwd"}'
```

See [API_ENDPOINTS.md](API_ENDPOINTS.md) for detailed specifications.

## 🧪 Testing

```bash
pnpm test               # Run unit tests
pnpm test:watch        # Watch mode
pnpm test:cov          # Coverage report
pnpm test:e2e          # End-to-end tests
```

## 🛠️ Development

### Code Quality

```bash
pnpm run lint              # Check code style
pnpm run lint --fix        # Auto-fix issues
pnpm run format            # Format with Prettier
```

### Add New Feature

```bash
# 1. Create module/controller/service
nest g module features/myfeature
nest g controller features/myfeature
nest g service features/myfeature

# 2. Update schema (if needed)
# Edit prisma/schema.prisma
pnpm exec prisma migrate dev --name feature_name

# 3. Test and verify
pnpm test
pnpm run lint
```

## 🐛 Troubleshooting

| Issue                         | Solution                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| **Database Connection Error** | Check `DATABASE_URL` in `.env`, ensure PostgreSQL is running: `psql -d social_shop_dev` |
| **Port Already in Use**       | Change `APP_PORT` in `.env` or: `sudo lsof -ti:5000 \| xargs kill -9`                   |
| **Prisma Client Not Found**   | Run `pnpm exec prisma generate && pnpm run build`                                       |
| **Dependencies Conflict**     | Clear cache: `pnpm store prune && rm -rf node_modules pnpm-lock.yaml && pnpm install`   |
| **TypeScript Errors**         | Clear build: `pnpm run build --clean`                                                   |

### Debug Mode

```bash
pnpm run start:debug    # Open Chrome: chrome://inspect
pnpm exec prisma validate
pnpm exec prisma studio
```

---

## 🔧 Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT + Passport
- **Language**: TypeScript
- **Testing**: Jest
- **Package Manager**: pnpm

## 📚 Resources

- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

## 📝 License

UNLICENSED
