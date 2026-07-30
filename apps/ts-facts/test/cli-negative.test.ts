import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { StaticFactsFile } from "ts-facts-core";

describe("CLI Negative Paths & Exclusions", () => {
	test("exits with code 1 without --tsconfig", async () => {
		const rootDir = resolve(import.meta.dir, "..");

		const proc = Bun.spawn(["bun", "src/index.ts"], {
			cwd: rootDir,
			stdout: "pipe",
			stderr: "pipe",
		});

		const code = await proc.exited;
		const stderr = await new Response(proc.stderr).text();

		expect(code).toBe(1);
		expect(stderr).toContain("--tsconfig is required");
	});

	test("multiple --exclude values are accepted and applied", async () => {
		const rootDir = resolve(import.meta.dir, "..");
		const fixtureTsconfig = resolve(
			rootDir,
			"../../fixtures/basic/tsconfig.json",
		);
		const outFile = resolve(rootDir, "test-out-exclude.json");

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
				"--exclude",
				"**/login.ts",
				"--exclude",
				"**/*.spec.ts",
			],
			{
				cwd: rootDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		const exitCode = await proc.exited;
		expect(exitCode).toBe(0);

		const data = JSON.parse(readFileSync(outFile, "utf-8")) as StaticFactsFile;
		const sourceFiles = data.project.sourceFiles as string[];

		// login.ts should be excluded
		expect(sourceFiles.some((f) => f.endsWith("login.ts"))).toBe(false);
		// types.ts should still be there
		expect(sourceFiles.some((f) => f.endsWith("types.ts"))).toBe(true);

		// Assert symbols from login.ts are gone
		const symbolNames = data.symbols.map((s) => s.name);
		expect(symbolNames).not.toContain("login");
		expect(symbolNames).not.toContain("findUserByEmail");

		// Assert calls from login.ts (which contains top-level calls) are gone
		// In basic fixture, most calls are in login.ts
		expect(data.calls.length).toBe(0);

		// Cleanup
		rmSync(outFile);
	});
});
