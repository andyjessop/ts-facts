import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { classifyCallTarget } from "../src/callTarget";
import { extractSymbolsInternal } from "../src/extractSymbols";
import { buildSymbolIndex } from "../src/symbolIndex";
import { loadProject } from "../src/loadProject";
import { normalizePath } from "../src/provenance";

const BUILTINS_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/builtins/tsconfig.json",
);

describe("classifyCallTarget", () => {
	test("unit tests for classifications using builtins fixture", () => {
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

		const checker = project.checker;
		const sourceFile = project.sourceFiles.find((sf) =>
			sf.fileName.endsWith("src/index.ts"),
		);
		expect(sourceFile).toBeDefined();
		if (!sourceFile) return;

		const extracted = extractSymbolsInternal({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker,
		});
		const index = buildSymbolIndex({ extracted, checker });
		const projectFileNames = new Set(
			project.sourceFiles.map((sf) => normalizePath(resolve(sf.fileName))),
		);

		const classifications: Record<string, string> = {};

		function visit(node: ts.Node) {
			if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
				const text = node.getText();
				const classification = classifyCallTarget({
					call: node,
					checker,
					symbolIndex: index,
					projectFileNames,
				});
				classifications[text] = classification.kind;
			}
			ts.forEachChild(node, visit);
		}
		visit(sourceFile);

		// JS/TS Built-ins
		expect(classifications["JSON.stringify(value)"]).toBe("builtin");
		expect(classifications["JSON.parse(asJson)"]).toBe("builtin");
		expect(classifications["new Date()"]).toBe("builtin");
		expect(classifications["now.toISOString()"]).toBe("builtin");
		expect(classifications["Math.max(...values)"]).toBe("builtin");
		expect(classifications["Object.keys(parsed ?? {})"]).toBe("builtin");
		expect(classifications["Array.isArray(values)"]).toBe("builtin");
		expect(classifications["Promise.resolve(value)"]).toBe("builtin");
		expect(classifications["String(value)"]).toBe("builtin");

		// Platform APIs (Node/Bun)
		expect(
			classifications.hasOwnProperty(
				"console.log(max, keys, isArray, resolved)",
			),
		).toBe(true);
		expect(classifications["console.log(max, keys, isArray, resolved)"]).toBe(
			"builtin",
		);
		expect(classifications['Buffer.from("hello")']).toBe("builtin");

		// Project symbols
		expect(classifications["localHelper(String(value))"]).toBe("project");

		// External library (zod)
		expect(classifications["z.object({ id: z.string() })"]).toBe("external");
		expect(classifications["z.string()"]).toBe("external");
		expect(classifications["schema.parse(value)"]).toBe("external");

		// Unresolved
		expect(classifications["(schema as any)[action](value)"]).toBe(
			"unresolved",
		);
	});
});
