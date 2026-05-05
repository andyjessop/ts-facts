import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

describe("E2E: Basic Fixture", () => {
	test("runs the full pipeline and produces expected JSON", async () => {
		const rootDir = resolve(import.meta.dir, "..");
		const fixtureTsconfig = resolve(
			rootDir,
			"../../fixtures/basic/tsconfig.json",
		);
		const outFile = resolve(rootDir, "test-out-basic.json");

		if (existsSync(outFile)) {
			rmSync(outFile);
		}

		const proc = Bun.spawn(
			[
				"bun",
				"src/index.ts",
				"--tsconfig",
				fixtureTsconfig,
				"--out",
				outFile,
			],
			{
				cwd: rootDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		const exitCode = await proc.exited;
		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text();
			throw new Error(`CLI failed with code ${exitCode}:\n${stderr}`);
		}

		expect(existsSync(outFile)).toBe(true);

		const data = JSON.parse(readFileSync(outFile, "utf-8"));

		// Top-level fields
		expect(data.schemaVersion).toBe("0.1.0");
		expect(data.mode).toBe("typescript_static_facts");
		expect(data.project).toBeDefined();
		expect(data.symbols instanceof Array).toBe(true);
		expect(data.typeDeclarations instanceof Array).toBe(true);
		expect(data.calls instanceof Array).toBe(true);

		// Project metadata
		const sourceFiles = data.project.sourceFiles as string[];
		expect(sourceFiles).toContain("src/users/login.ts");
		expect(sourceFiles).toContain("src/users/types.ts");
		expect(data.project.tsconfig).toBe("tsconfig.json");

		// Symbols
		const symbolNames = data.symbols.map((s: any) => s.name);
		expect(symbolNames).toContain("login");
		expect(symbolNames).toContain("findUserByEmail");

		// Type declarations
		const typeNames = data.typeDeclarations.map((t: any) => t.name);
		expect(typeNames).toContain("LoginRequest");
		expect(typeNames).toContain("LoginResult");
		expect(typeNames).toContain("User");

		// Calls
		const callExpressions = data.calls.map((c: any) => c.expressionText);
		expect(
			callExpressions.some((e: string) =>
				e.includes("findUserByEmail(input.email)"),
			),
		).toBe(true);

		// Fact schema checks
		for (const arr of [data.symbols, data.typeDeclarations, data.calls]) {
			for (const fact of arr) {
				expect(!!fact.id).toBe(true);
				expect(!!fact.stableKey).toBe(true);
				expect(fact.provenance).toBeDefined();
				expect(!!fact.provenance.kind).toBe(true);
				expect(!!fact.provenance.file).toBe(true);
				expect(!!fact.provenance.nodeKind).toBe(true);
				expect(fact.provenance.start).toBeDefined();
				expect(fact.provenance.start.line).toBeGreaterThan(0);
				expect(fact.provenance.start.column).toBeGreaterThan(0);
				expect(fact.provenance.end).toBeDefined();
				expect(fact.provenance.end.line).toBeGreaterThan(0);
				expect(fact.provenance.end.column).toBeGreaterThan(0);
			}
		}

		// Cleanup
		rmSync(outFile);
	});
});
