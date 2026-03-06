# Pi Framework Guidebook: Building with Pi

A comprehensive guide to building applications using the Pi architecture, based on the patterns established in this codebase.

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Separation of Concerns](#3-separation-of-concerns)
4. [Module Structure](#4-module-structure)
5. [Redux Layer (redux.ts)](#5-redux-layer-reduxts)
6. [React Layer (react.tsx)](#6-react-layer-reacttsx)
7. [Middleware Patterns](#7-middleware-patterns)
8. [Thunk Patterns](#8-thunk-patterns)
9. [Pi Router](#9-pi-router)
10. [Minimal Dependencies](#10-minimal-dependencies)
11. [Testing](#11-testing)
12. [Headless Debugging](#12-headless-debugging)

---

## 1. Core Philosophy

**Pi is not a framework. It is a set of strict conventions.**

- **Redux is the application runtime.** All state, navigation, and behaviour flow through Redux.
- **Routes are Redux state.** Navigation is an action; the URL is derived from state.
- **Build over import.** Prefer building simple solutions over adding external libraries.
- **Velocity over performance.** Optimize for maintainability and AI-assisted development.
- **Transparency.** Every piece of behaviour is explicit and testable.
- **Integration testing made easy.** As presentation is just a thin (dumb) layer, application can be tested headlessly to a high degree of confidence.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Pi Framework                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Modules   │  │   Router    │  │  Redux Store (RTK)       │ │
│  │  (reducer + │  │  (slice +   │  │  - Thunk middleware      │ │
│  │  middleware)│  │  thunks)    │  │  - Module middleware     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React (Presentation Only)                     │
│  useAppSelector(state)  →  useAppDispatch()  →  Pure components │
└─────────────────────────────────────────────────────────────────┘
```

**Key principle:** React components are **pure**. They select state and dispatch actions. They do not fetch data, poll, or orchestrate side effects.

---

## 3. Separation of Concerns

### The Golden Rule: No Business Logic in React

| Layer | Responsibility | Must NOT Do |
|-------|-----------------|--------------|
| **redux.ts** | State, actions, thunks, middleware, selectors | — |
| **react.tsx** | Render UI, bind events to dispatch | `useEffect` for data fetching, business logic, complex conditionals |

### What "Pure" Means for React

- **Data:** Use `useAppSelector` to read state. Never derive business data in components; use selectors.
- **Interaction:** Use `useAppDispatch` to dispatch actions or thunks. Event handlers should be one-liners: `onClick={() => dispatch(someAction())}`.
- **Forms:** Form and modal state live in Redux. The UI selects that state and dispatches actions on change. No local form state; the component is a pure reflection of Redux.

### Acceptable useEffects in React

Only for **UI-only** concerns that cannot live in Redux:

- Usage of HTML APIs.
- Cleanup of browser APIs on unmount (e.g. stopping MediaStream tracks).

**Never** use `useEffect` for:

- Fetching data on mount.
- Polling.
- Subscribing to route changes to trigger fetches.

These belong in **middleware** that listens for `router/navigateSuccess`.

---

## 4. Module Structure

Every feature is a **module** with this structure:

```
modules/
  my-feature/
    index.ts      # Re-exports only. No logic.
    redux.ts      # Slice, thunks, selectors, middleware
    redux.test.ts # Required. 100% coverage.
    react.tsx     # Components, Container
```

### index.ts

```typescript
// Sole purpose: import and export. No logic.
export * from "./redux";
export * from "./react";
```

### Module Export for Pi

Each `redux.ts` must export a module object for Pi to register:

```typescript
export const module = createModule("myFeature", reducer, [middleware]);
```

---

## 5. Redux Layer (redux.ts)

### 5.1 State Shape

- **Export the state interface.** Tests and consumers need it.
- **Minimal and normalized.** Store raw data only. Derived data lives in selectors.

```typescript
export interface MyFeatureState {
  items: Item[];
  meta: PaginationMeta | null;
  loading: 'idle' | 'pending' | 'succeeded' | 'failed';
  error: string | null;
  // UI state (modals, etc.) lives here too
  modal: { isOpen: boolean; currentId: string | null };
}
```

### 5.2 Slice

Use `createSlice` from Redux Toolkit:

```typescript
const mySlice = createSlice({
  name: "myFeature",
  initialState,
  reducers: {
    openModal(state, action: PayloadAction<{ id: string }>) {
      state.modal.isOpen = true;
      state.modal.currentId = action.payload.id;
    },
    closeModal(state) {
      state.modal.isOpen = false;
      state.modal.currentId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => { state.loading = 'pending'; })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.loading = 'succeeded';
        state.items = action.payload.items;
        state.meta = action.payload.meta;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.loading = 'failed';
        state.error = action.payload as string;
      });
  },
});
```

### 5.3 Selectors

Export a `selectors` object. Selectors compute derived data; never store it.

```typescript
export const selectors = {
  items: (state: RootState) => state.myFeature.items,
  meta: (state: RootState) => state.myFeature.meta,
  isLoading: (state: RootState) => state.myFeature.loading === 'pending',
  modal: (state: RootState) => state.myFeature.modal,
};
```

### 5.4 No `any`

Avoid `any`. Use `unknown` and type guards when types are dynamic. Import `RootState` from your store for selector typing.

---

## 6. React Layer (react.tsx)

### 6.1 Data Binding

```typescript
const items = useAppSelector(selectors.items);
const isLoading = useAppSelector(selectors.isLoading);
const dispatch = useAppDispatch();
```

### 6.2 Event Handlers

Keep handlers thin. Dispatch actions or thunks directly:

```typescript
<Button onClick={() => dispatch(openCreateModal())}>Create</Button>
<Button onClick={() => dispatch(deleteItem(id))}>Delete</Button>
```

For thunks (async actions), dispatch the thunk:

```typescript
dispatch(fetchItems({ page, limit }));
// or with cast if needed: (dispatch as any)(fetchItems({ page, limit }))
```

### 6.3 Navigation

Use `navigateTo` from Pi. It is a thunk:

```typescript
import { navigateTo } from "path/to/pi/package";

dispatch(navigateTo({
  name: "entities",
  search: { page: String(page), limit: String(limit) }
}) as any);
```

### 6.4 Container Pattern

Each module exports a `Container` that composes the feature's components. The root `App` renders containers based on the current route.

```typescript
export function Container() {
  return (
    <div>
      <ItemsTable />
      <ItemModal />
    </div>
  );
}
```

---

## 7. Middleware Patterns

**Middleware is where side effects live.** It listens for actions and dispatches thunks or other actions.

### 7.1 Route-Based Data Fetching

**Never fetch in `useEffect`.** Fetch when the user navigates to the route. Middleware listens for `router/navigateSuccess`:

```typescript
export const middleware: Middleware = (store) => {
  let interval: ReturnType<typeof setInterval> | null = null;

  return (next) => (action) => {
    const result = next(action);

    if (action?.type === "router/navigateSuccess") {
      const state = store.getState();
      const currentRoute = selectRouteName(state);
      const search = selectRouteSearch(state) || {};

      if (currentRoute === "myFeature") {
        // Ensure URL has pagination params
        if (!search.page || !search.limit) {
          store.dispatch(navigateTo({
            name: "myFeature",
            search: { page: search.page || "1", limit: search.limit || "50" }
          }) as any);
          return result;
        }

        const page = parseInt(search.page);
        const limit = parseInt(search.limit);

        store.dispatch(fetchItems({ page, limit }) as any);

        // Polling: refresh every 10s
        if (interval) clearInterval(interval);
        interval = setInterval(() => {
          store.dispatch(fetchItems({ page, limit }) as any);
        }, 10000);
      } else {
        // Cleanup when leaving route
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    }

    return result;
  };
};
```

### 7.2 Debouncing

For search-as-you-type, debounce in middleware. When the user types, you dispatch a sync action (e.g. `setSearchQuery`). Middleware debounces and then dispatches the search thunk:

```typescript
if (action?.type === mySlice.actions.setSearchQuery.type) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    store.dispatch(performSearch() as any);
  }, 300);
}
```

### 7.3 Cleanup

Always clean up timers and intervals when leaving the route or when the relevant action is no longer applicable.

### 7.4 Middleware Order

Pi concatenates all module middleware. Order is determined by module registration. Each middleware receives actions after they pass through the reducer (because `next(action)` is called first, then you react to the result).

---

## 8. Thunk Patterns

### 8.1 Async Thunks for API Calls

Use `createAsyncThunk` for all network requests:

```typescript
export const fetchItems = createAsyncThunk(
  "myFeature/fetchItems",
  async ({ page = 1, limit = 50 }: FetchArgs = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const response = await fetch(`${API_URL}/items?${params}`, {
        headers: { "api-key": import.meta.env.VITE_API_KEY || "dev-secret-key" },
      });
      if (!response.ok) throw new Error("Failed to fetch");
      return await response.json();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : "Failed to fetch");
    }
  }
);
```

### 8.2 Orchestration Thunks

Thunks can read state and dispatch other thunks:

```typescript
export const performSearch = createAsyncThunk(
  "myFeature/performSearch",
  async (_, { dispatch, getState }) => {
    const state = getState() as RootState;
    const { query } = state.myFeature.search;

    if (query.trim().length > 0) {
      dispatch(searchItems({ query }));
    } else {
      dispatch(clearSearch());
    }
  }
);
```

### 8.3 Navigation from Thunks

After a successful async operation, you can navigate:

```typescript
export const submitSearch = createAsyncThunk(
  "search/submit",
  async (query: string, { rejectWithValue, dispatch }) => {
    const response = await fetch(...);
    const data = await response.json();

    dispatch(navigateTo({ name: "searchDetail", params: { id: data.id } }) as any);
    return data;
  }
);
```

### 8.4 No External Thunk Library

Redux Toolkit includes thunk middleware by default. No `redux-thunk` package is needed.

---

## 9. Pi Router

**Pi uses a custom router. No React Router, no external routing library.**

### 9.1 Route Configuration

Define routes with `createRoutes`:

```typescript
import { createRoutes } from "path/to/pi/package";

const routes = createRoutes({
  home: { path: "/" },
  entities: { path: "/entities" },
  entityDetail: { path: "/entities/:id" },
  search: { path: "/search" },
  searchDetail: { path: "/search/:id" },
});
```

### 9.2 Navigation

`navigateTo` is a thunk. Pass route name, optional params, search, and hash:

```typescript
navigateTo({ name: "entities" });
navigateTo({ name: "entityDetail", params: { id: "123" } });
navigateTo({ name: "entities", search: { page: "2", limit: "50" } });
```

### 9.3 Router State

The router slice stores the current route. Selectors:

- `selectRouteName(state)` → `"entities"` | `"searchDetail"` | etc.
- `selectRouteParams(state)` → `{ id: "123" }`
- `selectRouteSearch(state)` → `{ page: "2", limit: "50" }`
- `selectRouteHash(state)` → hash string

### 9.4 How It Works

- `initRouter(routes)` is dispatched on app init. It parses the current URL and dispatches `navigateSuccess`.
- `navigateTo` updates `window.history` with `pushState` and dispatches `navigateSuccess`.
- `popstate` (back/forward) triggers a handler that parses the URL and dispatches `navigateSuccess`.
- **Middleware listens for `router/navigateSuccess`** to trigger data fetching, polling, and cleanup.

### 9.5 App-Level Routing

`App` selects `currentRoute` and renders the appropriate `Container`:

```typescript
const currentRoute = useAppSelector(selectRouteName);

switch (currentRoute) {
  case "home": return <HomeModule />;
  case "entities": return <EntitiesModule />;
  case "recordings": return <RecordingsModule />;
  default: return <FallbackModule />;
}
```

---

## 10. Minimal Dependencies

Pi intentionally avoids heavy external libraries:

| Concern | Pi Approach | Avoid |
|---------|-------------|-------|
| Routing | Custom Pi router (Redux slice + thunks) | React Router |
| Data fetching | Thunks + middleware | react-query, SWR |
| Async | RTK `createAsyncThunk` | redux-saga, redux-observable |
| State | Redux Toolkit | Zustand, Jotai |
| UI | Radix primitives, Tailwind | Heavy component libraries |

**Core stack:** React, Redux Toolkit, react-redux. Pi adds conventions and a router.

---

## 11. Testing

### 11.1 Redux Tests

Every `redux.ts` has a `redux.test.ts` with **100% coverage**. Can use any testing library, like Vitest, bun test, etc.

- Import `State` from `redux.ts` for typed `initialState`.
- Test reducers with plain actions.
- Test `extraReducers` with `pending`/`fulfilled`/`rejected` actions.
- Test thunks by mocking `fetch` and asserting dispatch calls.
- Test middleware by dispatching actions and asserting side effects (e.g. debounce, fetch on route change).

### 11.2 Integration Tests

In Pi, **integration tests are headless**. Pi does not do browser or component testing. There is no Selenium, Puppeteer, or React Testing Library for full-page flows. Instead, integration tests exercise the Redux runtime directly: dispatch navigation, wait for thunks to resolve, assert on state. Because routing, data fetching, and side effects all flow through Redux, you can cover entire user journeys without spinning up a browser.

This makes integration tests **cheap** — fast to run, simple to write, easy to debug. You can afford to be extensive: test multi-step flows, edge cases, and error paths. A single test file can verify that navigating to a route triggers a fetch, that polling runs and stops on route change, and that form submission updates state correctly — all in milliseconds.

```typescript
const store = app.init();
await store.dispatch(navigateTo({ name: "entities" }));
// Assert state, no browser needed
```

### 11.3 Debug Tracing

Use `createTraceMiddleware` from `pi` to log every action and state to a JSONL file:

```typescript
import { createPi, createTraceMiddleware } from "pi";

const app = createPi({
  modules: { ... },
  routes,
  extraMiddleware: [createTraceMiddleware("/tmp/pi-trace.jsonl")],
});
const store = app.init();
```

---

## 12. Headless Debugging

Because **all business logic lives in Redux**, you can run the same application **without React** in Node and get **full visibility** of behaviour. This is one of Pi’s main advantages: you can debug and inspect the app headlessly.

### How it works

1. **Create a headless app** (e.g. a Node script or a separate entry that does not render any UI). Use the same Pi config as your React app: same `createPi`, same `modules`, same `routes`.
2. **Add debugging middleware** via `extraMiddleware`. Pi provides:
   - **`createTraceMiddleware(filePath)`** — appends every action and resulting state to a JSONL file. Use for replay, audits, or agent-based debugging.
   - **`createDebugMiddleware()`** — logs every action and state to the console. Use for quick inspection when running the app in Node.
3. **Drive the app** by dispatching actions (e.g. `navigateTo`, thunks). Because routing, data fetching, and side effects all go through Redux, the entire flow is visible in the trace or console. No browser, no DOM, no React.

### Example: headless debug script

```typescript
import { createPi, createRoutes, createDebugMiddleware, navigateTo } from "pi";
import { module as myFeatureModule } from "./modules/my-feature";

const routes = createRoutes({ home: { path: "/" }, list: { path: "/list" } });
const app = createPi({
  modules: { myFeature: myFeatureModule },
  routes,
  extraMiddleware: [createDebugMiddleware()],
});

const store = app.init();

// Simulate user flow
store.dispatch(navigateTo({ name: "list" }) as never);
// Console shows each action and state; thunks run; middleware runs.
```

### When to use it

- **Debugging:** Inspect why a route or thunk behaves a certain way without opening the browser.
- **Testing / agents:** Integration tests or AI agents can drive the Redux store and assert on state; trace files give a full log of what happened.
- **Auditing:** `createTraceMiddleware` produces a JSONL log of every action and state for later analysis.

The strict separation between Redux (runtime) and React (presentation) is what makes this possible: the “application” is just the store and its middleware.

---

## Quick Reference

| Task | Where | How |
|------|-------|-----|
| Fetch data on route enter | redux.ts middleware | Listen for `router/navigateSuccess` |
| Debounce search | redux.ts middleware | Listen for `setSearchQuery`, setTimeout → `performSearch` |
| Poll while on route | redux.ts middleware | setInterval on navigateSuccess, clearInterval on leave |
| Navigate | react.tsx or thunk | `dispatch(navigateTo({ name, params?, search? }))` |
| Open modal | react.tsx | `dispatch(openModal(id))` |
| Submit form | react.tsx | `dispatch(saveItem(payload))` |
| Read state | react.tsx | `useAppSelector(selector)` |
| API call | redux.ts | `createAsyncThunk` |
| Derived data | redux.ts | Selectors, never stored |
| Headless debug | Node script | Same Pi config + `extraMiddleware: [createDebugMiddleware()]` or `createTraceMiddleware(path)` |
---
