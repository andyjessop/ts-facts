import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { extractCalls } from "../src/extractCalls";
import { extractSymbolsInternal } from "../src/extractSymbols";
import { loadProject } from "../src/loadProject";
import { buildSymbolIndex } from "../src/symbolIndex";

const BUILTINS_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/builtins/tsconfig.json",
);

describe("extractCalls (builtins filtering)", () => {
	test("filters out built-in calls and preserves project/external calls", () => {
		const rootDir = resolve(dirname(BUILTINS_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BUILTINS_FIXTURE, rootDir });

		// Verify no diagnostics in the fixture
		const diagnostics = [
			...project.program.getSyntacticDiagnostics(),
			...project.program.getSemanticDiagnostics(),
		];
		expect(
			diagnostics.map((d) => ({
				message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
				file: d.file?.fileName,
			})),
		).toEqual([]);

		const extractedSymbols = extractSymbolsInternal({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		const symbolIndex = buildSymbolIndex({
			extracted: extractedSymbols,
			checker: project.checker,
		});

		const calls = extractCalls({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
			symbolIndex,
		});

		const expressions = calls.map((c) => c.expressionText);

		// JS/TS Built-ins should be GONE
		expect(expressions).not.toContain("JSON.stringify(value)");
		expect(expressions).not.toContain("JSON.parse(asJson)");
		expect(expressions).not.toContain("new Date()");
		expect(expressions).not.toContain("now.toISOString()");
		expect(expressions).not.toContain("Math.max(...values)");
		expect(expressions).not.toContain("Object.keys(parsed ?? {})");
		expect(expressions).not.toContain("Array.isArray(values)");
		expect(expressions).not.toContain("Promise.resolve(value)");
		expect(expressions.some((e) => e.startsWith("console.log("))).toBe(false);
		expect(expressions).not.toContain("String(value)");
		expect(expressions).not.toContain('Buffer.from("hello")');

		// Project calls should be RETAINED
		expect(expressions).toContain("localHelper(String(value))");

		// External library calls should be RETAINED and have to: null
		expect(expressions).toContain("z.object({ id: z.string() })");
		expect(expressions).toContain("z.string()");
		const parseCall = calls.find(
			(c) => c.expressionText === "schema.parse(value)",
		);
		expect(parseCall).toBeDefined();
		expect(parseCall?.to).toBeNull();

		// Unresolved calls should be RETAINED
		expect(expressions).toContain("(schema as any)[action](value)");

		const localHelperSymbol = extractedSymbols.find(
			(s) => s.fact.name === "localHelper",
		);
		expect(localHelperSymbol).toBeDefined();

		// Check resolution for project call
		const local = calls.find(
			(c) => c.expressionText === "localHelper(String(value))",
		);
		expect(local?.to).toBe(localHelperSymbol?.fact.id);

		// Nested call test: console.log(localHelper(String(value)))
		// The parent console.log and the inner String(value) should be filtered.
		expect(expressions).not.toContain(
			"console.log(localHelper(String(value)))",
		);

		const nestedLocalHelper = calls.filter(
			(c) => c.expressionText === "localHelper(String(value))",
		);
		// There are two such calls in index.ts: one standalone, one inside console.log
		expect(nestedLocalHelper).toHaveLength(2);

		const dynamic = calls.find(
			(c) => c.expressionText === "(schema as any)[action](value)",
		);
		expect(dynamic?.to).toBeNull();
	});
});
