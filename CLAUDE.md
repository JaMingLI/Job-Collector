# CLAUDE.md — Job Collector

## Project Overview

Chrome extension that intercepts job listings from 104.com.tw → Fastify server stores them in SQLite → React dashboard displays and analyzes results.

**Architecture:** `extension → server (localhost:3104) → SQLite ← web dashboard`

Monorepo with 3 independent modules (`web/`, `server/`, `extension/`). No shared code between them.
Package manager: **pnpm**. UI language: **zh-TW**.

---

## Development Commands

| Module       | Start                                  | Test          | Build              |
| ------------ | -------------------------------------- | ------------- | ------------------ |
| `web/`       | `pnpm dev`                             | `pnpm test`   | `pnpm build`       |
| `server/`    | `pnpm dev` (uses `--watch`)            | —             | N/A (plain JS)     |
| `extension/` | Load unpacked in `chrome://extensions` | —             | N/A (no build)     |

- Server listens on `0.0.0.0:3104`
- Web dev server proxies `/api` → `localhost:3104`

---

## Commit Convention

Angular format: `<type>(<scope>): <subject>`

| type       | meaning                  |
| ---------- | ------------------------ |
| `feat`     | New feature              |
| `fix`      | Bug fix                  |
| `docs`     | Documentation            |
| `style`    | Code style (no logic)    |
| `refactor` | Refactor (no feat/fix)   |
| `perf`     | Performance              |
| `test`     | Tests                    |
| `build`    | Build system             |
| `ci`       | CI config                |
| `infras`   | Infrastructure           |
| `chore`    | Other                    |
| `revert`   | Revert previous commit   |

Scopes: `web`, `server`, `extension`, `docs`
Subject: English, lowercase, imperative mood, no trailing period.

---

## Frontend — `web/`

> **Read `AGENTS.md` before any `web/` work.** It is the authoritative reference for frontend architecture (Clean Architecture + MVVM Binder Pattern).

### 5 Critical Rules (quick checklist)

1. **No direct 3rd-party imports** — `axios`, `zod`, `@tanstack/*`, `zustand` etc. must be wrapped/re-exported in `@/lib`. Only `react`, `react-dom`, `react-router-dom` are exempt.
2. **Domain gatekeeper** — UI code (`src/pages`, `src/components`) imports business logic ONLY from `@/domain` barrel. No deep imports like `@/domain/services/user`.
3. **Pure ViewControllers** — `.view-controller.tsx` files contain ZERO hooks, ZERO business logic. They receive props and render JSX.
4. **Server state → React Query; client state → Zustand** — never store API response data in Zustand.
5. **`import type` for type-only imports** — enforced by TS strict mode.

### Tech Stack

React 19, TypeScript 5 (strict), Vite 6, SCSS modules, i18next (zh-TW primary).
Testing: Vitest + React Testing Library, test files adjacent to source.

---

## Backend — `server/`

### Tech & Constraints

- **Pure JS (ES Modules)**, no TypeScript, no build step
- Fastify 5 + @fastify/cors + better-sqlite3 (WAL mode)
- Routes access DB directly — no repository/service layer abstraction

### Directory Structure

```
server/src/
  index.js          — Fastify setup, CORS, plugin registration
  db.js             — SQLite init, DDL, pragma, prepared statements (exports { db, stmts })
  routes/
    health.js       — GET /health
    jobs.js         — POST /api/jobs, GET /api/jobs, GET /api/jobs/stats
  utils/
    salary.js       — Salary parsing helpers
server/data/
  jobs.db           — SQLite file (gitignored, auto-created)
```

### How to Add a New Route

1. Create `src/routes/<name>.js`
2. Export default async function (Fastify plugin):
   ```js
   export default async function (fastify) {
     fastify.get('/api/<name>', async (request, reply) => { ... });
   }
   ```
3. Register in `src/index.js`:
   ```js
   import nameRoutes from './routes/<name>.js';
   await fastify.register(nameRoutes);
   ```
4. Import `{ db, stmts }` from `'../db.js'` for database access

### Database Patterns

- **Tables:** `jobs` (unique on `job_no`), `search_logs`
- **Prepared statements:** compiled once in `db.js`, exported via `stmts` object
- **Dynamic queries:** `db.prepare()` inline in route handlers when needed
- **Transactions:** `db.transaction(() => { ... })()`
- **SQL injection prevention:** whitelist sort columns, never interpolate user input into SQL

### Naming Conventions

| Context      | Convention      | Example              |
| ------------ | --------------- | -------------------- |
| JS vars      | `camelCase`     | `jobCount`           |
| SQL columns  | `snake_case`    | `job_no`, `salary_low` |
| Files        | `kebab-case.js` | `salary.js`          |
| SQL params   | `@snake_case`   | `@job_no`            |

### API Response Format

```json
// Success
{ "success": true, "data": [...], "pagination": { "page": 1, "totalPages": 5 } }

// Error
{ "success": false, "error": "message" }  // + appropriate HTTP status code
```

### Constraints

- No schema validation yet — if adding, use Fastify built-in JSON Schema
- No tests yet — if adding, use Vitest or Node built-in test runner
- `POST /api/jobs` accepts both camelCase and snake_case field names (dual-format tolerance)

---

## Extension — `extension/`

- Chrome Manifest V3, vanilla JS, no build step, no npm dependencies
- Target: `https://www.104.com.tw/jobs/search/*`
- **Pipeline:** `injected.js` (intercepts XHR) → `content.js` (relay) → `background.js` (process & send) → server
- Server URL hardcoded: `http://localhost:3104`
- Data cleaning happens in `background.js` via `cleanJob()`
- Reload extension manually after any code changes

---

## Cross-Module Rules

- Modules are fully independent — no shared packages or code
- `web/` → `server/` via HTTP (Axios, proxied in dev)
- `extension/` → `server/` via direct `fetch`
- Changing server API contracts → update **both** consumers (`web/` and `extension/`)
- **Never edit:** `web/src/styles/legacy/`, `server/data/jobs.db`, `extension/icons/`
