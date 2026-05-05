import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

describe("E2E: Classes Fixture", () => {
	test("runs the full pipeline and extracts class symbols correctly", async () => {
		const rootDir = resolve(import.meta.dir, "..");
		const fixtureTsconfig = resolve(
			rootDir,
			"../../fixtures/classes/tsconfig.json",
		);
		const outFile = resolve(rootDir, "test-out-classes.json");

		if (existsSync(outFile)) {
			rmSync(outFile);
		}

		const proc = Bun.spawn(
			["bun", "src/index.ts", "--tsconfig", fixtureTsconfig, "--out", outFile],
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

		const symbols = data.symbols;
		const classSymbol = symbols.find((s: any) => s.name === "UserService");
		const ctorSymbol = symbols.find(
			(s: any) =>
				s.name === "constructor" && s.qualifiedName.startsWith("UserService"),
		);
		const createMethod = symbols.find((s: any) => s.name === "createUser");
		const normalizeMethod = symbols.find(
			(s: any) => s.name === "normalizeEmail",
		);

		expect(classSymbol).toBeDefined();
		expect(ctorSymbol).toBeDefined();
		expect(createMethod).toBeDefined();
		expect(normalizeMethod).toBeDefined();

		// Class schema
		expect(classSymbol.kind).toBe("class");
		expect(classSymbol.signatureText).toBeNull();
		expect(classSymbol.parameters).toEqual([]);
		expect(classSymbol.returnType).toBeNull();

		// Method schema
		expect(createMethod.kind).toBe("method");
		expect(createMethod.parameters.length).toBeGreaterThan(0);
		expect(createMethod.returnType).toBeDefined();

		// Constructor schema
		expect(ctorSymbol.kind).toBe("constructor");
		expect(ctorSymbol.parameters.length).toBeGreaterThan(0);
		// Assuming constructors have no return type or the return type of the class instance
		// We'll just verify it's a constructor kind.

		// Ensure class symbols are not used as 'from'
		const calls = data.calls;
		for (const call of calls) {
			expect(call.from).not.toBe(classSymbol.id);
		}

		// Cleanup
		rmSync(outFile);
	});
});
