import { describe, expect, test } from "bun:test";
import ts from "typescript";
import {
	isInsideRoot,
	makeProvenance,
	toProjectRelativePath,
} from "../src/provenance";

describe("provenance helpers", () => {
	test("toProjectRelativePath normalizes paths", () => {
		expect(toProjectRelativePath("/repo", "/repo/src/file.ts")).toBe(
			"src/file.ts",
		);
		// Test backslash replacement explicitly without relying on path.relative's platform behavior
		const result = toProjectRelativePath(
			"C:",
			"C:\\src\\file.ts".replace(/\\/g, "/"),
		);
		expect(result).not.toContain("\\");
	});

	test("isInsideRoot correctly identifies containment", () => {
		expect(isInsideRoot("/repo", "/repo/src/file.ts")).toBe(true);
		expect(isInsideRoot("/repo", "/repo-other/file.ts")).toBe(false);
	});

	test("makeProvenance produces correct one-based line/col", () => {
		const source = ts.createSourceFile(
			"test.ts",
			"function foo() {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");

		const prov = makeProvenance({
			kind: "ast_node",
			rootDir: "/",
			sourceFile: source,
			node,
		});

		expect(prov.start.line).toBe(1);
		expect(prov.start.column).toBe(1);
		expect(prov.nodeKind).toBe("FunctionDeclaration");
	});
});
