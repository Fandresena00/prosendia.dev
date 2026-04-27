# Social Shop Assistant

A comprehensive platform for managing social media presence and e-commerce integration. Built with modern web technologies to streamline content creation, scheduling, and shop management across multiple social channels.

## 🎯 Project Overview

Social Shop Assistant is a full-stack application that helps businesses:

- Manage and publish posts to social media platforms
- Track analytics and engagement metrics
- Manage product inventory and listings
- Automate recurring tasks and workflows
- Centralize account management

## 🏗️ Architecture

This is a **monorepo** project with the following structure:

```bash
social-shop-assistant/
├── backend/        # NestJS API server with PostgreSQL
├── frontend/       # Next.js React application with Tailwind CSS
├── automation/     # Automation workflows and scripts (in development)
└── README.md       # This file
```

### Technology Stack

| Component           | Technology     | Version |
| ------------------- | -------------- | ------- |
| **Backend**         | NestJS         | ^11.0.1 |
| **Frontend**        | Next.js        | 16.2.2  |
| **Database**        | PostgreSQL     | -       |
| **ORM**             | Prisma         | ^7.6.0  |
| **Authentication**  | JWT + Passport | -       |
| **UI Framework**    | shadcn/ui      | -       |
| **Styling**         | Tailwind CSS   | ^4      |
| **Package Manager** | pnpm           | -       |

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 ([Install pnpm](https://pnpm.io/installation))
- **PostgreSQL** >= 12 ([Install PostgreSQL](https://www.postgresql.org/download/))

### Installation & Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd social-shop-assistant
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Backend Setup** (See [backend/README.md](./backend/README.md) for detailed instructions)

   ```bash
   cd backend

   # Configure environment
   cp .env.example .env
   # Edit .env with your database credentials

   # Run migrations
   pnpm exec prisma migrate dev --name init

   # Start development server
   pnpm run start:dev
   ```

4. **Frontend Setup** (See [frontend/README.md](./frontend/README.md) for detailed instructions)

   ```bash
   cd frontend

   # Install dependencies
   pnpm install

   # Start development server
   pnpm run dev
   ```

### Access the Application

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)
- **API Health Check**: [http://localhost:5000/health](http://localhost:5000/health)

## 📁 Project Structure

### Backend (`backend/`)

NestJS API server with RESTful endpoints for:

- User authentication and authorization
- Post management (CRUD operations)
- Account management
- Analytics and metrics

**Key Files:**

- `src/main.ts` - Application entry point
- `src/app.module.ts` - Root module configuration
- `prisma/schema.prisma` - Database schema
- `src/generated/prisma/` - Auto-generated Prisma client files

### Frontend (`frontend/`)

Next.js React application with pages for:

- Authentication (Sign in, Sign up, Password reset)
- Workspace navigation
- Dashboard
- Posts management
- Comments management
- Automation workflows
- Settings and analytics

**Key Files:**

- `app/layout.tsx` - Root layout
- `app/(auth)/` - Authentication pages
- `app/(workspace)/` - Protected workspace pages
- `components/` - Reusable components
- `lib/utils.ts` - Utility functions

### Automation (`automation/`)

Planned automation workflows and integration points (currently in development).

**See**: [automation/README.md](./automation/README.md)

## 🛠️ Development

### Available Scripts

**Backend:**

```bash
pnpm run start        # Production mode
pnpm run start:dev    # Development with watch mode
pnpm run start:debug  # Debug mode
pnpm run build        # Build for production
pnpm run test         # Run unit tests
pnpm run test:e2e     # Run end-to-end tests
pnpm run lint         # Run ESLint
pnpm run format       # Format code with Prettier
```

**Frontend:**

```bash
pnpm run dev      # Development server
pnpm run build    # Build for production
pnpm run start    # Production server
pnpm run lint     # Run ESLint
```

### Database Migrations

**Create a new migration:**

```bash
cd backend
pnpm exec prisma migrate dev --name <migration_name>
```

**Reset database (development only):**

```bash
cd backend
pnpm exec prisma migrate reset
```

**Open Prisma Studio** (Database browser):

```bash
cd backend
pnpm exec prisma studio
```

## 📊 Database Schema

The application uses the following main models:

### User Model

```prisma
- id: String (Primary Key)
- email: String (Unique)
- username: String (Unique)
- password: String (Hashed)
- firstName: String (Optional)
- lastName: String (Optional)
- isActive: Boolean
- posts: Post[] (Relation)
- createdAt: DateTime
- updatedAt: DateTime
```

### Post Model

```prisma
- id: String (Primary Key)
- title: String
- content: String (Optional)
- published: Boolean
- author: User (Relation)
- authorId: String (Foreign Key)
- createdAt: DateTime
- updatedAt: DateTime
```

## 🔐 Authentication

The project uses JWT (JSON Web Tokens) with Passport for authentication:

- **JWT Secret**: Set via `JWT_SECRET` environment variable
- **Token Expiration**: Configurable via `JWT_EXPIRATION`
- **Strategies**: Local (credentials) and JWT (token validation)

**Authentication Flow:**

1. User submits credentials (email/password)
2. Backend validates and returns JWT token
3. Frontend stores token in secure storage
4. Subsequent requests include token in Authorization header
5. Backend validates token and grants access

## 📋 Environment Variables

### Backend (`.env`)

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/social_shop_dev"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-min-32-chars!"
JWT_EXPIRATION="24h"

# Application
NODE_ENV="development"
APP_PORT=5000
```

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
```

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage report
pnpm run test:cov
```

### Frontend Testing

Frontend testing setup is available. Check the frontend README for details.

## 📦 Building for Production

### Backend

```bash
cd backend
pnpm run build
pnpm run start:prod
```

### Frontend

```bash
cd frontend
pnpm run build
pnpm run start
```

## 🚢 Deployment

### Prerequisites for Deployment

- Production PostgreSQL database
- Environment variables properly configured
- SSL/TLS certificates for HTTPS
- Domain names configured

### Backend Deployment

1. **Build the application:**

   ```bash
   pnpm run build
   ```

2. **Set production environment variables:**
   - `DATABASE_URL` (production database)
   - `JWT_SECRET` (strong, random secret)
   - `NODE_ENV=production`
   - `APP_PORT` (if different)

3. **Run the application:**

   ```bash
   pnpm run start:prod
   ```

### Frontend Production Build

1. **Build the application:**

   ```bash
   pnpm run build
   ```

2. **Set production environment variables:**
   - `NEXT_PUBLIC_API_URL` (production API URL)

3. **Start the server:**

   ```bash
   pnpm run start
   ```

### Recommended Hosting Platforms

- **Backend**: Heroku, Railway, Render, DigitalOcean, AWS
- **Frontend**: Vercel (recommended), Netlify, AWS, DigitalOcean
- **Database**: AWS RDS, DigitalOcean, Heroku Postgres, Railway

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Verify DATABASE_URL is correct
# Check PostgreSQL is running
# Reset database if needed
cd backend
pnpm exec prisma db push
```

### Port Already in Use

```bash
# Change ports in environment variables or:
# Kill process using the port (Linux/Mac)
sudo lsof -ti:3000 | xargs kill -9

# Kill process on Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Dependency Issues

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 📚 Additional Documentation

- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
- [Automation Documentation](./automation/README.md)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 👥 Team & Contributions

This project is actively maintained. For contributions, please:

1. Create a feature branch
2. Make your changes
3. Ensure tests pass
4. Submit a pull request

## 📄 License

This project is licensed under UNLICENSED.

## 📞 Support

For issues, questions, or suggestions:

- Open an issue on the repository
- Check existing documentation
- Review the troubleshooting section

---

**Last Updated**: April 2026  
**Maintained by**: Development Team
