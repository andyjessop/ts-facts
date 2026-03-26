
All packages and apps should have the same structure:

src
  - some-file.ts
  - some-file.test.ts // for unit tests only
test // for integration tests only
package.json
tsconfig.json

For packages:

package.json has scripts:
- test (for unit tests, use vitest on src)
- lint (use biome check on src)
- typecheck (use tsc on src)

For apps:

package.json has scripts:
- test (for unit tests, use vitest on src)
- lint (use biome check on src)
- typecheck (use tsc on src)
- integration