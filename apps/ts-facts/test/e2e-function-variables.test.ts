import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { StaticFactsFile } from "ts-facts-core";

describe("E2E: Function Variables Fixture", () => {
	test("runs the full pipeline and extracts function variables correctly", async () => {
		const rootDir = resolve(import.meta.dir, "..");
		const fixtureTsconfig = resolve(
			rootDir,
			"../../fixtures/function-variables/tsconfig.json",
		);
		const outFile = resolve(rootDir, "test-out-fn-vars.json");

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

		const symbols = data.symbols;
		const approveInvoice = symbols.find((s) => s.name === "approveInvoice");
		const rejectInvoice = symbols.find((s) => s.name === "rejectInvoice");

		expect(approveInvoice).toBeDefined();
		expect(rejectInvoice).toBeDefined();

		if (!approveInvoice || !rejectInvoice) {
			throw new Error("Expected function variable symbols missing");
		}

		expect(approveInvoice.kind).toBe("function_variable");
		expect(rejectInvoice.kind).toBe("function_variable");

		expect(approveInvoice.exported).toBe(true);
		expect(rejectInvoice.exported).toBe(false);

		for (const sym of [approveInvoice, rejectInvoice]) {
			expect(Array.isArray(sym.parameters)).toBe(true);
			expect(sym.returnType).toBeDefined();
			expect(sym.provenance).toBeDefined();
		}

		// Cleanup
		rmSync(outFile);
	});
});
