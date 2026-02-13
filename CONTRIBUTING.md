# Contributing to BuildPlus AI

## Project Architecture

### Directory Structure

```
├── client/                # React Frontend (Vite)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   ├── ui/        # shadcn/ui primitives
│   │   │   ├── layout/    # Sidebar, navigation
│   │   │   └── help/      # Help system components
│   │   ├── pages/         # Page-level components
│   │   │   ├── admin/     # Admin settings pages
│   │   │   └── mobile/    # Mobile-specific pages
│   │   ├── lib/           # Utilities (auth, queryClient, theme, error-tracker)
│   │   └── hooks/         # Custom React hooks
│   └── index.html
├── server/                # Express.js Backend
│   ├── routes/            # API route handlers (grouped by feature)
│   │   └── middleware/    # Route-level middleware (auth, permissions)
│   ├── middleware/        # Global middleware (csrf, sanitize, health, timing)
│   ├── storage/           # Database access layer
│   ├── services/          # Business logic services (email, etc.)
│   ├── lib/               # Shared utilities (logger, cache, api-utils, etc.)
│   └── replit_integrations/ # Replit platform integrations
├── shared/                # Shared code between client and server
│   └── schema.ts          # Drizzle ORM schema + Zod validation schemas
├── tests/                 # Integration & E2E test suite
│   ├── e2e-helpers.ts     # Test utility functions
│   └── *.test.ts          # Test files
└── migrations/            # Database migration files
```

### Key Technology Decisions

| Technology | Purpose |
|------------|---------|
| React + Vite | Frontend build & dev |
| Wouter | Client-side routing |
| TanStack Query v5 | Server state management |
| shadcn/ui + Tailwind CSS | Component library + styling |
| Express.js | HTTP API server |
| PostgreSQL + Drizzle ORM | Database + type-safe queries |
| bcrypt + express-session | Authentication |
| Zod | Runtime validation (shared schemas) |
| Vitest | Testing framework |

## Development Conventions

### Backend (server/)

#### Route Organization
- Routes are grouped by feature in `server/routes/[feature].routes.ts`
- Each file exports a function `register[Feature]Routes(app: Express)` that mounts routes
- Routes use `/api/` prefix
- Auth middleware: `requireAuth` for any authenticated user, `requireRole("ADMIN")` for role checks

#### API Response Patterns
```typescript
// Success
res.json(data);           // 200 OK
res.status(201).json(data); // 201 Created

// Errors
res.status(400).json({ error: "Validation message" });
res.status(404).json({ error: "Resource not found" });
res.status(500).json({ error: "Internal server error" });
```

#### Validation
- Use Zod schemas from `@shared/schema.ts` for request body validation
- Shared utilities available in `server/lib/api-utils.ts`:
  - `parsePagination(req)` - Parse page/limit query params
  - `parseSort(req, allowedFields)` - Parse sortBy/sortOrder safely
  - `parseFilters(req, allowedKeys)` - Extract allowed query filters
  - `validateBody(schema, body)` - Validate with Zod
  - `handleApiError(res, err, context)` - Consistent error logging

#### Error Handling
- Always wrap route handlers in try/catch
- Use `logger` from `server/lib/logger` (pino-based)
- Never expose stack traces to client

### Frontend (client/)

#### Component Patterns
- Use shadcn/ui components from `@/components/ui/`
- Pages go in `client/src/pages/`, registered in `App.tsx`
- Use `lazy()` for code splitting on page components
- Use `data-testid` attributes on all interactive elements

#### Data Fetching
```typescript
// Query (GET)
const { data, isLoading } = useQuery({
  queryKey: ['/api/resource', id],
});

// Mutation (POST/PATCH/DELETE)
const mutation = useMutation({
  mutationFn: (data) => apiRequest('/api/resource', { method: 'POST', body: data }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/resource'] });
  },
});
```

#### Styling
- Tailwind utility classes
- Dark mode support via CSS variables in `index.css`
- Use semantic color tokens: `text-foreground`, `text-muted-foreground`, `bg-background`, etc.
- Use `hover-elevate` and `active-elevate-2` for interaction states

### Testing

#### Running Tests
```bash
npx vitest run                    # Run all tests
npx vitest run tests/specific.test.ts  # Run specific test file
npx vitest                        # Watch mode
```

#### Test Organization
- `tests/` directory for integration/E2E tests
- `server/__tests__/` for unit tests
- E2E tests use helpers from `tests/e2e-helpers.ts`
- Tests run against the live server on port 5000

#### Writing Tests
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { loginAdmin, adminGet, adminPost } from "./e2e-helpers";

describe("Feature Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("should do something", async () => {
    const res = await adminGet("/api/endpoint");
    expect(res.status).toBe(200);
  });
});
```

### Database

#### Schema Changes
1. Add/modify tables in `shared/schema.ts`
2. Create migration in `migrations/` directory
3. Add insert schemas and types
4. Update storage interface if needed

#### Naming Conventions
- Tables: camelCase (e.g., `panelRegister`, `documentBundles`)
- Columns: camelCase
- Foreign keys: `[entity]Id` (e.g., `jobId`, `customerId`)

### Middleware Stack

| Middleware | File | Purpose |
|-----------|------|---------|
| Helmet | server/index.ts | Security headers (CSP, XSS, etc.) |
| Rate Limiting | server/index.ts | Request throttling |
| Compression | server/index.ts | Response compression |
| Sanitize | server/middleware/sanitize.ts | XSS prevention |
| Request Timing | server/middleware/request-timing.ts | Performance monitoring |
| Health Checks | server/middleware/health.ts | /health, /health/db, /health/metrics |
| CSRF | server/middleware/csrf.ts | Cross-site request forgery protection |
| Auth | server/routes/middleware/auth.middleware.ts | Session-based authentication |
| RBAC | server/routes/middleware/permissions.middleware.ts | Role-based access control |

### Health & Monitoring

- `GET /health` - Overall system health (DB, memory, event loop)
- `GET /health/db` - Database connection pool stats
- `GET /health/metrics` - Request performance metrics (auth required)

## Code Quality Checklist

- [ ] Route handlers have try/catch with proper error responses
- [ ] Request bodies validated with Zod schemas
- [ ] Interactive elements have `data-testid` attributes
- [ ] New features have corresponding tests
- [ ] No secrets or API keys in code
- [ ] Dark mode compatible styling
- [ ] Accessible (aria-labels, keyboard navigation)
