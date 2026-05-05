Below is an ordered implementation plan for the spec defined in ts-facts.md. Each task should be completed and verified before starting the next one.

# Implementation Plan: TypeScript Static Fact Extractor MVP

## Ground Rules

Use this order exactly. Do not skip ahead.

For every task:

1. Make the smallest possible code change that satisfies the task.
2. Add or update tests where the task asks for them.
3. Run the listed verification commands.
4. Do not begin the next task until the acceptance criteria pass.

Use these implementation choices for the MVP:

```text
Package binary name: ts-facts
Schema version: 0.1.0
Output mode: typescript_static_facts
Hash algorithm: SHA-256
Hash length: first 8 lowercase hex characters
Path format: project-relative POSIX paths
Line and column format: one-based
Default output file: ./ts-static-facts.json
Runtime/package manager/test runner: Bun
CLI framework: oclif
Repository layout: monorepo with apps/ and packages/
```

---

# Task 1: Create the Bun monorepo TypeScript project skeleton

## Goal

Create a working Bun monorepo TypeScript CLI project with the expected app and package source layout.

## Steps

1. Create the project root files:

```text
package.json
tsconfig.json
```

2. Create this monorepo source folder structure:

```text
apps/
  ts-facts/
    package.json
    tsconfig.json
    src/
      index.ts
packages/
  ts-facts-core/
    package.json
    tsconfig.json
    src/
      loadProject.ts
      ids.ts
      provenance.ts
      text.ts
      extractSymbols.ts
      extractTypeDeclarations.ts
      extractCalls.ts
      writeJson.ts
      schema.ts
```

3. Add TypeScript as a dependency.
4. Add oclif as the CLI framework dependency.
5. Add a glob-matching dependency for excludes, for example `minimatch`.
6. Add Bun test support using `bun:test`, not Vitest.
7. Add these Bun-compatible package scripts:

```json
{
  "build": "tsc -b",
  "test": "bun test",
  "dev": "bun run apps/ts-facts/src/index.ts"
}
```

8. Configure `apps/ts-facts/package.json` so the binary command is named:

```text
ts-facts
```

and points to the compiled oclif CLI entry file.

## Acceptance Criteria

* `bun install` completes successfully.
* `bun run build` completes successfully.
* `bun test` completes successfully, even if there are no meaningful tests yet.
* The repository contains all source files listed above.
* `apps/ts-facts/package.json` exposes a binary named `ts-facts`.

---

# Task 2: Define the JSON schema TypeScript types

## Goal

Create TypeScript interfaces for the final output shape before writing extraction logic.

## File

```text
packages/ts-facts-core/src/schema.ts
```

## Steps

1. Define these core types:

```ts
export interface StaticFactsFile
export interface ProjectMetadata
export interface Provenance
export interface SourcePosition
export interface SymbolFact
export interface SymbolParameterFact
export interface SymbolReturnTypeFact
export interface TypeDeclarationFact
export interface CallFact
export interface CallArgumentTypeFact
export interface CallReturnTypeFact
```

2. Use literal union types for known values.

Examples:

```ts
export type ProvenanceKind = "ast_node" | "type_checker";

export type SymbolKind =
  | "function"
  | "method"
  | "constructor"
  | "class"
  | "function_variable";

export type TypeDeclarationKind =
  | "type_alias"
  | "interface"
  | "enum";
```

3. Make nullable fields explicit.

Examples:

```ts
signatureText: string | null;
returnType: SymbolReturnTypeFact | null;
from: string | null;
to: string | null;
typeAnnotationText: string | null;
```

4. Ensure the top-level shape is:

```ts
{
  schemaVersion: "0.1.0";
  mode: "typescript_static_facts";
  project: ProjectMetadata;
  symbols: SymbolFact[];
  typeDeclarations: TypeDeclarationFact[];
  calls: CallFact[];
}
```

## Acceptance Criteria

* `packages/ts-facts-core/src/schema.ts` exports all required interfaces and union types.
* The schema contains fields for `id`, `stableKey`, and `provenance` on every emitted fact type.
* Nullable values are typed as `null`, not optional.
* `bun run build` passes.

---

# Task 3: Add the first fixture TypeScript project

## Goal

Create a tiny TypeScript project that can be used for end-to-end testing.

## Files

Create:

```text
fixtures/basic/tsconfig.json
fixtures/basic/src/users/types.ts
fixtures/basic/src/users/login.ts
```

## Steps

1. Add `fixtures/basic/tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

2. Add `fixtures/basic/src/users/types.ts`:

```ts
export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResult =
  | { kind: "success"; user: User }
  | { kind: "invalid_password" }
  | { kind: "locked_account" };

export interface User {
  id: string;
  email: string;
  locked: boolean;
}
```

3. Add `fixtures/basic/src/users/login.ts`:

```ts
import { LoginRequest, LoginResult } from "./types";

export async function login(input: LoginRequest): Promise<LoginResult> {
  const user = await findUserByEmail(input.email);

  if (!user) {
    return { kind: "invalid_password" };
  }

  if (user.locked) {
    return { kind: "locked_account" };
  }

  return { kind: "success", user };
}

async function findUserByEmail(email: string) {
  return null;
}
```

## Acceptance Criteria

* The fixture project has its own valid `tsconfig.json`.
* Running TypeScript against the fixture does not produce syntax errors.
* The fixture contains:

  * two type aliases,
  * one interface,
  * one exported function,
  * one non-exported function,
  * one call expression.

---

# Task 4: Implement stable hashing and ID helpers

## Goal

Create reusable helpers for deterministic IDs and stable keys.

## File

```text
packages/ts-facts-core/src/ids.ts
```

## Steps

1. Import Node’s `crypto` module.
2. Implement:

```ts
export function hashText(text: string, length = 8): string
```

3. `hashText` should:

   * use SHA-256,
   * return lowercase hex,
   * truncate to `length` characters.

4. Implement:

```ts
export function makeId(prefix: "sym" | "typedecl" | "call", stableKey: string): string
```

5. `makeId` should return:

```text
<prefix>_<hash>
```

Example:

```text
sym_8f12a91c
```

6. Implement stable key builders:

```ts
export function makeSymbolStableKey(args: {
  file: string;
  kind: string;
  qualifiedName: string;
  signatureText: string | null;
}): string

export function makeTypeDeclarationStableKey(args: {
  file: string;
  declarationKind: string;
  name: string;
  text: string;
}): string

export function makeCallStableKey(args: {
  from: string | null;
  to: string | null;
  file: string;
  expressionText: string;
  ordinal: number;
}): string
```

7. For type declarations, compute:

```text
textHash_<hash>
```

from the declaration text.

8. For calls, compute:

```text
exprHash_<hash>
```

from the expression text.

## Acceptance Criteria

* `hashText("abc")` always returns the same 8-character value.
* `makeId("sym", stableKey)` returns a value beginning with `sym_`.
* Symbol stable keys follow:

```text
symbol:<file>:<kind>:<qualifiedName>:<signatureText>
```

* Class symbol stable keys omit `signatureText` and follow:

```text
symbol:<file>:class:<qualifiedName>
```

* Type declaration stable keys follow:

```text
type-decl:<file>:<declarationKind>:<name>:textHash_<hash>
```

* Call stable keys follow:

```text
call:<from|null>:<to|null>:<file>:exprHash_<hash>:ordinal_<number>
```

* `bun test` includes unit tests for these helpers.
* `bun run build` passes.

---

# Task 5: Implement project-relative POSIX path helpers

## Goal

Ensure all output paths use project-relative POSIX-style paths.

## File

```text
packages/ts-facts-core/src/provenance.ts
```

or a small helper inside that file.

## Steps

1. Import Node’s `path` module.
2. Implement:

```ts
export function toProjectRelativePath(rootDir: string, absoluteFilePath: string): string
```

3. The function should:

   * convert `absoluteFilePath` to a path relative to `rootDir`,
   * replace Windows backslashes with `/`,
   * remove leading `./` if present.

4. Add tests for:

   * Unix-style paths,
   * Windows-style paths,
   * nested files.

## Acceptance Criteria

* `/repo/src/users/login.ts` with root `/repo` becomes:

```text
src/users/login.ts
```

* A Windows-style relative result like:

```text
src\users\login.ts
```

becomes:

```text
src/users/login.ts
```

* No output path starts with `./`.
* `bun test` passes.
* `bun run build` passes.

---

# Task 6: Implement provenance helpers

## Goal

Convert TypeScript AST node locations into the required provenance shape.

## File

```text
packages/ts-facts-core/src/provenance.ts
```

## Steps

1. Import TypeScript:

```ts
import ts from "typescript";
```

2. Implement:

```ts
export function getNodeKindName(node: ts.Node): string
```

3. Use:

```ts
ts.SyntaxKind[node.kind]
```

to produce names like:

```text
FunctionDeclaration
Parameter
CallExpression
```

4. Implement:

```ts
export function makeProvenance(args: {
  kind: "ast_node" | "type_checker";
  rootDir: string;
  sourceFile: ts.SourceFile;
  node: ts.Node;
}): Provenance
```

5. For start position, use:

```ts
node.getStart(sourceFile)
```

6. For end position, use:

```ts
node.getEnd()
```

7. Convert positions using:

```ts
sourceFile.getLineAndCharacterOfPosition(position)
```

8. Add `1` to both line and column values.

9. Return this shape:

```ts
{
  kind,
  file,
  nodeKind,
  start: { line, column },
  end: { line, column }
}
```

## Acceptance Criteria

* Provenance line and column values are one-based.
* `nodeKind` is a readable TypeScript syntax kind name.
* `file` is project-relative and POSIX-style.
* A `FunctionDeclaration` node produces `nodeKind: "FunctionDeclaration"`.
* A `Parameter` node produces `nodeKind: "Parameter"`.
* Unit tests cover at least one multi-line node.
* `bun test` passes.
* `bun run build` passes.

---

# Task 7: Implement source text and type text helpers

## Goal

Centralize text extraction and TypeChecker rendering.

## File

```text
packages/ts-facts-core/src/text.ts
```

## Steps

1. Import TypeScript.
2. Implement:

```ts
export function getNodeText(sourceFile: ts.SourceFile, node: ts.Node): string
```

3. `getNodeText` should return:

```ts
node.getText(sourceFile)
```

4. Implement:

```ts
export function getTypeAnnotationText(
  sourceFile: ts.SourceFile,
  nodeWithType: { type?: ts.TypeNode }
): string | null
```

5. If `nodeWithType.type` exists, return its source text.

6. If no annotation exists, return `null`.

7. Implement:

```ts
export function getCheckerTypeText(
  checker: ts.TypeChecker,
  node: ts.Node
): string
```

8. Use:

```ts
checker.getTypeAtLocation(node)
checker.typeToString(type)
```

9. Implement:

```ts
export function getReturnCheckerTypeText(
  checker: ts.TypeChecker,
  node: ts.SignatureDeclaration
): string | null
```

10. Use:

```ts
checker.getSignatureFromDeclaration(node)
checker.getReturnTypeOfSignature(signature)
checker.typeToString(returnType)
```

11. Return `null` only if no signature is available.

12. Implement:

```ts
export function buildSignatureText(args: {
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
  parameters: ts.NodeArray<ts.ParameterDeclaration>;
  declaration: ts.SignatureDeclaration;
}): string
```

13. The signature format must be:

```text
(paramName: ParamType, second: SecondType)=>ReturnType
```

14. For each parameter:

* use the parameter name source text,
* use explicit annotation text if present,
* otherwise use checker type text.

15. For return type:

* use explicit return annotation if present,
* otherwise use checker return type text.

## Acceptance Criteria

* Explicit parameter annotations are preserved exactly as source text.
* Explicit return annotations are preserved exactly as source text.
* Inferred parameter or return types use checker-rendered text.
* Signature text has no spaces around `=>`.
* Signature text uses comma-space between parameters.
* Example output format:

```text
(input: LoginRequest)=>Promise<LoginResult>
```

* Unit tests cover:

  * explicit parameter and return types,
  * inferred return type,
  * multiple parameters.
* `bun test` passes.
* `bun run build` passes.

---

# Task 8: Implement export detection helper

## Goal

Determine whether symbols and type declarations are exported.

## New File

Either:

```text
packages/ts-facts-core/src/text.ts
```

or:

```text
packages/ts-facts-core/src/exported.ts
```

If using a new file, add it to the source tree.

## Steps

1. Implement:

```ts
export function isNodeExported(node: ts.Node, checker?: ts.TypeChecker): boolean
```

2. Return `true` when the node has an `export` modifier.

3. Also return `true` when the node is exported through symbol export status, where practical.

4. For the MVP, direct export syntax must work for:

```ts
export function login() {}
export type LoginRequest = {};
export interface User {}
export enum UserRole {}
export class UserService {}
```

5. If a declaration has no direct export modifier and symbol export status is unclear, return `false`.

## Acceptance Criteria

* Directly exported functions return `true`.
* Directly exported classes return `true`.
* Directly exported type aliases return `true`.
* Directly exported interfaces return `true`.
* Directly exported enums return `true`.
* Non-exported declarations return `false`.
* Tests cover at least one exported and one non-exported declaration.
* `bun test` passes.
* `bun run build` passes.

---

# Task 9: Implement `loadProject.ts`

## Goal

Read a `tsconfig.json`, create a TypeScript `Program`, create a `TypeChecker`, and return source files to analyze.

## File

```text
packages/ts-facts-core/src/loadProject.ts
```

## Steps

1. Define an input type:

```ts
export interface LoadProjectOptions {
  tsconfigPath: string;
  rootDir?: string;
  exclude?: string[];
}
```

2. Define a result type:

```ts
export interface LoadedProject {
  rootDir: string;
  tsconfigPath: string;
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFiles: ts.SourceFile[];
}
```

3. Resolve `tsconfigPath` to an absolute path.
4. If `rootDir` is provided, resolve it to an absolute path.
5. If `rootDir` is not provided, use the directory containing the `tsconfig.json`.
6. Read the TypeScript config using:

```ts
ts.readConfigFile(...)
```

7. Parse it using:

```ts
ts.parseJsonConfigFileContent(...)
```

8. Create the program using:

```ts
ts.createProgram(...)
```

9. Get the checker using:

```ts
program.getTypeChecker()
```

10. Get source files from:

```ts
program.getSourceFiles()
```

11. Exclude files where:

```ts
sourceFile.isDeclarationFile === true
```

12. Exclude files outside the project root.
13. Exclude files matching the provided `exclude` patterns.
14. Sort source files by project-relative POSIX path.

## Acceptance Criteria

* Loading `fixtures/basic/tsconfig.json` returns a valid `program`.
* Loading `fixtures/basic/tsconfig.json` returns a valid `checker`.
* Returned source files include:

```text
src/users/login.ts
src/users/types.ts
```

* Returned source files do not include `.d.ts` files.
* Returned source files are sorted by project-relative path.
* Exclude pattern `**/login.ts` removes `src/users/login.ts`.
* `bun test` covers this behavior.
* `bun run build` passes.

---

# Task 10: Implement type declaration extraction

## Goal

Extract raw type-level declarations.

## File

```text
packages/ts-facts-core/src/extractTypeDeclarations.ts
```

## Steps

1. Define a function:

```ts
export function extractTypeDeclarations(args: {
  rootDir: string;
  sourceFiles: ts.SourceFile[];
}): TypeDeclarationFact[]
```

2. Walk every source file recursively.

3. When the node is `ts.TypeAliasDeclaration`, emit:

```text
declarationKind: "type_alias"
nodeKind: "TypeAliasDeclaration"
```

4. When the node is `ts.InterfaceDeclaration`, emit:

```text
declarationKind: "interface"
nodeKind: "InterfaceDeclaration"
```

5. When the node is `ts.EnumDeclaration`, emit:

```text
declarationKind: "enum"
nodeKind: "EnumDeclaration"
```

6. For each declaration:

   * set `name` from `node.name.text`,
   * set `text` from `node.getText(sourceFile)`,
   * set `exported` using the export helper,
   * create provenance with `kind: "ast_node"`,
   * build the stable key,
   * build the ID using prefix `typedecl`.

7. Return the array sorted by `stableKey`.

## Acceptance Criteria

* The basic fixture emits exactly three type declarations:

  * `LoginRequest`,
  * `LoginResult`,
  * `User`.
* `LoginRequest` has `declarationKind: "type_alias"`.
* `LoginResult` has `declarationKind: "type_alias"`.
* `User` has `declarationKind: "interface"`.
* Each type declaration includes raw source `text`.
* Each type declaration includes `id`.
* Each type declaration includes `stableKey`.
* Each type declaration includes AST provenance.
* Each type declaration’s `exported` value is `true`.
* Output is sorted by `stableKey`.
* `bun test` passes.
* `bun run build` passes.

---

# Task 11: Implement basic function symbol extraction

## Goal

Extract named function declarations as symbol facts.

## File

```text
packages/ts-facts-core/src/extractSymbols.ts
```

## Steps

1. Define:

```ts
export function extractSymbols(args: {
  rootDir: string;
  sourceFiles: ts.SourceFile[];
  checker: ts.TypeChecker;
}): SymbolFact[]
```

2. Walk every source file recursively.

3. Find `ts.FunctionDeclaration` nodes.

4. Only emit a symbol when:

```ts
node.name != null
```

5. For each named function declaration:

   * set `kind` to `"function"`,
   * set `name` to `node.name.text`,
   * set `qualifiedName` to the same value for now,
   * set `exported` using the export helper,
   * build `signatureText`,
   * extract parameter facts,
   * extract return type fact,
   * create AST provenance,
   * create stable key,
   * create ID using prefix `sym`.

6. For each parameter fact:

   * set `name`,
   * set `typeAnnotationText`,
   * set `checkerTypeText`,
   * set provenance with `kind: "type_checker"` using the parameter node.

7. For the return type fact:

   * set `typeAnnotationText`,
   * set `checkerTypeText`,
   * set provenance with `kind: "type_checker"` using the function node.

8. Return results sorted by `stableKey`.

## Acceptance Criteria

* The basic fixture emits a symbol for `login`.
* The basic fixture emits a symbol for `findUserByEmail`.
* `login.kind` is `"function"`.
* `findUserByEmail.kind` is `"function"`.
* `login.exported` is `true`.
* `findUserByEmail.exported` is `false`.
* `login.signatureText` is:

```text
(input: LoginRequest)=>Promise<LoginResult>
```

* `login.parameters[0].typeAnnotationText` is:

```text
LoginRequest
```

* `login.parameters[0].checkerTypeText` is present.
* `login.returnType.typeAnnotationText` is:

```text
Promise<LoginResult>
```

* `login.returnType.checkerTypeText` is present.
* Every function symbol has:

  * `id`,
  * `stableKey`,
  * `provenance`,
  * parameter provenance,
  * return type provenance.
* Output is sorted by `stableKey`.
* `bun test` passes.
* `bun run build` passes.

---

# Task 12: Add class, method, and constructor fixture

## Goal

Create a fixture that proves class-related symbol extraction works.

## Files

Create:

```text
fixtures/classes/tsconfig.json
fixtures/classes/src/UserService.ts
```

## Steps

1. Add a valid `tsconfig.json` similar to the basic fixture.

2. Add this source file:

```ts
export interface CreateUserInput {
  email: string;
}

export interface CreateUserResult {
  id: string;
  email: string;
}

export class UserService {
  constructor(private readonly prefix: string) {}

  createUser(input: CreateUserInput): CreateUserResult {
    return {
      id: `${this.prefix}-1`,
      email: input.email
    };
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase();
  }
}
```

## Acceptance Criteria

* Fixture compiles.
* Fixture contains:

  * one exported class,
  * one constructor,
  * one public method,
  * one private method,
  * two interfaces.
* `bun test` still passes.
* `bun run build` passes.

---

# Task 13: Extract class symbols

## Goal

Emit symbols for class declarations.

## File

```text
packages/ts-facts-core/src/extractSymbols.ts
```

## Steps

1. Extend the existing AST walk to find `ts.ClassDeclaration` nodes.
2. Only emit a class symbol when:

```ts
node.name != null
```

3. For each class declaration:

   * set `kind` to `"class"`,
   * set `name` to the class name,
   * set `qualifiedName` to the class name,
   * set `exported` using the export helper,
   * set `signatureText` to `null`,
   * set `parameters` to an empty array,
   * set `returnType` to `null`,
   * create AST provenance,
   * build stable key using the class stable key format,
   * create ID using prefix `sym`.

## Acceptance Criteria

* The classes fixture emits a class symbol named `UserService`.
* `UserService.kind` is `"class"`.
* `UserService.qualifiedName` is `"UserService"`.
* `UserService.exported` is `true`.
* `UserService.signatureText` is `null`.
* `UserService.parameters` is an empty array.
* `UserService.returnType` is `null`.
* `UserService` has AST provenance.
* `UserService.stableKey` follows:

```text
symbol:src/UserService.ts:class:UserService
```

* `bun test` passes.
* `bun run build` passes.

---

# Task 14: Extract method symbols

## Goal

Emit symbols for class methods.

## File

```text
packages/ts-facts-core/src/extractSymbols.ts
```

## Steps

1. While walking class declarations, inspect class members.
2. Find `ts.MethodDeclaration` nodes.
3. Only emit a method symbol when the method name is a simple identifier.

Supported:

```ts
createUser() {}
```

Not required for MVP:

```ts
["dynamicName"]() {}
```

4. Determine the containing class name.
5. For each method:

   * set `kind` to `"method"`,
   * set `name` to the method name,
   * set `qualifiedName` to:

```text
<ClassName>.<methodName>
```

6. For method `exported`, use `false`.

For the MVP, class export status does not make each method exported.

7. Build `signatureText`.
8. Extract parameter facts.
9. Extract return type fact.
10. Create AST provenance.
11. Create stable key.
12. Create ID using prefix `sym`.

## Acceptance Criteria

* The classes fixture emits a method symbol named `createUser`.
* The classes fixture emits a method symbol named `normalizeEmail`.
* `createUser.kind` is `"method"`.
* `createUser.qualifiedName` is:

```text
UserService.createUser
```

* `createUser.exported` is `false`.
* `createUser.signatureText` is:

```text
(input: CreateUserInput)=>CreateUserResult
```

* `createUser.parameters[0].typeAnnotationText` is:

```text
CreateUserInput
```

* `createUser.returnType.typeAnnotationText` is:

```text
CreateUserResult
```

* Every method symbol has:

  * `id`,
  * `stableKey`,
  * AST provenance,
  * parameter type provenance,
  * return type provenance.
* `bun test` passes.
* `bun run build` passes.

---

# Task 15: Extract constructor symbols

## Goal

Emit symbols for class constructors.

## File

```text
packages/ts-facts-core/src/extractSymbols.ts
```

## Steps

1. While walking class members, find `ts.ConstructorDeclaration` nodes.
2. Determine the containing class name.
3. For each constructor:

   * set `kind` to `"constructor"`,
   * set `name` to `"constructor"`,
   * set `qualifiedName` to:

```text
<ClassName>.constructor
```

4. Set `exported` to `false`.
5. Build `signatureText` from constructor parameters.
6. For the return type:

   * set `typeAnnotationText` to `null`,
   * set `checkerTypeText` to the containing class name if checker resolution is not straightforward.
7. Create parameter facts.
8. Create return type provenance using the constructor node.
9. Create AST provenance.
10. Create stable key.
11. Create ID using prefix `sym`.

## Acceptance Criteria

* The classes fixture emits one constructor symbol.
* Constructor symbol has `kind: "constructor"`.
* Constructor symbol has `name: "constructor"`.
* Constructor symbol has `qualifiedName: "UserService.constructor"`.
* Constructor symbol has a non-null `signatureText`.
* Constructor parameter `prefix` is captured.
* Constructor parameter type evidence is captured.
* Constructor has AST provenance.
* Constructor has return type provenance.
* `bun test` passes.
* `bun run build` passes.

---

# Task 16: Extract function-variable symbols

## Goal

Emit symbols for variables initialized with arrow functions or function expressions.

## New Fixture File

Add:

```text
fixtures/function-variables/tsconfig.json
fixtures/function-variables/src/actions.ts
```

## Fixture Content

```ts
export type ApproveInvoiceInput = {
  id: string;
};

export type ApproveInvoiceResult = {
  approved: boolean;
};

export const approveInvoice = (
  input: ApproveInvoiceInput
): ApproveInvoiceResult => {
  return { approved: true };
};

const rejectInvoice = function (
  input: ApproveInvoiceInput
): ApproveInvoiceResult {
  return { approved: false };
};
```

## Implementation Steps

1. In `extractSymbols.ts`, detect `ts.VariableDeclaration` nodes.

2. Only continue when `node.name` is an identifier.

3. Only emit a symbol when `node.initializer` is one of:

   * `ts.ArrowFunction`,
   * `ts.FunctionExpression`.

4. Use the variable name as:

   * `name`,
   * `qualifiedName`.

5. Set `kind` to `"function_variable"`.

6. Determine `exported` from the surrounding variable statement.

7. Build `signatureText` from the initializer’s parameters and return type.

8. Extract parameter facts from the initializer.

9. Extract return type fact from the initializer.

10. Use the variable declaration node for AST provenance.

11. Use the function initializer node for return type checker provenance.

12. Create stable key.

13. Create ID using prefix `sym`.

## Acceptance Criteria

* The fixture emits a symbol named `approveInvoice`.
* The fixture emits a symbol named `rejectInvoice`.
* Both symbols have `kind: "function_variable"`.
* `approveInvoice.exported` is `true`.
* `rejectInvoice.exported` is `false`.
* `approveInvoice.signatureText` is:

```text
(input: ApproveInvoiceInput)=>ApproveInvoiceResult
```

* Parameter and return type evidence are captured.
* Every function-variable symbol has:

  * `id`,
  * `stableKey`,
  * provenance,
  * parameter provenance,
  * return type provenance.
* `bun test` passes.
* `bun run build` passes.

---

# Task 17: Build a symbol index for call resolution

## Goal

Create lookup structures that let call extraction map TypeScript symbols back to extracted symbol facts.

## File

Either create:

```text
packages/ts-facts-core/src/symbolIndex.ts
```

or implement inside:

```text
packages/ts-facts-core/src/extractCalls.ts
```

A separate file is cleaner.

## Steps

1. Create a type:

```ts
export interface SymbolIndex {
  byDeclarationNode: Map<ts.Node, SymbolFact>;
  byTsSymbol: Map<ts.Symbol, SymbolFact>;
}
```

2. Create a function:

```ts
export function buildSymbolIndex(args: {
  symbols: SymbolFact[];
  sourceFiles: ts.SourceFile[];
  checker: ts.TypeChecker;
}): SymbolIndex
```

3. The extracted `SymbolFact` needs to be connectable to the original AST declaration.

Recommended simple approach:

* During symbol extraction, also return internal records containing:

  * the public `SymbolFact`,
  * the original declaration node.

Use an internal type such as:

```ts
export interface ExtractedSymbolInternal {
  fact: SymbolFact;
  declaration: ts.Node;
}
```

Then the public top-level output can use only `.fact`.

4. For each extracted symbol declaration:

   * add declaration node to `byDeclarationNode`,
   * call `checker.getSymbolAtLocation(...)` where a name node exists,
   * add the TypeScript symbol to `byTsSymbol`.

5. For methods and constructors, handle the method name or constructor declaration as well as TypeScript allows.

6. Keep this index internal. Do not emit it in JSON.

## Acceptance Criteria

* Extracted symbols can still be emitted exactly as before.
* The internal index maps the `login` function declaration to the emitted `login` symbol.
* The internal index maps the `findUserByEmail` declaration to the emitted `findUserByEmail` symbol.
* Unit tests prove that `findUserByEmail` can be resolved from a call expression in the basic fixture.
* No symbol index data appears in the final JSON output.
* `bun test` passes.
* `bun run build` passes.

---

# Task 18: Implement enclosing callable detection

## Goal

For each call expression, determine the nearest enclosing extracted callable symbol.

## File

```text
packages/ts-facts-core/src/extractCalls.ts
```

## Steps

1. Implement a helper:

```ts
function findEnclosingCallableSymbol(
  node: ts.Node,
  symbolIndex: SymbolIndex
): SymbolFact | null
```

2. Starting from the parent of the call node, walk upward through `.parent`.
3. Stop when an extracted callable declaration is found.

Callable symbol kinds are:

```text
function
method
constructor
function_variable
```

4. Do not use class symbols as `from`.
5. Return the matching `SymbolFact`.
6. If no callable symbol is found, return `null`.

## Acceptance Criteria

* The call `findUserByEmail(input.email)` inside `login` has `from` equal to the `login` symbol ID.
* A call at top level has `from: null`.
* Class symbols are never used as `from`.
* Method calls inside methods use the enclosing method symbol as `from`.
* Constructor calls inside constructors use the enclosing constructor symbol as `from`.
* `bun test` passes.
* `bun run build` passes.

---

# Task 19: Implement basic call extraction

## Goal

Emit call facts for `CallExpression` and `NewExpression`.

## File

```text
packages/ts-facts-core/src/extractCalls.ts
```

## Steps

1. Define:

```ts
export function extractCalls(args: {
  rootDir: string;
  sourceFiles: ts.SourceFile[];
  checker: ts.TypeChecker;
  symbolIndex: SymbolIndex;
}): CallFact[]
```

2. Walk every source file recursively.

3. Emit a call fact for every:

```ts
ts.CallExpression
ts.NewExpression
```

4. For each call-like node:

   * determine `from`,
   * set `to` to `null` for now,
   * set `expressionText` using `node.getText(sourceFile)`,
   * extract argument type facts,
   * extract return type fact,
   * create AST provenance,
   * create stable key,
   * create ID using prefix `call`.

5. For `CallExpression`, use `node.arguments`.

6. For `NewExpression`, use `node.arguments ?? []`.

7. For each argument:

   * set `expressionText`,
   * set `checkerTypeText`,
   * set provenance with `kind: "type_checker"` using the argument node.

8. For return type:

   * for `CallExpression`, use `checker.getResolvedSignature(node)`,
   * for `NewExpression`, use `checker.getResolvedSignature(node)`,
   * if a signature exists, use its return type,
   * if no signature exists, fall back to `checker.getTypeAtLocation(node)`,
   * use checker text as `checkerTypeText`,
   * create provenance with `kind: "type_checker"` using the call node.

9. Implement ordinal calculation:

   * If `from` is non-null, the ordinal is the lexical call-like expression index within that enclosing callable.
   * If `from` is null, the ordinal is the lexical call-like expression index among top-level call-like expressions in that source file.

10. Return calls sorted by `stableKey`.

## Acceptance Criteria

* The basic fixture emits a call for:

```text
findUserByEmail(input.email)
```

* The call has `from` equal to the `login` symbol ID.
* The call has `to: null` at this stage.
* The call has `expressionText` equal to:

```text
findUserByEmail(input.email)
```

* The call has one argument type fact.
* The argument type fact has:

  * `expressionText: "input.email"`,
  * non-empty `checkerTypeText`,
  * type checker provenance.
* The call has return type evidence with non-empty `checkerTypeText`.
* The call has AST provenance.
* The call has `id`.
* The call has `stableKey`.
* Output is sorted by `stableKey`.
* `bun test` passes.
* `bun run build` passes.

---

# Task 20: Resolve call targets to extracted symbols

## Goal

Populate the `to` field when TypeScript can resolve the call target to an extracted symbol.

## File

```text
packages/ts-facts-core/src/extractCalls.ts
```

## Steps

1. Implement:

```ts
function resolveCallTarget(args: {
  call: ts.CallExpression | ts.NewExpression;
  checker: ts.TypeChecker;
  symbolIndex: SymbolIndex;
}): SymbolFact | null
```

2. For `CallExpression`:

   * start from `call.expression`,
   * use `checker.getSymbolAtLocation(call.expression)` when possible.

3. For property access calls such as:

```ts
service.createUser(input)
```

also try:

```ts
checker.getSymbolAtLocation(call.expression.name)
```

4. For `NewExpression`:

   * start from `call.expression`,
   * use `checker.getSymbolAtLocation(call.expression)`.

5. If the TypeScript symbol maps to an extracted symbol in `symbolIndex.byTsSymbol`, return that symbol.

6. If no extracted target is found, return `null`.

7. Use the resolved target ID in:

   * `to`,
   * the call stable key.

## Acceptance Criteria

* In the basic fixture, `findUserByEmail(input.email)` has `to` equal to the `findUserByEmail` symbol ID.
* Calls to unknown or external functions have `to: null`.
* Dynamic calls like `service[actionName](input)` have `to: null`.
* `NewExpression` nodes are emitted and attempt target resolution.
* The call stable key includes the resolved `to` ID when known.
* The call stable key includes `null` when unresolved.
* `bun test` passes.
* `bun run build` passes.

---

# Task 21: Add fixtures for unresolved, top-level, and `new` calls

## Goal

Prove the call extractor handles important edge cases.

## Files

Create:

```text
fixtures/calls/tsconfig.json
fixtures/calls/src/index.ts
```

## Fixture Content

```ts
function bootstrap(): Promise<void> {
  return Promise.resolve();
}

function run(actionName: "start" | "stop", input: string) {
  const service = {
    start(value: string) {
      return value.length;
    },
    stop(value: string) {
      return value.toUpperCase();
    }
  };

  service[actionName](input);
}

class Worker {
  constructor(public readonly name: string) {}
}

bootstrap();
run("start", "abc");
new Worker("main");
```

## Acceptance Criteria

* The fixture emits a top-level call for `bootstrap()`.
* The top-level `bootstrap()` call has `from: null`.
* The top-level `bootstrap()` call has `to` equal to the `bootstrap` symbol ID.
* The dynamic call `service[actionName](input)` has `to: null`.
* The `new Worker("main")` expression is emitted into `calls`.
* The `new Worker("main")` expression has `from: null`.
* The `new Worker("main")` expression has argument type evidence.
* `bun test` passes.
* `bun run build` passes.

---

# Task 22: Implement deterministic JSON writer

## Goal

Sort all output arrays and write stable JSON.

## File

```text
packages/ts-facts-core/src/writeJson.ts
```

## Steps

1. Implement:

```ts
export function sortFactsFile(file: StaticFactsFile): StaticFactsFile
```

2. Sort:

```text
project.sourceFiles
symbols by stableKey
typeDeclarations by stableKey
calls by stableKey
```

3. Implement:

```ts
export async function writeJsonFile(outPath: string, data: StaticFactsFile): Promise<void>
```

4. Before writing, call `sortFactsFile`.
5. Serialize with:

```ts
JSON.stringify(data, null, 2)
```

6. Add one trailing newline.
7. Ensure the output directory exists before writing.

## Acceptance Criteria

* Output JSON is pretty-printed with two spaces.
* Output JSON ends with exactly one trailing newline.
* `symbols` are sorted by `stableKey`.
* `typeDeclarations` are sorted by `stableKey`.
* `calls` are sorted by `stableKey`.
* `project.sourceFiles` are sorted.
* Running the writer twice with the same input produces byte-identical output.
* `bun test` passes.
* `bun run build` passes.

---

# Task 23: Implement CLI argument parsing

## Goal

Expose the extractor through the `ts-facts` command using oclif.

## File

```text
apps/ts-facts/src/index.ts
```

## Steps

1. Parse these CLI arguments using oclif flags:

```text
--tsconfig <path>
--out <path>
--rootDir <path>
--exclude <pattern>
```

2. Make `--tsconfig` required.
3. Make `--out` optional with default:

```text
./ts-static-facts.json
```

4. Allow `--exclude` to be provided multiple times.
5. Use these default excludes when the user does not provide any:

```text
**/*.test.ts
**/*.spec.ts
**/__tests__/**
node_modules/**
dist/**
build/**
```

6. Run the pipeline in this order:

```text
loadProject
extractTypeDeclarations
extractSymbols
buildSymbolIndex
extractCalls
assemble StaticFactsFile
writeJsonFile
```

7. Build project metadata:

```ts
{
  name,
  root,
  tsconfig,
  sourceFiles
}
```

8. For `project.name`, use:

   * nearest `package.json` name if available,
   * otherwise the project root folder name.

9. For `project.root`, use the absolute root directory.

10. For `project.tsconfig`, use project-relative POSIX path when practical.

11. On success, print a short message:

```text
Wrote ts-static-facts.json
```

12. On failure:

* print the error message,
* exit with code `1`.

## Acceptance Criteria

* This command works:

```bash
bun run build
bun apps/ts-facts/dist/index.js --tsconfig fixtures/basic/tsconfig.json --out /tmp/ts-static-facts.json
```

* The output file exists.
* The output file is valid JSON.
* The output contains:

```json
{
  "schemaVersion": "0.1.0",
  "mode": "typescript_static_facts"
}
```

* The output contains non-empty:

  * `project.sourceFiles`,
  * `symbols`,
  * `typeDeclarations`,
  * `calls`.

* Running without `--tsconfig` exits with code `1`.

* Multiple `--exclude` values are accepted.

* `bun test` passes.

* `bun run build` passes.

---

# Task 24: Add end-to-end test for the basic fixture

## Goal

Verify the full MVP pipeline on the main example.

## File

Create:

```text
test/e2e-basic.test.ts
```

## Steps

1. Run the extractor against:

```text
fixtures/basic/tsconfig.json
```

2. Write output to a temporary file.
3. Parse the JSON.
4. Assert the top-level fields exist:

```text
schemaVersion
mode
project
symbols
typeDeclarations
calls
```

5. Assert project metadata includes:

```text
src/users/login.ts
src/users/types.ts
```

6. Assert symbols include:

   * `login`,
   * `findUserByEmail`.

7. Assert type declarations include:

   * `LoginRequest`,
   * `LoginResult`,
   * `User`.

8. Assert calls include:

   * `findUserByEmail(input.email)`.

9. Assert every emitted fact has:

   * `id`,
   * `stableKey`,
   * `provenance`.

10. Assert every provenance object has:

* `kind`,
* `file`,
* `nodeKind`,
* `start.line`,
* `start.column`,
* `end.line`,
* `end.column`.

## Acceptance Criteria

* The end-to-end test passes.
* No top-level output array is missing.
* Every emitted symbol has required provenance.
* Every emitted type declaration has required provenance.
* Every emitted call has required provenance.
* `bun test` passes.
* `bun run build` passes.

---

# Task 25: Add end-to-end test for class symbols

## Goal

Verify class, method, and constructor extraction through the full pipeline.

## File

Create:

```text
test/e2e-classes.test.ts
```

## Steps

1. Run the extractor against:

```text
fixtures/classes/tsconfig.json
```

2. Parse the output JSON.

3. Assert symbols include:

   * `UserService`,
   * `UserService.constructor`,
   * `UserService.createUser`,
   * `UserService.normalizeEmail`.

4. Assert the class symbol has:

```json
{
  "kind": "class",
  "signatureText": null,
  "parameters": [],
  "returnType": null
}
```

5. Assert the method symbol has:

   * `kind: "method"`,
   * parameter evidence,
   * return type evidence.

6. Assert the constructor symbol has:

   * `kind: "constructor"`,
   * parameter evidence,
   * return type evidence.

## Acceptance Criteria

* Class symbol extraction is tested end-to-end.
* Method symbol extraction is tested end-to-end.
* Constructor symbol extraction is tested end-to-end.
* Class symbols are not used as call `from` values.
* `bun test` passes.
* `bun run build` passes.

---

# Task 26: Add end-to-end test for function-variable symbols

## Goal

Verify arrow-function and function-expression variable extraction.

## File

Create:

```text
test/e2e-function-variables.test.ts
```

## Steps

1. Run the extractor against:

```text
fixtures/function-variables/tsconfig.json
```

2. Parse the output JSON.

3. Assert symbols include:

   * `approveInvoice`,
   * `rejectInvoice`.

4. Assert both have:

```text
kind: function_variable
```

5. Assert `approveInvoice.exported` is `true`.
6. Assert `rejectInvoice.exported` is `false`.
7. Assert both symbols have:

   * parameter type evidence,
   * return type evidence,
   * provenance.

## Acceptance Criteria

* Arrow-function variable extraction is tested.
* Function-expression variable extraction is tested.
* Export detection for function variables is tested.
* Type evidence for function variables is tested.
* `bun test` passes.
* `bun run build` passes.

---

# Task 27: Add end-to-end test for calls

## Goal

Verify call extraction, caller resolution, callee resolution, unresolved calls, top-level calls, and `new` expressions.

## File

Create:

```text
test/e2e-calls.test.ts
```

## Steps

1. Run the extractor against:

```text
fixtures/calls/tsconfig.json
```

2. Parse the output JSON.

3. Assert calls include:

   * `bootstrap()`,
   * `run("start", "abc")`,
   * `service[actionName](input)`,
   * `new Worker("main")`.

4. Assert `bootstrap()` has:

   * `from: null`,
   * `to` equal to the `bootstrap` symbol ID.

5. Assert `service[actionName](input)` has:

   * `to: null`.

6. Assert `new Worker("main")` has:

   * `from: null`,
   * argument type evidence,
   * return type evidence.

7. Assert each call has:

   * `expressionText`,
   * `argumentTypes`,
   * `returnType`,
   * `provenance`.

## Acceptance Criteria

* Top-level call behavior is tested.
* Unknown target behavior is tested.
* Resolved target behavior is tested.
* `NewExpression` behavior is tested.
* Call argument checker type text is tested.
* Call return checker type text is tested.
* `bun test` passes.
* `bun run build` passes.

---

# Task 28: Add deterministic output test

## Goal

Prove the same project produces byte-identical output across repeated runs.

## File

Create:

```text
test/determinism.test.ts
```

## Steps

1. Run the extractor against `fixtures/basic/tsconfig.json`.
2. Write output to temp file A.
3. Run the extractor again against the same fixture.
4. Write output to temp file B.
5. Read both files as strings.
6. Assert the strings are exactly equal.

## Acceptance Criteria

* Repeated runs produce byte-identical JSON.
* Array sorting is verified indirectly.
* Stable ID generation is verified indirectly.
* No output ordering depends on filesystem traversal order.
* `bun test` passes.
* `bun run build` passes.

---

# Task 29: Add schema completeness test

## Goal

Verify every required MVP field exists in the final JSON.

## File

Create:

```text
test/schema-completeness.test.ts
```

## Steps

1. Run the extractor against all fixtures.
2. For every symbol, assert these fields exist:

```text
id
stableKey
kind
name
qualifiedName
exported
signatureText
parameters
returnType
provenance
```

3. For every symbol parameter, assert:

```text
name
typeAnnotationText
checkerTypeText
provenance
```

4. For every symbol return type, assert:

```text
typeAnnotationText
checkerTypeText
provenance
```

5. For every type declaration, assert:

```text
id
stableKey
name
declarationKind
exported
text
provenance
```

6. For every call, assert:

```text
id
stableKey
from
to
expressionText
argumentTypes
returnType
provenance
```

7. For every call argument type, assert:

```text
expressionText
checkerTypeText
provenance
```

8. For every call return type, assert:

```text
checkerTypeText
provenance
```

9. Assert nullable fields are present as `null`, not missing.

## Acceptance Criteria

* No required MVP field is missing.

* Nullable fields are explicitly present.

* Every provenance object has one-based line and column numbers.

* Every emitted fact has an ID with the correct prefix:

  * `sym_`,
  * `typedecl_`,
  * `call_`.

* `bun test` passes.

* `bun run build` passes.

---

# Task 30: Add README usage documentation

## Goal

Document how to install, run, and understand the MVP output.

## File

```text
README.md
```

## Steps

1. Add a short description:

```text
TypeScript Static Fact Extractor emits deterministic JSON facts from a TypeScript project.
```

2. Document the CLI:

```bash
ts-facts --tsconfig ./tsconfig.json --out ./ts-static-facts.json
```

3. Document repeated exclude flags:

```bash
ts-facts \
  --tsconfig ./tsconfig.json \
  --out ./ts-static-facts.json \
  --exclude "**/*.test.ts" \
  --exclude "dist/**"
```

4. Document the top-level output shape:

```json
{
  "schemaVersion": "0.1.0",
  "mode": "typescript_static_facts",
  "project": {},
  "symbols": [],
  "typeDeclarations": [],
  "calls": []
}
```

5. Document what the MVP extracts:

   * named functions,
   * classes,
   * methods,
   * constructors,
   * function variables,
   * type aliases,
   * interfaces,
   * enums,
   * call expressions,
   * new expressions.

6. Document what the MVP does not guarantee:

   * perfect dynamic call resolution,
   * runtime behavior,
   * semantic business meaning,
   * analysis of generated files unless included by tsconfig.

## Acceptance Criteria

* README contains the install/build/test commands using Bun.
* README contains the CLI usage examples.
* README contains the top-level JSON shape.
* README lists extracted fact categories.
* README clearly states this is a static fact extractor, not a runtime analyzer.
* `bun run build` passes.
* `bun test` passes.

---

# Task 31: Final MVP acceptance audit

## Goal

Verify the implementation satisfies the original MVP acceptance criteria.

## Steps

1. Run:

```bash
bun run build
bun test
```

2. Run the CLI manually:

```bash
bun apps/ts-facts/dist/index.js \
  --tsconfig fixtures/basic/tsconfig.json \
  --out /tmp/ts-static-facts.json
```

3. Open `/tmp/ts-static-facts.json`.
4. Confirm the top-level JSON shape is:

```json
{
  "schemaVersion": "0.1.0",
  "mode": "typescript_static_facts",
  "project": {},
  "symbols": [],
  "typeDeclarations": [],
  "calls": []
}
```

5. Confirm the output includes project metadata.

6. Confirm the output includes extracted symbols.

7. Confirm the output includes raw type declarations.

8. Confirm the output includes calls.

9. Confirm known calls have `from` and `to` IDs where resolvable.

10. Confirm unresolved calls use `null`.

11. Confirm top-level calls use `from: null`.

12. Confirm all emitted facts have stable IDs.

13. Confirm all emitted facts have stable keys.

14. Confirm all emitted facts have provenance.

15. Confirm type evidence appears in:

    * symbol parameters,
    * symbol return types,
    * call arguments,
    * call return types.

16. Run the CLI twice and compare output:

```bash
bun apps/ts-facts/dist/index.js \
  --tsconfig fixtures/basic/tsconfig.json \
  --out /tmp/ts-static-facts-a.json

bun apps/ts-facts/dist/index.js \
  --tsconfig fixtures/basic/tsconfig.json \
  --out /tmp/ts-static-facts-b.json

diff /tmp/ts-static-facts-a.json /tmp/ts-static-facts-b.json
```

## Acceptance Criteria

The MVP is complete only when all of the following are true:

* `bun run build` passes.
* `bun test` passes.
* The CLI can analyze a TypeScript project.
* The CLI writes a valid JSON file.
* The JSON contains project metadata.
* The JSON contains callable and class symbols.
* The JSON contains raw type declarations.
* The JSON contains call-like expressions.
* Resolvable callers are linked by symbol ID.
* Resolvable callees are linked by symbol ID.
* Unresolved callers or callees are represented as `null`.
* Raw call expression text is preserved.
* Raw type declaration text is preserved.
* Function and method parameter annotation text is preserved.
* Function and method parameter checker type text is preserved.
* Function and method return annotation text is preserved.
* Function and method return checker type text is preserved.
* Call argument checker type text is preserved.
* Call return checker type text is preserved.
* Every symbol has a stable ID.
* Every type declaration has a stable ID.
* Every call has a stable ID.
* Every symbol has provenance.
* Every type declaration has provenance.
* Every call has provenance.
* Every parameter type observation has provenance.
* Every return type observation has provenance.
* Every call argument type observation has provenance.
* Output arrays are sorted deterministically.
* Running the extractor twice on the same input produces byte-identical output.

---

# Recommended Milestone Grouping

For planning, group the tasks like this:

```text
Milestone 1: Monorepo project foundation
Tasks 1-9

Milestone 2: Type declarations and function symbols
Tasks 10-11

Milestone 3: Classes, methods, constructors, function variables
Tasks 12-16

Milestone 4: Calls and symbol resolution
Tasks 17-21

Milestone 5: Output, oclif CLI, and full validation
Tasks 22-31
```
