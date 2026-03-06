import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("hello command prints greeting", () => {
	const bin = join(import.meta.dir, "..", "bin", "run.js");
	const result = spawnSync("node", [bin, "hello"], {
		cwd: join(import.meta.dir, ".."),
		encoding: "utf-8",
	});
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("Hello from the CLI!");
});
