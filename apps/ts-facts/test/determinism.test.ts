import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

describe("Determinism", () => {
	test("repeated runs produce byte-identical JSON", async () => {
		const rootDir = resolve(import.meta.dir, "..");
		const fixtureTsconfig = resolve(
			rootDir,
			"../../fixtures/basic/tsconfig.json",
		);
		const outFileA = resolve(rootDir, "test-out-det-a.json");
		const outFileB = resolve(rootDir, "test-out-det-b.json");

		for (const f of [outFileA, outFileB]) {
			if (existsSync(f)) rmSync(f);
		}

		// Run A
		const procA = Bun.spawn(
			["bun", "src/index.ts", "--tsconfig", fixtureTsconfig, "--out", outFileA],
			{ cwd: rootDir, stdout: "pipe", stderr: "pipe" },
		);
		const codeA = await procA.exited;
		if (codeA !== 0) throw new Error("CLI failed on run A");

		// Run B
		const procB = Bun.spawn(
			["bun", "src/index.ts", "--tsconfig", fixtureTsconfig, "--out", outFileB],
			{ cwd: rootDir, stdout: "pipe", stderr: "pipe" },
		);
		const codeB = await procB.exited;
		if (codeB !== 0) throw new Error("CLI failed on run B");

		const dataA = readFileSync(outFileA, "utf-8");
		const dataB = readFileSync(outFileB, "utf-8");

		expect(dataA).toBe(dataB);

		// Cleanup
		rmSync(outFileA);
		rmSync(outFileB);
	});
});
