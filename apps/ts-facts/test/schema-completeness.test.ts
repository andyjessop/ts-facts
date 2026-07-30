import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Provenance, StaticFactsFile } from "ts-facts-core";

function assertProvenance(provenance: Provenance) {
	expect(provenance).toBeDefined();
	expect(["ast_node", "type_checker"]).toContain(provenance.kind);
	expect(!!provenance.file).toBe(true);
	expect(!!provenance.nodeKind).toBe(true);
	expect(provenance.start.line).toBeGreaterThan(0);
	expect(provenance.start.column).toBeGreaterThan(0);
	expect(provenance.end.line).toBeGreaterThan(0);
	expect(provenance.end.column).toBeGreaterThan(0);
}

describe("Schema Completeness", () => {
	const fixtures = ["basic", "classes", "function-variables", "calls"];

	test("every required field exists across all fixtures", async () => {
		const rootDir = resolve(import.meta.dir, "..");

		for (const fixture of fixtures) {
			const fixtureTsconfig = resolve(
				rootDir,
				`../../fixtures/${fixture}/tsconfig.json`,
			);
			const outFile = resolve(rootDir, `test-out-schema-${fixture}.json`);

			if (existsSync(outFile)) rmSync(outFile);

			const proc = Bun.spawn(
				[
					"bun",
					"src/index.ts",
					"--tsconfig",
					fixtureTsconfig,
					"--out",
					outFile,
				],
				{ cwd: rootDir, stdout: "pipe", stderr: "pipe" },
			);
			const code = await proc.exited;
			if (code !== 0) throw new Error(`CLI failed on ${fixture}`);

			const data = JSON.parse(
				readFileSync(outFile, "utf-8"),
			) as StaticFactsFile;

			for (const symbol of data.symbols) {
				expect(symbol.id.startsWith("sym_")).toBe(true);
				expect(symbol.stableKey.startsWith("symbol:")).toBe(true);
				expect([
					"function",
					"method",
					"constructor",
					"class",
					"function_variable",
				]).toContain(symbol.kind);
				expect("name" in symbol).toBe(true);
				expect("qualifiedName" in symbol).toBe(true);
				expect(typeof symbol.exported).toBe("boolean");
				expect("signatureText" in symbol).toBe(true); // nullable
				expect(Array.isArray(symbol.parameters)).toBe(true);
				expect("returnType" in symbol).toBe(true); // nullable
				assertProvenance(symbol.provenance);

				for (const param of symbol.parameters) {
					expect("name" in param).toBe(true);
					expect("typeAnnotationText" in param).toBe(true); // nullable
					expect(!!param.checkerTypeText).toBe(true);
					assertProvenance(param.provenance);
				}

				if (symbol.returnType) {
					expect("typeAnnotationText" in symbol.returnType).toBe(true); // nullable
					expect(!!symbol.returnType.checkerTypeText).toBe(true);
					assertProvenance(symbol.returnType.provenance);
				}
			}

			for (const decl of data.typeDeclarations) {
				expect(decl.id.startsWith("typedecl_")).toBe(true);
				expect(decl.stableKey.startsWith("type-decl:")).toBe(true);
				expect(!!decl.name).toBe(true);
				expect(["type_alias", "interface", "enum"]).toContain(
					decl.declarationKind,
				);
				expect(typeof decl.exported).toBe("boolean");
				expect(!!decl.text).toBe(true);
				assertProvenance(decl.provenance);
			}

			for (const call of data.calls) {
				expect(call.id.startsWith("call_")).toBe(true);
				expect(call.stableKey.startsWith("call:")).toBe(true);
				expect("from" in call).toBe(true); // nullable
				expect("to" in call).toBe(true); // nullable
				expect(!!call.expressionText).toBe(true);
				expect(Array.isArray(call.argumentTypes)).toBe(true);
				expect(call.returnType).toBeDefined();
				assertProvenance(call.provenance);

				for (const arg of call.argumentTypes) {
					expect(!!arg.expressionText).toBe(true);
					expect(!!arg.checkerTypeText).toBe(true);
					assertProvenance(arg.provenance);
				}

				expect(!!call.returnType.checkerTypeText).toBe(true);
				assertProvenance(call.returnType.provenance);
			}

			rmSync(outFile);
		}
	});
});
