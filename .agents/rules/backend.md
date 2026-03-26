---
trigger: always_on
---

# Backend Architecture & Coding Standards

Always strictly adhere to the following architectural guidelines, stack choices, and coding standards when generating, modifying, or reviewing API code.

## 1. Core Stack
- **Framework:** HonoJS
- **Validation:** Zod
- **Documentation/Routing:** OpenAPI (via `@hono/zod-openapi`)
- **Language:** TypeScript
- **Testing:** Vitest / Bun Test (Unit & Integration)

## 2. Strict Type Safety
- **Zero `any` Policy:** Never use `any`. Use `unknown` and narrow with type guards or Zod.
- **Strict Mode:** Assume `strict: true`. No implicit any, strict null checks.
- **Explicit Returns:** All functions and route handlers must have explicitly declared return types.
- **Zod Inference:** Derive TypeScript types from Zod schemas using `z.infer`.

## 3. Agnostic Architecture (Clean / Hexagonal)
- **Separation of Concerns:** API layer decoupled from data access and runtime.
- **Data Agnosticism (Repository Pattern):** Define interfaces (e.g., `UserRepository`). Implement adapters (e.g., `SQLiteUserRepository`).
- **Dependency Injection:** Inject repositories via Hono context or constructor. Never import DB connections directly into routes.

## 4. RESTful API Design
- **Resource-Oriented:** Use nouns (`/users`), not verbs (`/createUser`).
- **HTTP Methods:** Adhere to standard semantics (GET, POST, PUT, PATCH, DELETE).
- **Status Codes:** Return accurate codes (201 for creation, 404 for missing, etc.).

## 5. Testing & 100% Coverage
- **Coverage Goal:** Aim for **100% code coverage**. Every logic branch, error state, and route must be exercised.
- **Ephemeral Integration Tests:** For all data-dependent tests, the test runner must:
    1.  Spin up a fresh, isolated database instance (e.g., in-memory SQLite or a temporary Docker container).
    2.  Run migrations/schema setup.
    3.  Seed required reference data.
    4.  Execute the test and assert results.
    5.  Tear down the instance to ensure side-effect isolation.
- **Mocking:** Mock external third-party APIs, but prefer real database adapters (integration) over mocking the Repository layer.

## 6. Agent Verification Protocol
- **Test-Before-Confirm:** Before the AI agent reports a task as "complete" or "fixed," it **must** run the relevant test suite.
- **Regression Check:** Any change to existing logic requires running the full suite to ensure no regressions.
- **Output Validation:** If tests fail, the agent must diagnose, fix, and re-run tests until they pass before presenting the final code.

## 7. Required Project Structure
Follow this domain-driven / layered folder structure:

```text
src/
├── adapters/       # DB/Env specific implementations
├── core/           # Interfaces, domain types, business logic
├── schemas/        # Zod schemas (OpenAPI)
├── routes/         # OpenAPI route definitions (createRoute)
├── handlers/       # Route controller implementations
├── tests/          # Integration & Unit tests
└── index.ts        # Composition root / DI container