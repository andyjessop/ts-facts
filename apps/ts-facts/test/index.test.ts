import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

describe("ts-facts CLI", () => {
	test("CLI stub runs and prints stub message", async () => {
		// Ensure it's built (apps/ts-facts build runs tsc)
		const rootDir = resolve(import.meta.dir, "..");

		const proc = Bun.spawn(["node", "dist/index.js"], {
			cwd: rootDir,
			stdout: "pipe",
			stderr: "pipe",
		});

		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		expect(stdout).toContain("ts-facts CLI stub");
	});
});
