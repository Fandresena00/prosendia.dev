# Frontend - Social Shop Assistant

A modern Next.js React application providing an intuitive user interface for the Social Shop Assistant platform. Built with TypeScript, Tailwind CSS, and shadcn/ui components.

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#%EF%B8%8F-configuration)
- [Running the Application](#-running-the-application)
- [Project Structure](#-project-structure)
- [Components](#-components)
- [Styling](#-styling)
- [Pages & Routing](#%EF%B8%8F-pages--routing)
- [State Management](#-state-management)
- [Building for Production](#️-building-for-production)
- [Development](#%EF%B8%8F-development)
- [Troubleshooting](#-troubleshooting)

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Backend API** running on `https://vendeoia-api.fadevt.org` (configurable)

### Installation

1. **Navigate to frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   ```bash
   # Create .env.local file
   echo "NEXT_PUBLIC_API_URL=https://vendeoia-api.fadevt.org" > .env.local
   ```

4. **Start development server:**

   ```bash
   pnpm run dev
   ```

The application will be available at `http://localhost:3000`

## 🔧 Installation

### Step-by-Step Setup

#### 1. Prerequisites

- Node.js 18+ and pnpm installed
- Backend API accessible
- Modern web browser

#### 2. Clone & Install

```bash
cd frontend
pnpm install
```

#### 3. Verify Installation

```bash
pnpm run build
```

## ⚙️ Configuration

### Environment Variables

Create `.env.local` in the frontend root directory:

```env
# ============================================
# API CONFIGURATION
# ============================================
# Backend API URL (public - accessible from browser)
NEXT_PUBLIC_API_URL="https://vendeoia-api.fadevt.org"

# ============================================
# OTHER SETTINGS (Optional)
# ============================================
# Next.js environment
NODE_ENV="development"
```

### Environment-Specific Setup

#### Development

```env
NEXT_PUBLIC_API_URL="https://vendeoia-api.fadevt.org"
NODE_ENV="development"
```

#### Production

```env
NEXT_PUBLIC_API_URL="https://api.yourdomain.com"
NODE_ENV="production"
```

#### Staging

```env
NEXT_PUBLIC_API_URL="https://api-staging.yourdomain.com"
NODE_ENV="production"
```

### Accessing Environment Variables in Code

```typescript
// Public runtime configs (accessible in browser and server)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// Server-only configs (use in getServerSideProps, API routes only)
// const secret = process.env.SECRET_KEY;
```

## 🏃 Running the Application

### Development Server

```bash
pnpm run dev
```

- Auto-reload on file changes
- Hot Module Replacement (HMR)
- Available at `http://localhost:3000`
- Source maps for debugging

### Production Build

```bash
pnpm run build
pnpm run start
```

### Linting & Code Quality

```bash
pnpm run lint      # Check code with ESLint
```

## 📁 Project Structure

```yaml
frontend/
├── app/                           # Next.js App Router
│   ├── layout.tsx                 # Root layout with theme provider
│   ├── page.tsx                   # Home/landing page
│   ├── globals.css                # Global styles
│   ├── (auth)/                    # Authentication routes (public)
│   │   ├── layout.tsx             # Auth page layout
│   │   ├── sign-in/
│   │   │   └── page.tsx           # Login page
│   │   ├── sign-up/
│   │   │   └── page.tsx           # Registration page
│   │   ├── forgot-password/
│   │   │   └── page.tsx           # Password recovery
│   │   └── reset-password/
│   │       └── page.tsx           # Password reset
│   └── (workspace)/               # Protected workspace routes
│       ├── layout.tsx             # Workspace main layout
│       ├── dashboard/
│       │   └── page.tsx           # Main dashboard
│       ├── posts-comments/
│       │   └── page.tsx           # Posts & comments management
│       ├── automation/
│       │   └── page.tsx           # Automation workflows
│       ├── analytics/
│       │   └── page.tsx           # Analytics dashboard
│       ├── inbox/
│       │   └── page.tsx           # Message inbox
│       ├── accounts/
│       │   └── page.tsx           # Social accounts management
│       ├── products/
│       │   └── page.tsx           # E-commerce products
│       ├── ai-settings/
│       │   └── page.tsx           # AI configuration
│       └── settings/
│           └── page.tsx           # Account settings
├── components/                    # Reusable React components
│   ├── theme-switcher.tsx         # Dark/Light mode toggle
│   └── ui/                        # shadcn/ui components
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── chart.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── sidebar.tsx
│       ├── skeleton.tsx
│       ├── slider.tsx
│       ├── switch.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx
├── hooks/                         # Custom React hooks
│   └── use-mobile.ts              # Hook for mobile detection
├── lib/                           # Utility functions
│   └── utils.ts                   # Common utilities and helpers
├── public/                        # Static assets
│   └── ...                        # Images, icons, etc.
├── .env.local                     # Environment variables (local)
├── .env.example                   # Example environment template
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── next.config.ts                 # Next.js configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── postcss.config.mjs             # PostCSS configuration
├── eslint.config.mjs              # ESLint configuration
└── README.md                      # This file
```

### Directory Descriptions

- **`app/`**: Next.js App Router pages and layouts
  - Directory structure = URL routes
  - `layout.tsx` = layout for directory and children
  - `page.tsx` = actual page component
- **`components/`**: Reusable UI components
  - Organized by feature
  - shadcn/ui = low-level UI building blocks
  - Custom components = business logic components
- **`hooks/`**: Custom React hooks for shared logic

- **`lib/`**: Utility functions and helpers

- **`public/`**: Static files served directly

## 🧩 Components

### Component Organization

#### UI Components (shadcn/ui)

Pre-built, customizable components from shadcn/ui library:

- `Button` - Clickable button component
- `Card` - Container for content grouping
- `Input` - Text input field
- `Select` - Dropdown selection
- `Avatar` - User profile pictures
- `Badge` - Status labels
- `Sidebar` - Navigation sidebar
- `Chart` - Recharts integration

#### Custom Components

- `ThemeSwitcher` - Dark/Light mode toggle

### Using Components

```typescript
// Import from components/ui
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function MyComponent() {
  return (
    <Card>
      <Button>Click me</Button>
    </Card>
  );
}
```

## 🎨 Styling

### Tailwind CSS

The project uses Tailwind CSS v4 for utility-first styling:

```typescript
// Using Tailwind classes
<div className="flex items-center justify-between px-4 py-2 bg-slate-100 rounded-lg">
  <h1 className="text-xl font-bold text-slate-900">Title</h1>
  <p className="text-sm text-slate-600">Subtitle</p>
</div>
```

### Tailwind Configuration

View `tailwind.config.ts` for customization:

- Color schemes
- Typography scales
- Spacing values
- Theme variants

### Theme System

**Dark/Light Mode:**

- Integrated with `next-themes`
- `ThemeSwitcher` component for user toggle
- Persisted in localStorage
- Use `dark:` prefix for dark mode styles

```typescript
// Dark mode styling
<div className="bg-white dark:bg-slate-900">
  <p className="text-black dark:text-white">Content</p>
</div>
```

## 🛣️ Pages & Routing

### Route Groups

The app uses **route groups** (parentheses in folder names) to organize pages without affecting URLs:

#### Authentication Routes (Public)

```yaml
(auth)/
├── sign-in/page.tsx      → /sign-in
├── sign-up/page.tsx      → /sign-up
├── forgot-password/       → /forgot-password
└── reset-password/        → /reset-password
```

#### Workspace Routes (Protected)

```yaml
(workspace)/
├── dashboard/            → /dashboard
├── posts-comments/       → /posts-comments
├── automation/           → /automation
├── analytics/            → /analytics
├── inbox/                → /inbox
├── accounts/             → /accounts
├── products/             → /products
├── ai-settings/          → /ai-settings
└── settings/             → /settings
```

### Navigation

```typescript
// Client-side navigation
import { useRouter } from "next/navigation";

export function MyComponent() {
  const router = useRouter();

  return (
    <button onClick={() => router.push("/dashboard")}>
      Go to Dashboard
    </button>
  );
}
```

### Protected Routes

Not yet implemented. Plan to add:

- Authentication middleware
- Redirects for unauthenticated users
- Role-based access control

## 💾 State Management

### Current Approach

- React hooks (useState, useContext)
- Local component state
- TBD: Global state management (Redux, Zustand, Jotai)

### Recommendations for Future

Consider implementing:

- **Zustand** - Lightweight state management
- **Redux Toolkit** - Complex state logic
- **Jotai** - Primitive atom-based state
- **SWR** / **TanStack Query** - Server state management

## 🏗️ Building for Production

### Development Build

```bash
# Test production build locally
pnpm run build
pnpm run start

# Visit http://localhost:3000
```

### Production Build Checklist

- [ ] Set `NEXT_PUBLIC_API_URL` to production API
- [ ] Run linter: `pnpm run lint`
- [ ] Test build: `pnpm run build`
- [ ] Clear cache: `.next/` folder
- [ ] Verify environment variables
- [ ] Test in production mode: `pnpm run start`

### Build Output

```bash
pnpm run build
```

Creates `.next/` directory with:

- Optimized JavaScript bundles
- Static HTML pages
- Server-side rendering data
- Asset optimization

## 🛠️ Development

### Development Workflow

1. **Start dev server:**

   ```bash
   pnpm run dev
   ```

2. **Edit files** - Auto-reload enabled

3. **Run linter** (optional):

   ```bash
   pnpm run lint
   ```

4. **Commit changes** with clear messages

5. **Build for testing:**

   ```bash
   pnpm run build
   ```

### Hot Module Replacement (HMR)

Next.js automatically hot-reloads when you:

- Edit component files
- Update styles
- Modify utilities

No manual refresh needed!

### TypeScript

Project uses TypeScript for type safety:

```typescript
// Type-safe component
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function MyButton({ label, onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### Browser DevTools

- **React DevTools** extension recommended
- Inspect component props and state
- Trace renders for performance

### Debugging

```typescript
// Console logging
console.log("Debug:", variable);

// Debugger statement
debugger;

// Browser console
// Open DevTools: F12
```

## 📦 Dependencies

### Core Dependencies

| Package      | Purpose         | Version |
| ------------ | --------------- | ------- |
| `next`       | React framework | 16.2.2  |
| `react`      | UI library      | 19.2.4  |
| `react-dom`  | DOM rendering   | 19.2.4  |
| `typescript` | Type safety     | ^5      |

### UI & Styling

| Package        | Purpose              | Version |
| -------------- | -------------------- | ------- |
| `tailwindcss`  | Utility CSS          | ^4      |
| `radix-ui`     | Component primitives | ^1.4.3  |
| `lucide-react` | Icons                | ^1.7.0  |
| `recharts`     | Charts/Graphs        | 3.8.0   |

### Utilities

| Package          | Purpose                | Version |
| ---------------- | ---------------------- | ------- |
| `next-themes`    | Theme management       | ^0.4.6  |
| `clsx`           | Class name utility     | ^2.1.1  |
| `tailwind-merge` | Merge Tailwind classes | ^3.5.0  |

### Dev Dependencies

| Package        | Purpose                |
| -------------- | ---------------------- |
| `eslint`       | Code linting           |
| `@types/node`  | Node type definitions  |
| `@types/react` | React type definitions |

## 🌐 API Integration

### API Base URL

Set via environment variable:

```env
NEXT_PUBLIC_API_URL="https://vendeoia-api.fadevt.org"
```

### Fetching Data

Example API call:

```typescript
// Fetch from Next.js component
async function fetchPosts() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`);
  const data = await response.json();
  return data;
}
```

### Future API Integration

Plan to implement:

- API client library (Axios, Fetch API wrapper)
- Request interceptors for auth tokens
- Error handling
- Retry logic

## 🐛 Troubleshooting

### Common Issues

#### Issue: Port Already in Use

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**

```bash
# Kill process on port 3000
sudo lsof -ti:3000 | xargs kill -9

# Or use different port
pnpm run dev -- -p 3001
```

#### Issue: API Connection Error

```bash
Error: Failed to fetch from http://localhost:3000
```

**Solution:**

1. Verify backend is running
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Ensure API is accessible at configured URL
4. Check browser console for CORS errors

#### Issue: Dependencies Not Installing

```bash
Error: ERESOLVE unable to resolve dependency tree
```

**Solution:**

```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Issue: Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
pnpm run build
```

#### Issue: TypeError: Cannot read property 'length' of undefined

**Solution:**

- Add TypeScript types to components
- Check prop defaults
- Add null/undefined checks

#### Issue: CSS Not Applying

**Solution:**

1. Verify Tailwind CSS is configured
2. Check class names are correct
3. Ensure `globals.css` is imported
4. Clear `.next/` and rebuild

### Debug Commands

```bash
# Check Next.js version
next --version

# Type check
tsc --noEmit

# Validate linting
pnpm run lint

# Analyze build size
pnpm run build --analyze
```

### Performance Optimization

1. **Image Optimization:**

   ```typescript
   import Image from "next/image";

   <Image
     src="/image.jpg"
     alt="Description"
     width={800}
     height={600}
   />
   ```

2. **Code Splitting:** Automatic with Next.js

3. **Lazy Loading:**

   ```typescript
   import dynamic from "next/dynamic";

   const HeavyComponent = dynamic(() => import('./heavy'), {
     loading: () => <p>Loading...</p>,
   });
   ```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Recharts Documentation](https://recharts.org)

## 📝 Development Guidelines

### Code Style

- Use TypeScript for all files
- Follow ESLint rules
- Use descriptive variable names
- Add comments for complex logic
- Keep components small and focused

### File Naming

- Components: PascalCase (`MyComponent.tsx`)
- Utilities: camelCase (`myUtils.ts`)
- Pages: lowercase with hyphens (`my-page.tsx`)
- Folders: lowercase with hyphens (`my-folder`)

### Component Structure

```typescript
'use client';  // Client component marker if needed

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
  onSubmit?: (data: string) => void;
}

export function MyComponent({ title, onSubmit }: MyComponentProps) {
  const [state, setState] = useState('');

  const handleClick = () => {
    // Logic here
  };

  return (
    <div>
      <h1>{title}</h1>
      <Button onClick={handleClick}>Click</Button>
    </div>
  );
}
```

---

**Last Updated**: April 2026  
**Framework Version**: Next.js 16.2.2  
**React Version**: 19.2.4  
**Styling**: Tailwind CSS v4
