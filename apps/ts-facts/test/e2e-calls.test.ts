import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { StaticFactsFile } from "ts-facts-core";

describe("E2E: Calls Fixture", () => {
	test("runs the full pipeline and extracts calls correctly", async () => {
		const rootDir = resolve(import.meta.dir, "..");
		const fixtureTsconfig = resolve(
			rootDir,
			"../../fixtures/calls/tsconfig.json",
		);
		const outFile = resolve(rootDir, "test-out-calls.json");

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

		const data = JSON.parse(readFileSync(outFile, "utf-8")) as StaticFactsFile;

		const calls = data.calls;
		const symbols = data.symbols;

		const mainSymbol = symbols.find((s) => s.name === "main");
		expect(mainSymbol).toBeDefined();

		const mainCall = calls.find((c) => c.expressionText === "main()");
		const dynamicCall = calls.find((c) =>
			c.expressionText.includes("[action]"),
		);
		const newGreeterCall = calls.find((c) =>
			c.expressionText.startsWith("new Greeter("),
		);

		expect(mainCall).toBeDefined();
		expect(dynamicCall).toBeDefined();
		expect(newGreeterCall).toBeDefined();

		if (!mainSymbol || !mainCall || !dynamicCall || !newGreeterCall) {
			throw new Error("Expected symbols/calls missing");
		}

		expect(mainCall.from).toBeNull();
		expect(mainCall.to).toBe(mainSymbol.id);

		expect(dynamicCall.to).toBeNull();

		expect(newGreeterCall.from).toBe(mainSymbol.id);
		expect(Array.isArray(newGreeterCall.argumentTypes)).toBe(true);
		expect(newGreeterCall.returnType).toBeDefined();

		for (const call of [mainCall, dynamicCall, newGreeterCall]) {
			expect(!!call.expressionText).toBe(true);
			expect(Array.isArray(call.argumentTypes)).toBe(true);
			expect(call.returnType).toBeDefined();
			expect(call.provenance).toBeDefined();
		}

		// Cleanup
		rmSync(outFile);
	});
});
