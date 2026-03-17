# Project Technical Guidelines & Architecture Rules

## 1. Project Context

- **Framework:** React 19+ (CSR) + Vite
- **Lib:** i18next (Internationalization)
- **Language:** TypeScript 5+ (Strict Mode)
- **Architecture:** Clean Architecture + MVVM (Binder Pattern)
- **Styling:** SCSS
- **Testing:** Vitest + React Testing Library

---

## 2. Strict Isolation Policy (CRITICAL)

**The AI must strictly adhere to these boundaries to prevent architectural erosion:**

1.  **3rd Party Libs Isolation:**
    - Direct imports of external libraries (e.g., `axios`, `zod`, `@tanstack/*`) are **FORBIDDEN** in feature code.
    - **Exception:** `react`, `react-dom`, `react-router-dom` (components only), `clsx/tailwind-merge`.
    - **Rule:** All other libs must be wrapped or re-exported in `@/lib`.
    - _Example:_ Import `useQuery` from `@/lib/react-query`, NOT `@tanstack/react-query`.

2.  **Domain Gatekeeper:**
    - The UI Layer (`src/pages`, `src/components`) must **ONLY** import business logic from `@/domain`.
    - **Forbidden:** Deep imports like `@/domain/services/user`.
    - **Allowed:** `import { UserService, type UserDto } from '@/domain';`

3.  **Pure ViewControllers:**
    - ViewControllers (`.view-controller.tsx`) must contain **ZERO** business logic or hooks.
    - They only receive props and render UI.

---

## 3. Directory Structure

```text
src/
├── app/                 # Application Configuration & Setup
│   ├── config/          # Environment variables, global constants
│   ├── providers/       # Global Providers (QueryClient, Router, Theme...)
│   └── index.ts         # App Entry setup
├── i18n/                # [I18N] Internationalization Config & Locales
│   ├── locales/         # Translation Files
│   ├── constants.ts     # Locale Constants
│   └── index.ts         # Init & Re-exports
├── hooks/               # [SHARED UI LOGIC] Generic Hooks (useDebounce, etc.)
│   └── index.ts         # Barrel export
├── lib/                 # [ADAPTER LAYER] 3rd Party Wrappers & Internal Libraries
│   ├── axios/           # Exports { apiClient }
│   ├── react-query/     # Exports { useQuery, ... } AND query-keys.ts
│   │   ├── index.ts     # Wrapper exports
│   │   └── query-keys.ts # [REGISTRY] Query Key Factory
│   ├── zod/             # Exports { z }
│   └── react-hook-form/ # Exports { useForm, ... }
├── domain/              # [CORE LAYER] Pure Business Rules
│   ├── index.ts         # [GATEKEEPER] Exports Services, DTOs
│   ├── constants/       # Business Constants
│   ├── repositories/    # Data Access + API Types (*Req, *Resp)
│   └── services/        # Use Cases + DTO Types (*Dto)
├── store/               # [CLIENT STATE] Global UI State (Zustand)
│   ├── index.ts         # Root Store
│   └── slices/          # Slices (ui.slice.ts, auth.slice.ts)
├── components/          # [SHARED UI] Reusable dumb components
├── styles/              # [STYLING] Global Styles
│   ├── legacy/          # Legacy styles from old project (do not modify)
│   └── index.scss       # Project style entry point
├── layouts/             # [LAYOUT LAYER] Page Layouts (MainLayout, AuthLayout...)
│   ├── MainLayout/      # Main layout with Header, Sidebar, Footer
│   │   ├── MainLayout.view-model.ts
│   │   ├── MainLayout.view-controller.tsx
│   │   └── index.ts
│   └── index.ts         # Barrel export
├── pages/               # [VIEWS] Full Pages using MVVM Binder
│   ├── Login/           # Page Folder
│   │   ├── Login.view-model.ts      # Logic (Hook)
│   │   ├── Login.view-controller.tsx # UI (Pure Component)
│   │   └── index.ts                 # Entry (Binder)
├── utils/               # Shared Utilities
│   └── bind.tsx         # [CORE] The MVVM Binder HOC
├── router/              # Routing Configuration
│   ├── routes.tsx       # Centralized Route Config
│   └── paths.ts         # Path Constants
└── main.tsx
```

## 4. State Management Strategy

### A. Server State (Data from API)

- **Tool:** React Query.
- **Key Location:** `src/lib/react-query/query-keys.ts`.
- **Logic Location:** Handled inside ViewModels calling `src/domain/services`.
- **Constraint:** Query Keys are defined in Lib (Start of Adapter) but consumed in ViewModels.

### B. Client State (UI/Session)

- **Tool:** Zustand.
- **Location:** `src/store/`.
- **Constraint:** Use the Slice Pattern. Do NOT store API response data here.

## 5. MVVM Implementation Rules (The Binder Pattern)

**For all Pages and complex widgets, use the Binder Pattern.**

### A. ViewModel (`[Name].view-model.ts`)

- **Role:** The "Brain".
- **Input:** Accepts Props.
- **Responsibilities:**
  - Get Client State (useAppStore).
  - Get Server State (useQuery with QUERY_KEYS from `@/lib/react-query`).
  - Handle User Interaction (Forms, Event Handlers).
  - Call Domain Services (UserService.update(...)).
- **Output:** Returns an object containing ready-to-render data (DTOs) and handlers.

### B. ViewController (`[Name].view-controller.tsx`)

- **Role:** The "Face".
- **Input:** Props & ViewModelReturn.
- **Constraint:** NO HOOKS. NO useEffect, NO useQuery, NO useState.
- **Logic:** Only conditional rendering and mapping data to components.
- **Export:** Wrapped with `bind()`.

## 6. Naming Conventions

- **Repository Types:** `[Name]Req` (Request), `[Name]Resp` (Response). Internal to Domain.
- **Service Types:** `[Name]Dto` (Data Transfer Object). Public to UI.
- **Service Functions:** `[action]Usecase` (e.g., `getUserUsecase`).
- **Files:**
  - `kebab-case` for directories and generic files.
  - `PascalCase` for Components and Classes.
  - `firstName` (camelCase) for variables and properties.
  - `UPPER_CASE` for constants.

## 6.1 Coding Style

- **Imports:** Always use `import type { ... }` when importing types to enable better tree-shaking and separation of concerns.

## 7. Code Examples

### A. Query Keys (`src/lib/react-query/query-keys.ts`)

```ts
export const QUERY_KEYS = {
  USER: {
    ROOT: ['users'] as const,
    DETAILS: ['users', 'detail'] as const,
    DETAIL: (id: string) => ['users', 'detail', id] as const,
  },
} as const;
```

### B. Domain: Service (`src/domain/services/user/get-user.usecase.ts`)

```ts
import { UserRepository } from '../../repositories/user.repo';

export interface UserDto {
  id: string;
  fullName: string;
}

export const getUserUsecase = async (id: string): Promise<UserDto> => {
  const resp = await UserRepository.getById({ id }); // Returns *Resp
  // Map Resp -> Dto
  return {
    id: resp.id,
    fullName: `${resp.first_name} ${resp.last_name}`,
  };
};
```

### C. Client Store (`src/store/index.ts`)

```ts
import { create } from 'zustand';
import { createUiSlice, type UiSlice } from './slices/ui.slice';

export const useAppStore = create<UiSlice>()((...a) => ({
  ...createUiSlice(...a),
}));
```

### D. MVVM: ViewModel (`src/pages/User/User.view-model.ts`)

```ts
import { useQuery, useQueryClient, QUERY_KEYS } from '@/lib/react-query';
import { useAppStore } from '@/store';
import { UserService, type UserDto } from '@/domain';

export interface UserProps {
  userId: string;
}

export const UserViewModel = ({ userId }: UserProps) => {
  const { isSidebarOpen } = useAppStore(); // Client State

  const { data } = useQuery({
    queryKey: QUERY_KEYS.USER.DETAIL(userId), // Key from Lib
    queryFn: () => UserService.getUserUsecase(userId), // Service from Domain
  });

  return {
    userId,
    user: data, // Typed as UserDto | undefined
    isSidebarOpen,
  };
};

export type IUserViewModel = ReturnType<typeof UserViewModel>;
```

### E. MVVM: ViewController (`src/pages/User/User.view-controller.tsx`)

```ts
import { bind } from "@/utils";
import { UserViewModel, type IUserViewModel } from "./User.view-model";

function UserViewController({ userId, user, isSidebarOpen }: IUserViewModel) {
  // Pure UI Logic only
  if (!user) return <div>Loading...</div>;

  return (
    <div className={isSidebarOpen ? "pl-64" : ""}>
      <h1>{user.fullName}</h1>
    </div>
  );
}

export const User = bind(UserViewController, UserViewModel);
```

### F. MVVM: View Index (`src/pages/User/index.ts`)

```ts
// Default export for lazy loading
export { User as default } from './User.view-controller';

export { type UserProps } from './User.view-model';
```

## 8. Environment Configuration

### A. Environment Files

```text
/
├── .env           # Shared variables (loaded in all modes)
├── .env.dev       # Dev environment
├── .env.uat       # UAT environment
├── .env.stage     # Stage environment
```

### B. Available Scripts

**Development (local server):**

```bash
npm run dev          # Connect to dev API
npm run dev:uat      # Connect to uat API
npm run dev:stage    # Connect to stage API
```

**Build:**

```bash
npm run build        # Build for prod (always production)
```

### C. Adding Environment Variables

1. Add the variable to all `.env.*` files with appropriate values.
2. Prefix with `VITE_` to expose to client code.
3. Access via `import.meta.env.VITE_VARIABLE_NAME`.

**Example:**

```bash
# .env.dev
VITE_API_URL=https://dev-api.example.com
VITE_FEATURE_FLAG=true
```

```ts
// Usage in code
const apiUrl = import.meta.env.VITE_API_URL;
```

### D. API Proxy (Dev Server)

During local development, Vite dev server proxies API requests to avoid CORS issues.

**Configuration:** `vite.config.ts`

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      proxy: {
        '/moapi': {
          target: env.VITE_API_URL, // Auto-switches based on mode
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/moapi/, ''),
        },
      },
    },
  };
});
```

**How it works:**

```text
npm run dev:uat
    ↓
Frontend: GET /moapi/users
    ↓
Vite proxy → https://uat-api.example.com/users
    ↓
Response returns to frontend
```

**Constraint:** `src/lib/axios` uses `baseURL: '/moapi'` (relative path). The proxy handles the actual API routing.

---

## 9. Development Workflow

When implementing a new feature (e.g., "Product List"):

1. **Domain Layer:**
   - Create `ProductRepository` in `src/domain/repositories` (define `ProductResp` here).

   - Create `getProductsUsecase` in `src/domain/services/product` (define `ProductDto` here).
     - _Note: If DTO is shared, create `types.ts` in the service folder._

   - Export Service and Dto in `src/domain/index.ts`.

2. **React Query Layer:**
   - Define `QUERY_KEYS.PRODUCT` in `src/lib/react-query/query-keys.ts`.

3. **State Layer (Optional):**
   - If UI state is needed (e.g., filter visibility), add `product.slice.ts` to `src/store`.

4. **Presentation Layer:**
   - Create `src/pages/ProductList`.

   - Create `ProductList.view-model.ts` -> Calls `useQuery` with `QUERY_KEYS`.

   - Create `ProductList.view-controller.tsx` -> Pure JSX.

   - Create `index.ts` -> Export bound component.

5. **Routing:**
   - Add path to `src/router/paths.ts`.

   - Add route to `src/router/routes.tsx`.

## 10. Testing Guidelines

### A. Technology Stack

- **Runner:** Vitest
- **Utils:** @testing-library/react, @testing-library/user-event

### B. Testing Layers

1.  **Domain Tests (Unit Tests)**
    - **Target:** `src/domain/services/*.ts`, `src/utils/*.ts`
    - **Goal:** Verify business logic rules and data transformation.
    - **Rule:** 100% logic coverage recommended.
    - **File:** `[Name].test.ts` next to the source file.

2.  **ViewModel Tests (Integration Tests)**
    - **Target:** `*.view-model.ts`
    - **Goal:** Verify UI interactions, state updates, and data fetching flow.
    - **Method:** Use `renderHook` from `@testing-library/react`.
    - **Mocking:** MUST mock Domain Services and React Query.
    - **File:** `[Name].view-model.test.ts`.

3.  **UI Tests (Component Tests)**
    - **Target:** Shared Components (`src/components`) & ViewControllers.
    - **Goal:** Verify visual rendering and event propagation.
    - **Method:** Use `render`, `screen` from `@testing-library/react`.
    - **File:** `[Name].view-controller.test.tsx` (or `[Name].test.tsx` for shared components).

### C. Naming & Location

- Place test files **adjacent** to the implementation file.
- Format: `[Filename].test.ts(x)`.

### D. Example: ViewModel Test

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserViewModel } from './User.view-model';
import { UserService } from '@/domain';

// Mock Dependencies
vi.mock('@/domain');
vi.mock('@/store', () => ({ useAppStore: () => ({ isSidebarOpen: true }) }));
vi.mock('@/lib/react-query', () => ({
  useQuery: () => ({ data: { id: '1', fullName: 'Test User' } }),
}));

describe('UserViewModel', () => {
  it('should return formatted user data', () => {
    const { result } = renderHook(() => UserViewModel({ userId: '1' }));

    expect(result.current.user?.fullName).toBe('Test User');
    expect(result.current.isSidebarOpen).toBe(true);
  });
});
```

## 11. Commit Convention

We follow the [Angular Commit Message Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit).

### A. Format

```text
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### B. Types

| Type         | Description                                                   |
| ------------ | ------------------------------------------------------------- |
| **feat**     | A new feature                                                 |
| **fix**      | A bug fix                                                     |
| **docs**     | Documentation only changes                                    |
| **style**    | Code style changes (formatting, missing semi-colons, etc.)    |
| **refactor** | Code change that neither fixes a bug nor adds a feature       |
| **perf**     | Performance improvements                                      |
| **test**     | Adding or correcting tests                                    |
| **build**    | Changes to build system or dependencies (e.g., npm, vite)     |
| **ci**       | Changes to CI configuration (e.g., GitHub Actions, GitLab CI) |
| **infras**   | Infrastructure related changes                                |
| **chore**    | Other changes that don't modify src or test files             |
| **revert**   | Reverts a previous commit                                     |

### C. Example

```text
feat(auth): add login functionality

Implement login form with validation and error handling.
Integrate with backend authentication API.
```
