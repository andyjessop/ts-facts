# ts-facts

**ts-facts** is a small CLI that loads a TypeScript project from a `tsconfig.json`, walks the program with the compiler API, and writes a single JSON file of static facts: symbols, type declarations, and call sites. Use it to snapshot structure for tooling, docs, or analysis.

This repository is a Bun monorepo. The CLI lives in `apps/ts-facts` and depends on `packages/ts-facts-core`.

## Prerequisites

- [Bun](https://bun.sh/) installed on your PATH (`bun --version`)

## Install

From the root of this repo:

```bash
bun install
```

## Run against another repository (from repo root)

Use the root script so you do not need to `cd` into `apps/ts-facts`. Pass the **absolute path** (or a path that resolves correctly) to the target project’s `tsconfig.json`.

**Minimal example** — write `ts-static-facts.json` in the **root of the analyzed project** (default filename; relative paths are resolved against that project root, not your shell’s cwd):

```bash
bun run ts-facts -- --tsconfig /Users/you/dev/my-app/tsconfig.json
```

**Explicit output path** — still relative to the analyzed project’s root when you use a relative path:

```bash
bun run ts-facts -- \
  --tsconfig /Users/you/dev/my-app/tsconfig.json \
  --out ./analysis/static-facts.json
```

**Output somewhere else** — use an absolute path for `--out`:

```bash
bun run ts-facts -- \
  --tsconfig /Users/you/dev/my-app/tsconfig.json \
  --out /Users/you/Desktop/my-app-facts.json
```

The script rebuilds the CLI (`tsc` in `apps/ts-facts`) on each run so the binary matches the current source. For faster iteration after you have already built once:

```bash
cd apps/ts-facts && bun dist/index.js --tsconfig /Users/you/dev/my-app/tsconfig.json
```

(Run `bun run build` in `apps/ts-facts` whenever you change CLI or core code.)

## CLI options

| Option | Required | Description |
|--------|----------|-------------|
| `--tsconfig` | Yes | Path to the target `tsconfig.json`. Resolved to an absolute path; the project root defaults to the directory containing that file unless `--rootDir` is set. |
| `--out` | No (default: `./ts-static-facts.json`) | Output JSON path. If relative, it is resolved against the **analyzed project’s root** (`rootDir`). If absolute, it is used as-is. |
| `--rootDir` | No | Override the project root used for filtering sources and resolving relative `--out`. |
| `--exclude` | No (repeatable) | Extra [picomatch](https://github.com/micromatch/picomatch) patterns (project-relative). If omitted, tests, `node_modules`, `dist`, and `build` are excluded by default. |

## Output

The extractor produces a stable, byte-deterministic JSON file.

### Top-level JSON shape

```json
{
  "schemaVersion": "0.1.0",
  "mode": "typescript_static_facts",
  "project": {
    "name": "my-project",
    "root": "/path/to/project",
    "tsconfig": "tsconfig.json",
    "sourceFiles": [
      "src/index.ts"
    ]
  },
  "symbols": [],
  "typeDeclarations": [],
  "calls": []
}
```

Shape is defined by TypeScript types in `packages/ts-facts-core/src/schema.ts`.

## Extracted facts

The MVP extracts:

- named function declarations
- class declarations
- class methods
- constructors
- top-level variables initialized with arrow functions or function expressions
- type aliases
- interfaces
- enums
- call expressions
- new expressions

## Non-goals

This is a static fact extractor. It does not guarantee:

- perfect dynamic call resolution (e.g., dynamic property access `service[action]()` will yield a `null` target)
- runtime behavior or control flow
- semantic business meaning
- analysis of generated files unless they are explicitly included by the target `tsconfig.json`

## Develop and test this repo

From the **repository root** (per project conventions):

```bash
bun run test
bun run lint
bun run format
bun run typecheck
bun run test:integration
```

## Other apps in the monorepo

This workspace also contains other apps (for example `apps/client`, `apps/cli`). They are independent of the ts-facts CLI; see each app’s `package.json` for its scripts.
