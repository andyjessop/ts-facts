---
trigger: always_on
---

# Spec Writing Standards

A "spec" is a document that outlines a proposed set of work. All specs must follow these standards to ensure they can be understood and implemented by developers of any level.

## 1. Depth of Detail
- **Exhaustive Research:** Before writing a spec, research the existing codebase, dependencies, and potential side effects.
- **Implementation Strategy:** Describe the technical approach in detail, including specific file changes, new functions, and database schema updates.
- **Edge Cases:** Explicitly identify and plan for error states, performance bottlenecks, and security considerations.

## 2. Granular Task Breakdown
Break the work down into the smallest possible units. Use a nested numbering system:
- **Major Phases:** 1.0, 2.0, etc.
- **Specific Tasks:** 1.1, 1.2, 1.3.
- **Sub-tasks:** 1.1.1, 1.1.2.
- **Micro-tasks:** 1.1.1.1, 1.1.1.2 (where necessary).

The goal is to ensure each task is so specific that it can be picked up by a junior developer with minimal ambiguity.

## 3. Verification Plan
Each spec must include a clear verification section:
- **Automated Tests:** Specify the test runner and key test cases.
- **Manual Verification:** List the manual steps required to confirm the feature works.
- **Performance Benchmarks:** Define success criteria for performance-sensitive changes.
