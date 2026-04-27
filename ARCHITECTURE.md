# Architecture Documentation

Overview of the Social Shop Assistant architecture, including system components, data flow, and design patterns.

## 🏗️ System Architecture

### High-Level Overview

```yaml
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
│  http://localhost:3000                                      │
│  - React Components                                         │
│  - Tailwind CSS / shadcn/ui                                │
│  - Next.js Pages & Routing                                 │
└────────────────────┬────────────────────────────────────────┘
│
│ HTTP/REST API
│ JSON Requests/Responses
│
┌────────────────────▼────────────────────────────────────────┐
│                  Backend (NestJS)                           │
│  http://localhost:5000/api                                 │
│  - Controllers (Handle Requests)                           │
│  - Services (Business Logic)                               │
│  - Modules (Feature Organization)                          │
│  - Authentication (JWT)                                    │
└────────────────────┬────────────────────────────────────────┘
│
│ Prisma ORM
│ Queries & Transactions
│
┌────────────────────▼────────────────────────────────────────┐
│              Database (PostgreSQL)                          │
│  social_shop_dev                                            │
│  - Users Table                                              │
│  - Posts Table                                              │
│  - Indexes & Relationships                                 │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Architecture

### User Authentication Flow

```yaml
User Input
│
▼
┌─────────────────────────┐
│  Frontend (Sign In)     │
│  - Input email/password │
│  - Validate locally     │
└────────────┬────────────┘
│
▼
┌────────────────────────┐
│  Backend Auth Service  │
│  - Verify credentials  │
│  - Hash check (bcrypt) │
│  - Generate JWT token  │
└────────┬───────────────┘
│
▼
┌────────────────────────┐
│  Frontend Storage      │
│  - Store JWT token     │
│  - Store user info     │
└────────┬───────────────┘
│
▼
┌────────────────────────┐
│  Protected Requests    │
│  - Include JWT token   │
│  - Get authorized data │
└────────────────────────┘
```

### Post Creation Flow

```yaml
User Creates Post
│
▼
┌─────────────────────────┐
│  Frontend Form          │
│  - Input post data      │
│  - Client-side validate │
└────────────┬────────────┘
│
▼
┌────────────────────────┐
│  API Request           │
│  POST /posts           │
│  + Authorization header│
└────────┬───────────────┘
│
▼
┌────────────────────────┐
│  Backend Controller    │
│  - Verify JWT          │
│  - Validate input (DTO)│
└────────┬───────────────┘
│
▼
┌────────────────────────┐
│  Service Layer         │
│  - Business logic      │
│  - Data transformation │
└────────┬───────────────┘
│
▼
┌────────────────────────┐
│  Prisma ORM            │
│  - Save to DB          │
│  - Return created post │
└────────┬───────────────┘
│
▼
┌────────────────────────┐
│  Frontend Update       │
│  - Update UI           │
│  - Show success        │
└────────────────────────┘
```

## 🔐 Authentication Architecture

### JWT Token Structure

```text
Header.Payload.Signature

Example:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### Token Payload

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "username": "username",
  "iat": 1704067200,
  "exp": 1704153600
}
```

### Authentication Flow in NestJS

```text
Request with Token
    │
    ▼
┌──────────────────────┐
│ JWT Guard            │
│ - Extract token      │
│ - Verify signature   │
│ - Check expiration   │
└────────┬─────────────┘
         │ Valid?
         ├─ YES ─────────▶ Use request
         │
         └─ NO ──────────▶ Return 401 Unauthorized
```

### bcrypt Password Hashing

```text
Plain Password
    │
    ▼
bcrypt.hash()
    │ Rounds: 10
    │ Cost: computationally expensive
    ▼
Hashed Password (stored in DB)

Authentication:
    │
    ▼
bcrypt.compare(plainPassword, hashedPassword)
    │
    ▼
Match? ─ YES ────▶ User authenticated
        │
        └─ NO ───▶ Authentication failed
```

## 📡 API Architecture

### REST API Endpoints

#### Current Endpoints

| Method | Endpoint  | Purpose      | Auth |
| ------ | --------- | ------------ | ---- |
| `GET`  | `/health` | Health check | ✗    |

#### Planned Endpoints

| Method   | Endpoint         | Purpose           | Auth |
| -------- | ---------------- | ----------------- | ---- |
| `POST`   | `/auth/register` | Register new user | ✗    |
| `POST`   | `/auth/login`    | User login        | ✗    |
| `POST`   | `/auth/logout`   | User logout       | ✓    |
| `GET`    | `/users/:id`     | Get user profile  | ✓    |
| `PUT`    | `/users/:id`     | Update user       | ✓    |
| `GET`    | `/posts`         | List posts        | ✓    |
| `POST`   | `/posts`         | Create post       | ✓    |
| `GET`    | `/posts/:id`     | Get post          | ✓    |
| `PUT`    | `/posts/:id`     | Update post       | ✓    |
| `DELETE` | `/posts/:id`     | Delete post       | ✓    |

### Request/Response Structure

#### Successful Response

```json
{
  "data": {
    "id": "userId",
    "email": "user@example.com",
    "username": "john_doe",
    "createdAt": "2026-04-06T12:00:00Z"
  },
  "statusCode": 200,
  "message": "Success"
}
```

#### Error Response

```json
{
  "statusCode": 400,
  "message": "Invalid input",
  "error": "Bad Request"
}
```

#### Authentication Error

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid credentials"
}
```

## 🧩 Module Architecture

### Backend Module Organization

```text
AppModule (Root)
├── PrismaModule
│   └── PrismaService (DB Connection)
├── AuthModule (Future)
│   ├── AuthController
│   ├── AuthService
│   └── JwtStrategy
├── UserModule (Future)
│   ├── UserController
│   ├── UserService
│   └── UserRepository
└── PostModule (Future)
    ├── PostController
    ├── PostService
    └── PostRepository
```

### Service Layer Pattern

```text
Controller
    │
    ▼ Receives HTTP Request
┌──────────────────────┐
│ Validates Input      │
│ (DTOs)               │
└────────┬─────────────┘
         │
         ▼
    ┌──────────────────────┐
    │ Service Layer        │
    │ - Business Logic     │
    │ - Data Transform     │
    │ - Validation         │
    └────────┬─────────────┘
             │
             ▼
        ┌──────────────────────┐
        │ Prisma ORM           │
        │ - Query Database     │
        │ - Return Results     │
        └────────┬─────────────┘
                 │
                 ▼
            Response to Client
```

## 🔄 Request Lifecycle

```text
1. HTTP Request arrives at controller
   └─ @Controller('/posts')
   └─ @Get(':id')

2. Guards and pipes process request
   └─ JWT Guard validates token
   └─ Validation Pipe checks data

3. Controller method executes
   └─ Calls service methods
   └─ Handles errors

4. Service performs business logic
   └─ Calls Prisma ORM
   └─ Transforms data

5. Database query executes
   └─ Prisma generates SQL
   └─ Returns data

6. Response created
   └─ Serialize data
   └─ Set status code

7. Response sent to client
   └─ JSON data
   └─ Status code & headers
```

## 🎯 Design Patterns

### MVC Architecture (Modified)

```text
Model ◄─────► View
  ▲            │
  │            │
  └─ Controller ┘

Backend: Model (Database) & Controllers (HTTP handlers)
Frontend: View (React Components) & Router (URL handling)
```

### Dependency Injection

```typescript
// NestJS provides automatic DI
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  // appService is automatically injected
}
```

### Repository Pattern (Future)

```text
Controller
    │
    ▼
Service
    │
    ▼
Repository (Prisma wrapper)
    │
    ▼
Database
```

## 📊 Scalability Considerations

### Current Limitations

- Single database instance
- No caching layer
- No message queue
- No CDN for static files
- No load balancing

### Future Improvements

1. **Caching**: Redis for session & query caching
2. **Database**: Read replicas for high traffic
3. **Message Queue**: Bull/RabbitMQ for async tasks
4. **CDN**: CloudFlare/AWS CloudFront for static assets
5. **Load Balancing**: Multiple app instances behind NGINX

### Database Scaling Path

```yaml
Single DB
│
▼ Growth
Primary DB + Read Replicas
│
▼ More Growth
Database Sharding
(Partition data by User ID)
│
▼ Enterprise Scale
Distributed Database
(Multi-region, high availability)
```

## 🔒 Security Architecture

### Security Layers

```text
1. Transport Layer (HTTPS)
   └─ SSL/TLS encryption

2. Authentication Layer
   └─ JWT tokens
   └─ Password hashing (bcrypt)

3. Authorization Layer
   └─ JWT validation
   └─ Role-based access

4. Data Layer
   └─ Parameterized queries (SQL injection prevention)
   └─ Input validation

5. Infrastructure Layer
   └─ Environment variables for secrets
   └─ CORS policies
```

### Secret Management

```text
Environment Variables (.env)
    │
    ├─ JWT_SECRET        (never commit)
    ├─ DATABASE_URL      (never commit)
    └─ API_KEYS          (never commit)

Version Control (.gitignore)
    │
    └─ Exclude .env files
```

## 📈 Performance Architecture

### Frontend Optimization

- Next.js automatic code splitting
- Image optimization
- CSS-in-JS with Tailwind
- Component lazy loading

### Backend Optimization

- HTTP caching headers
- Database query optimization
- Connection pooling
- Response compression

### Database Optimization

- Indexed frequent queries
- Proper data types
- Cascade delete relationships
- Query result pagination (future)

## 🧪 Testing Architecture

### Testing Pyramid

```text
        E2E Tests
       /          \
      /  Unit      \
     /  Tests       \
    /________________\
    Integration Tests

- Unit Tests: Individual functions/methods
- Integration Tests: Multiple components together
- E2E Tests: Complete user flows
```

### Testing Stack

```yaml
Backend:
├─ Jest (Test framework)
├─ Supertest (HTTP testing)
├─ @nestjs/testing (NestJS utilities)
└─ Test DB (separate from dev DB)

Frontend:
├─ Jest (optional)
├─ React Testing Library (optional)
└─ Playwright (E2E optional)
```

## 📚 Documentation Architecture

```yaml
PROJECT_ROOT/
├─ README.md            (Project overview)
├─ SETUP.md            (Setup instructions)
├─ ARCHITECTURE.md     (This file)
├─ backend/
│  └─ README.md        (Backend specific)
├─ frontend/
│  └─ README.md        (Frontend specific)
└─ README.md        (Automation specific)
```

---

**Last Updated**: April 2026  
**Architecture Version**: 1.0  
**Status**: Stable (Development)
