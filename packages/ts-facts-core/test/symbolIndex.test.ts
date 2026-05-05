import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { extractSymbolsInternal } from "../src/extractSymbols";
import { loadProject } from "../src/loadProject";
import { buildSymbolIndex } from "../src/symbolIndex";

const BASIC_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/basic/tsconfig.json",
);

describe("SymbolIndex", () => {
	test("maps declarations to symbol IDs in the basic fixture", () => {
		const rootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE, rootDir });

		const extracted = extractSymbolsInternal({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		const index = buildSymbolIndex({ extracted, checker: project.checker });

		// There are 2 functions in basic fixture: login and findUserByEmail
		expect(index.byDeclarationNode.size).toBe(2);
		expect(index.byTsSymbol.size).toBe(2);

		for (const { fact, declaration } of extracted) {
			expect(index.byDeclarationNode.get(declaration)?.id).toBe(fact.id);
		}
	});
});
