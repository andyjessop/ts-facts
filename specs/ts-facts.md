# MVP Specification: TypeScript Static Fact Extractor

**Version:** 0.1.0
**Status:** MVP / proof of concept
**Primary artifact:** JSON static fact file
**Purpose:** Extract minimal, provenance-rich facts from a TypeScript codebase.

---

# 1. Summary

This MVP reads a TypeScript project and emits a deterministic JSON file containing three categories of facts:

```text
symbols
typeDeclarations
calls
```

The extractor uses:

```text
TypeScript AST
TypeScript TypeChecker
source locations
raw source text
checker-rendered type text
stable IDs
provenance
```

The output is designed as a low-level factual substrate. Further analysis can be performed later using this artifact.

---

# 2. Core Principle

The extractor captures directly observable static facts.

A fact should be emitted when it comes directly from one of:

```text
AST node
TypeChecker observation
source location
symbol resolution
call expression
type declaration
```

Every fact must preserve where it came from.

---

# 3. Inputs

Minimum input:

```json
{
  "tsconfigPath": "./tsconfig.json"
}
```

Optional input:

```json
{
  "tsconfigPath": "./tsconfig.json",
  "rootDir": ".",
  "out": "./ts-static-facts.json",
  "exclude": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/__tests__/**",
    "node_modules/**",
    "dist/**",
    "build/**"
  ]
}
```

---

# 4. CLI

Minimum CLI:

```bash
ts-facts --tsconfig ./tsconfig.json --out ./ts-static-facts.json
```

Optional exclude usage:

```bash
ts-facts \
  --tsconfig ./tsconfig.json \
  --out ./ts-static-facts.json \
  --exclude "**/*.test.ts" \
  --exclude "dist/**"
```

---

# 5. Output File

Suggested output filename:

```text
ts-static-facts.json
```

Top-level JSON shape:

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

---

# 6. Project Metadata

Project metadata records the analyzed project context.

```json
{
  "project": {
    "name": "example",
    "root": "/repo",
    "tsconfig": "./tsconfig.json",
    "sourceFiles": [
      "src/users/login.ts",
      "src/users/types.ts"
    ]
  }
}
```

All file paths in output should be project-relative where practical.

Use POSIX-style path separators:

```text
src/users/login.ts
```

---

# 7. Stable IDs

Each emitted record must have:

```text
id
stableKey
```

The `stableKey` should be human-readable and deterministic.

The `id` should be generated from the `stableKey`.

Recommended ID algorithm:

```text
sha256(stableKey), truncated to 8–12 characters
```

Recommended prefixes:

```text
sym_
typedecl_
call_
```

Example:

```json
{
  "id": "sym_8f12a91c",
  "stableKey": "symbol:src/users/login.ts:function:login:(input: LoginRequest)=>Promise<LoginResult>"
}
```

---

# 8. Provenance

Every emitted record must include provenance.

Provenance identifies the source file, AST node kind, and source range that produced the fact.

## 8.1 Provenance Schema

```json
{
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/login.ts",
    "nodeKind": "FunctionDeclaration",
    "start": {
      "line": 8,
      "column": 1
    },
    "end": {
      "line": 20,
      "column": 2
    }
  }
}
```

For checker-derived type observations, use the node where the observation was made:

```json
{
  "provenance": {
    "kind": "type_checker",
    "file": "src/users/login.ts",
    "nodeKind": "Parameter",
    "start": {
      "line": 8,
      "column": 29
    },
    "end": {
      "line": 8,
      "column": 48
    }
  }
}
```

Line and column values should be one-based.

---

# 9. Symbols

A symbol is a named code entity that can participate in call relationships or provide useful static structure.

## 9.1 MVP Symbol Kinds

```text
function
method
constructor
class
function_variable
```

## 9.2 Symbol Extraction Rules

Extract symbols from:

```text
named function declarations
class declarations
class methods
class constructors
variable declarations initialized with arrow functions
variable declarations initialized with function expressions
```

Examples:

```ts
function login(input: LoginRequest): Promise<LoginResult> {}
```

```ts
class UserService {
  createUser(input: CreateUserInput): CreateUserResult {}
}
```

```ts
const approveInvoice = (input: ApproveInvoiceInput): ApproveInvoiceResult => {};
```

## 9.3 Symbol Schema

```json
{
  "id": "sym_8f12a91c",
  "stableKey": "symbol:src/users/login.ts:function:login:(input: LoginRequest)=>Promise<LoginResult>",
  "kind": "function",
  "name": "login",
  "qualifiedName": "login",
  "exported": true,
  "signatureText": "(input: LoginRequest)=>Promise<LoginResult>",
  "parameters": [
    {
      "name": "input",
      "typeAnnotationText": "LoginRequest",
      "checkerTypeText": "LoginRequest",
      "provenance": {
        "kind": "type_checker",
        "file": "src/users/login.ts",
        "nodeKind": "Parameter",
        "start": {
          "line": 8,
          "column": 29
        },
        "end": {
          "line": 8,
          "column": 48
        }
      }
    }
  ],
  "returnType": {
    "typeAnnotationText": "Promise<LoginResult>",
    "checkerTypeText": "Promise<LoginResult>",
    "provenance": {
      "kind": "type_checker",
      "file": "src/users/login.ts",
      "nodeKind": "FunctionDeclaration",
      "start": {
        "line": 8,
        "column": 1
      },
      "end": {
        "line": 20,
        "column": 2
      }
    }
  },
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/login.ts",
    "nodeKind": "FunctionDeclaration",
    "start": {
      "line": 8,
      "column": 1
    },
    "end": {
      "line": 20,
      "column": 2
    }
  }
}
```

## 9.4 Class Symbol Example

```json
{
  "id": "sym_c4b912ad",
  "stableKey": "symbol:src/users/UserService.ts:class:UserService",
  "kind": "class",
  "name": "UserService",
  "qualifiedName": "UserService",
  "exported": true,
  "signatureText": null,
  "parameters": [],
  "returnType": null,
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/UserService.ts",
    "nodeKind": "ClassDeclaration",
    "start": {
      "line": 1,
      "column": 1
    },
    "end": {
      "line": 20,
      "column": 2
    }
  }
}
```

## 9.5 Method Symbol Example

```json
{
  "id": "sym_a92155ef",
  "stableKey": "symbol:src/users/UserService.ts:method:UserService.createUser:(input: CreateUserInput)=>CreateUserResult",
  "kind": "method",
  "name": "createUser",
  "qualifiedName": "UserService.createUser",
  "exported": false,
  "signatureText": "(input: CreateUserInput)=>CreateUserResult",
  "parameters": [
    {
      "name": "input",
      "typeAnnotationText": "CreateUserInput",
      "checkerTypeText": "CreateUserInput",
      "provenance": {
        "kind": "type_checker",
        "file": "src/users/UserService.ts",
        "nodeKind": "Parameter",
        "start": {
          "line": 4,
          "column": 14
        },
        "end": {
          "line": 4,
          "column": 36
        }
      }
    }
  ],
  "returnType": {
    "typeAnnotationText": "CreateUserResult",
    "checkerTypeText": "CreateUserResult",
    "provenance": {
      "kind": "type_checker",
      "file": "src/users/UserService.ts",
      "nodeKind": "MethodDeclaration",
      "start": {
        "line": 4,
        "column": 3
      },
      "end": {
        "line": 8,
        "column": 4
      }
    }
  },
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/UserService.ts",
    "nodeKind": "MethodDeclaration",
    "start": {
      "line": 4,
      "column": 3
    },
    "end": {
      "line": 8,
      "column": 4
    }
  }
}
```

---

# 10. Type Declarations

A type declaration preserves raw type-level source declarations.

## 10.1 MVP Type Declaration Kinds

```text
type_alias
interface
enum
```

## 10.2 Type Declaration Extraction Rules

Extract type declarations from:

```text
TypeAliasDeclaration
InterfaceDeclaration
EnumDeclaration
```

Capture the raw source text of the declaration.

## 10.3 Type Declaration Schema

```json
{
  "id": "typedecl_1dce72af",
  "stableKey": "type-decl:src/users/types.ts:type_alias:LoginRequest:textHash_abc123",
  "name": "LoginRequest",
  "declarationKind": "type_alias",
  "exported": true,
  "text": "export type LoginRequest = {\n  email: string;\n  password: string;\n};",
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/types.ts",
    "nodeKind": "TypeAliasDeclaration",
    "start": {
      "line": 1,
      "column": 1
    },
    "end": {
      "line": 4,
      "column": 2
    }
  }
}
```

## 10.4 Interface Example

```json
{
  "id": "typedecl_f9a0182c",
  "stableKey": "type-decl:src/users/types.ts:interface:User:textHash_def456",
  "name": "User",
  "declarationKind": "interface",
  "exported": true,
  "text": "export interface User {\n  id: UserId;\n  email: string;\n}",
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/types.ts",
    "nodeKind": "InterfaceDeclaration",
    "start": {
      "line": 6,
      "column": 1
    },
    "end": {
      "line": 9,
      "column": 2
    }
  }
}
```

## 10.5 Enum Example

```json
{
  "id": "typedecl_31ba45e9",
  "stableKey": "type-decl:src/users/types.ts:enum:UserRole:textHash_8812ac",
  "name": "UserRole",
  "declarationKind": "enum",
  "exported": true,
  "text": "export enum UserRole {\n  Admin = \"admin\",\n  Member = \"member\"\n}",
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/types.ts",
    "nodeKind": "EnumDeclaration",
    "start": {
      "line": 11,
      "column": 1
    },
    "end": {
      "line": 14,
      "column": 2
    }
  }
}
```

---

# 11. Calls

A call records a call-like expression and the best static symbol resolution available from TypeScript.

## 11.1 MVP Call Node Kinds

Extract from:

```text
CallExpression
NewExpression
```

Both are emitted into the `calls` array.

## 11.2 Call Resolution

For each call:

```text
from = nearest enclosing extracted callable symbol, or null
to = resolved extracted callable symbol, or null
```

The `from` field identifies the enclosing function, method, constructor, or function variable.

The `to` field identifies the resolved callable target when that target is part of the analyzed project and maps to an extracted symbol.

## 11.3 Call Schema

```json
{
  "id": "call_44b2af9e",
  "stableKey": "call:sym_loginController:sym_login:src/users/controller.ts:exprHash_8123:ordinal_3",
  "from": "sym_loginController",
  "to": "sym_login",
  "expressionText": "login(input)",
  "argumentTypes": [
    {
      "expressionText": "input",
      "checkerTypeText": "LoginRequest",
      "provenance": {
        "kind": "type_checker",
        "file": "src/users/controller.ts",
        "nodeKind": "Identifier",
        "start": {
          "line": 34,
          "column": 16
        },
        "end": {
          "line": 34,
          "column": 21
        }
      }
    }
  ],
  "returnType": {
    "checkerTypeText": "Promise<LoginResult>",
    "provenance": {
      "kind": "type_checker",
      "file": "src/users/controller.ts",
      "nodeKind": "CallExpression",
      "start": {
        "line": 34,
        "column": 10
      },
      "end": {
        "line": 34,
        "column": 22
      }
    }
  },
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/controller.ts",
    "nodeKind": "CallExpression",
    "start": {
      "line": 34,
      "column": 10
    },
    "end": {
      "line": 34,
      "column": 22
    }
  }
}
```

## 11.4 Call With Unknown Target

```json
{
  "id": "call_456",
  "stableKey": "call:sym_loginController:null:src/users/controller.ts:exprHash_7621:ordinal_4",
  "from": "sym_loginController",
  "to": null,
  "expressionText": "service[actionName](input)",
  "argumentTypes": [
    {
      "expressionText": "input",
      "checkerTypeText": "LoginRequest",
      "provenance": {
        "kind": "type_checker",
        "file": "src/users/controller.ts",
        "nodeKind": "Identifier",
        "start": {
          "line": 41,
          "column": 23
        },
        "end": {
          "line": 41,
          "column": 28
        }
      }
    }
  ],
  "returnType": {
    "checkerTypeText": "unknown",
    "provenance": {
      "kind": "type_checker",
      "file": "src/users/controller.ts",
      "nodeKind": "CallExpression",
      "start": {
        "line": 41,
        "column": 10
      },
      "end": {
        "line": 41,
        "column": 29
      }
    }
  },
  "provenance": {
    "kind": "ast_node",
    "file": "src/users/controller.ts",
    "nodeKind": "CallExpression",
    "start": {
      "line": 41,
      "column": 10
    },
    "end": {
      "line": 41,
      "column": 29
    }
  }
}
```

## 11.5 Top-Level Call

A call outside an extracted callable symbol has `from: null`.

```json
{
  "id": "call_789",
  "stableKey": "call:null:sym_bootstrap:src/index.ts:exprHash_9911:ordinal_1",
  "from": null,
  "to": "sym_bootstrap",
  "expressionText": "bootstrap()",
  "argumentTypes": [],
  "returnType": {
    "checkerTypeText": "Promise<void>",
    "provenance": {
      "kind": "type_checker",
      "file": "src/index.ts",
      "nodeKind": "CallExpression",
      "start": {
        "line": 3,
        "column": 1
      },
      "end": {
        "line": 3,
        "column": 12
      }
    }
  },
  "provenance": {
    "kind": "ast_node",
    "file": "src/index.ts",
    "nodeKind": "CallExpression",
    "start": {
      "line": 3,
      "column": 1
    },
    "end": {
      "line": 3,
      "column": 12
    }
  }
}
```

---

# 12. Raw Type Evidence

The extractor preserves type evidence in three places.

## 12.1 Type Declarations

Raw source declaration text:

```json
{
  "name": "LoginRequest",
  "declarationKind": "type_alias",
  "text": "export type LoginRequest = {\n  email: string;\n  password: string;\n};"
}
```

## 12.2 Symbol Type Evidence

Parameter and return type evidence:

```json
{
  "parameters": [
    {
      "name": "input",
      "typeAnnotationText": "LoginRequest",
      "checkerTypeText": "LoginRequest"
    }
  ],
  "returnType": {
    "typeAnnotationText": "Promise<LoginResult>",
    "checkerTypeText": "Promise<LoginResult>"
  }
}
```

## 12.3 Call Type Evidence

Argument and return type evidence at call sites:

```json
{
  "argumentTypes": [
    {
      "expressionText": "input",
      "checkerTypeText": "LoginRequest"
    }
  ],
  "returnType": {
    "checkerTypeText": "Promise<LoginResult>"
  }
}
```

---

# 13. Type Text Rules

## 13.1 Type Annotation Text

`typeAnnotationText` is the explicit source annotation when one exists.

Example:

```ts
function login(input: LoginRequest): Promise<LoginResult> {}
```

Produces:

```json
{
  "typeAnnotationText": "LoginRequest"
}
```

and:

```json
{
  "typeAnnotationText": "Promise<LoginResult>"
}
```

For inferred values:

```json
{
  "typeAnnotationText": null
}
```

## 13.2 Checker Type Text

`checkerTypeText` is produced using the TypeScript TypeChecker.

Typical API:

```ts
const type = checker.getTypeAtLocation(node);
const text = checker.typeToString(type);
```

For function returns:

```ts
const signature = checker.getSignatureFromDeclaration(node);
const returnType = checker.getReturnTypeOfSignature(signature);
const text = checker.typeToString(returnType);
```

For call returns:

```ts
const signature = checker.getResolvedSignature(callExpression);
const returnType = checker.getReturnTypeOfSignature(signature);
const text = checker.typeToString(returnType);
```

---

# 14. Export Detection

For symbols and type declarations, record whether the declaration is exported.

```json
{
  "exported": true
}
```

This should reflect direct TypeScript export syntax or symbol export status.

Examples:

```ts
export function login() {}
```

```ts
export type LoginRequest = {};
```

```ts
export class UserService {}
```

---

# 15. Text Normalization

Text fields should be useful for human inspection and stable enough for comparison.

## 15.1 Source Text

For `typeDeclarations.text`, preserve source text from the AST node.

Typical API:

```ts
node.getText(sourceFile)
```

## 15.2 Signature Text

For `signatureText`, use a deterministic compact format.

Example:

```text
(input: LoginRequest)=>Promise<LoginResult>
```

## 15.3 Expression Text

For `calls.expressionText`, preserve the call expression source text.

Example:

```text
service[actionName](input)
```

---

# 16. Stable Key Construction

## 16.1 Symbol Stable Key

Format:

```text
symbol:<file>:<kind>:<qualifiedName>:<signatureText>
```

Example:

```text
symbol:src/users/login.ts:function:login:(input: LoginRequest)=>Promise<LoginResult>
```

For class symbols:

```text
symbol:src/users/UserService.ts:class:UserService
```

## 16.2 Type Declaration Stable Key

Format:

```text
type-decl:<file>:<declarationKind>:<name>:textHash_<hash>
```

Example:

```text
type-decl:src/users/types.ts:type_alias:LoginRequest:textHash_abc123
```

`textHash` should be generated from the declaration text.

## 16.3 Call Stable Key

Format:

```text
call:<from|null>:<to|null>:<file>:exprHash_<hash>:ordinal_<number>
```

Example:

```text
call:sym_loginController:sym_login:src/users/controller.ts:exprHash_8123:ordinal_3
```

The ordinal is the lexical call-like expression index within the enclosing callable symbol. For top-level calls, use the lexical index within the source file.

---

# 17. Deterministic Output

The same source input should produce equivalent output across repeated runs.

Implementation requirements:

```text
sort source files by project-relative path
sort symbols by stableKey
sort typeDeclarations by stableKey
sort calls by stableKey
use project-relative paths
use deterministic ID hashing
use stable text normalization
```

---

# 18. Null Values

Use `null` when a directly captured fact is unavailable.

Examples:

```json
{
  "from": null
}
```

```json
{
  "to": null
}
```

```json
{
  "typeAnnotationText": null
}
```

```json
{
  "returnType": null
}
```

This keeps the schema explicit and easy to consume.

---

# 19. Implementation Architecture

Recommended minimal source structure:

```text
src/
  index.ts
  loadProject.ts
  ids.ts
  provenance.ts
  text.ts
  extractSymbols.ts
  extractTypeDeclarations.ts
  extractCalls.ts
  writeJson.ts
```

## 19.1 `loadProject.ts`

Responsibilities:

```text
read tsconfig
create TypeScript Program
create TypeChecker
return included SourceFiles
```

Typical APIs:

```ts
ts.readConfigFile(...)
ts.parseJsonConfigFileContent(...)
ts.createProgram(...)
program.getTypeChecker()
```

## 19.2 `ids.ts`

Responsibilities:

```text
build stable keys
hash stable keys
apply ID prefixes
```

## 19.3 `provenance.ts`

Responsibilities:

```text
convert AST node source ranges to one-based line/column ranges
produce provenance objects
normalize project-relative file paths
```

Typical APIs:

```ts
sourceFile.getLineAndCharacterOfPosition(...)
node.getStart(sourceFile)
node.getEnd()
```

## 19.4 `extractSymbols.ts`

Responsibilities:

```text
walk AST
extract named callable symbols
extract class symbols
extract signatures
extract parameter type evidence
extract return type evidence
record provenance
```

## 19.5 `extractTypeDeclarations.ts`

Responsibilities:

```text
extract type aliases
extract interfaces
extract enums
preserve declaration text
record provenance
```

## 19.6 `extractCalls.ts`

Responsibilities:

```text
walk AST
extract CallExpression nodes
extract NewExpression nodes
resolve enclosing callable symbol
resolve callee symbol when available
extract argument checker type text
extract return checker type text
record expression text
record provenance
```

## 19.7 `writeJson.ts`

Responsibilities:

```text
sort output deterministically
serialize JSON
write file
```

---

# 20. Example Input

```ts
// src/users/types.ts

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

```ts
// src/users/login.ts

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

---

# 21. Example Output

```json
{
  "schemaVersion": "0.1.0",
  "mode": "typescript_static_facts",
  "project": {
    "name": "example",
    "root": "/repo",
    "tsconfig": "./tsconfig.json",
    "sourceFiles": [
      "src/users/login.ts",
      "src/users/types.ts"
    ]
  },
  "symbols": [
    {
      "id": "sym_0f3a92bc",
      "stableKey": "symbol:src/users/login.ts:function:findUserByEmail:(email: string)=>Promise<any>",
      "kind": "function",
      "name": "findUserByEmail",
      "qualifiedName": "findUserByEmail",
      "exported": false,
      "signatureText": "(email: string)=>Promise<any>",
      "parameters": [
        {
          "name": "email",
          "typeAnnotationText": "string",
          "checkerTypeText": "string",
          "provenance": {
            "kind": "type_checker",
            "file": "src/users/login.ts",
            "nodeKind": "Parameter",
            "start": {
              "line": 18,
              "column": 32
            },
            "end": {
              "line": 18,
              "column": 45
            }
          }
        }
      ],
      "returnType": {
        "typeAnnotationText": null,
        "checkerTypeText": "Promise<any>",
        "provenance": {
          "kind": "type_checker",
          "file": "src/users/login.ts",
          "nodeKind": "FunctionDeclaration",
          "start": {
            "line": 18,
            "column": 1
          },
          "end": {
            "line": 20,
            "column": 2
          }
        }
      },
      "provenance": {
        "kind": "ast_node",
        "file": "src/users/login.ts",
        "nodeKind": "FunctionDeclaration",
        "start": {
          "line": 18,
          "column": 1
        },
        "end": {
          "line": 20,
          "column": 2
        }
      }
    },
    {
      "id": "sym_8f12a91c",
      "stableKey": "symbol:src/users/login.ts:function:login:(input: LoginRequest)=>Promise<LoginResult>",
      "kind": "function",
      "name": "login",
      "qualifiedName": "login",
      "exported": true,
      "signatureText": "(input: LoginRequest)=>Promise<LoginResult>",
      "parameters": [
        {
          "name": "input",
          "typeAnnotationText": "LoginRequest",
          "checkerTypeText": "LoginRequest",
          "provenance": {
            "kind": "type_checker",
            "file": "src/users/login.ts",
            "nodeKind": "Parameter",
            "start": {
              "line": 5,
              "column": 29
            },
            "end": {
              "line": 5,
              "column": 48
            }
          }
        }
      ],
      "returnType": {
        "typeAnnotationText": "Promise<LoginResult>",
        "checkerTypeText": "Promise<LoginResult>",
        "provenance": {
          "kind": "type_checker",
          "file": "src/users/login.ts",
          "nodeKind": "FunctionDeclaration",
          "start": {
            "line": 5,
            "column": 1
          },
          "end": {
            "line": 16,
            "column": 2
          }
        }
      },
      "provenance": {
        "kind": "ast_node",
        "file": "src/users/login.ts",
        "nodeKind": "FunctionDeclaration",
        "start": {
          "line": 5,
          "column": 1
        },
        "end": {
          "line": 16,
          "column": 2
        }
      }
    }
  ],
  "typeDeclarations": [
    {
      "id": "typedecl_1dce72af",
      "stableKey": "type-decl:src/users/types.ts:type_alias:LoginRequest:textHash_abc123",
      "name": "LoginRequest",
      "declarationKind": "type_alias",
      "exported": true,
      "text": "export type LoginRequest = {\n  email: string;\n  password: string;\n};",
      "provenance": {
        "kind": "ast_node",
        "file": "src/users/types.ts",
        "nodeKind": "TypeAliasDeclaration",
        "start": {
          "line": 3,
          "column": 1
        },
        "end": {
          "line": 6,
          "column": 2
        }
      }
    },
    {
      "id": "typedecl_2f21c083",
      "stableKey": "type-decl:src/users/types.ts:type_alias:LoginResult:textHash_def456",
      "name": "LoginResult",
      "declarationKind": "type_alias",
      "exported": true,
      "text": "export type LoginResult =\n  | { kind: \"success\"; user: User }\n  | { kind: \"invalid_password\" }\n  | { kind: \"locked_account\" };",
      "provenance": {
        "kind": "ast_node",
        "file": "src/users/types.ts",
        "nodeKind": "TypeAliasDeclaration",
        "start": {
          "line": 8,
          "column": 1
        },
        "end": {
          "line": 11,
          "column": 34
        }
      }
    },
    {
      "id": "typedecl_f9a0182c",
      "stableKey": "type-decl:src/users/types.ts:interface:User:textHash_789abc",
      "name": "User",
      "declarationKind": "interface",
      "exported": true,
      "text": "export interface User {\n  id: string;\n  email: string;\n  locked: boolean;\n}",
      "provenance": {
        "kind": "ast_node",
        "file": "src/users/types.ts",
        "nodeKind": "InterfaceDeclaration",
        "start": {
          "line": 13,
          "column": 1
        },
        "end": {
          "line": 17,
          "column": 2
        }
      }
    }
  ],
  "calls": [
    {
      "id": "call_44b2af9e",
      "stableKey": "call:sym_8f12a91c:sym_0f3a92bc:src/users/login.ts:exprHash_8123:ordinal_1",
      "from": "sym_8f12a91c",
      "to": "sym_0f3a92bc",
      "expressionText": "findUserByEmail(input.email)",
      "argumentTypes": [
        {
          "expressionText": "input.email",
          "checkerTypeText": "string",
          "provenance": {
            "kind": "type_checker",
            "file": "src/users/login.ts",
            "nodeKind": "PropertyAccessExpression",
            "start": {
              "line": 6,
              "column": 38
            },
            "end": {
              "line": 6,
              "column": 49
            }
          }
        }
      ],
      "returnType": {
        "checkerTypeText": "Promise<any>",
        "provenance": {
          "kind": "type_checker",
          "file": "src/users/login.ts",
          "nodeKind": "CallExpression",
          "start": {
            "line": 6,
            "column": 22
          },
          "end": {
            "line": 6,
            "column": 50
          }
        }
      },
      "provenance": {
        "kind": "ast_node",
        "file": "src/users/login.ts",
        "nodeKind": "CallExpression",
        "start": {
          "line": 6,
          "column": 22
        },
        "end": {
          "line": 6,
          "column": 50
        }
      }
    }
  ]
}
```

---

# 22. Acceptance Criteria

The MVP is complete when the CLI can analyze a TypeScript project and emit JSON containing:

1. Project metadata.
2. Extracted callable/class symbols.
3. Raw type declarations.
4. Call-like expressions.
5. Static caller and callee IDs where resolvable.
6. `null` caller or callee values where unresolved.
7. Raw call expression text.
8. Raw type declaration text.
9. Function/method parameter type annotation text.
10. Function/method parameter checker type text.
11. Function/method return type annotation text.
12. Function/method return checker type text.
13. Call argument checker type text.
14. Call return checker type text.
15. Stable IDs for every symbol, type declaration, and call.
16. Provenance for every symbol, type declaration, call, parameter type observation, return type observation, and call argument type observation.
17. Deterministic ordering of output arrays.

---

# 23. Minimality Check

Every field in the MVP should satisfy at least one of these conditions:

```text
It identifies a fact.
It preserves source provenance.
It preserves raw TypeScript source text.
It preserves TypeChecker text.
It links one fact to another.
```

Fields that satisfy this standard are part of the MVP schema.
