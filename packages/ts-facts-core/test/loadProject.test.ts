import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { loadProject } from "../src/loadProject";
import { toProjectRelativePath } from "../src/provenance";

const BASIC_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/basic/tsconfig.json",
);

describe("loadProject", () => {
	test("returns a valid program and checker", () => {
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE });
		expect(project.program).toBeDefined();
		expect(project.checker).toBeDefined();
	});

	test("does not include declaration files", () => {
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE });
		const hasDts = project.sourceFiles.some((sf) => sf.isDeclarationFile);
		expect(hasDts).toBe(false);
	});

	test("source files are sorted by project-relative path", () => {
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE });
		const relPaths = project.sourceFiles.map((sf) =>
			toProjectRelativePath(project.rootDir, sf.fileName),
		);
		const sortedPaths = [...relPaths].sort((a, b) => a.localeCompare(b));
		expect(relPaths).toEqual(sortedPaths);
	});

	test("exclude pattern removes matching files", () => {
		const project = loadProject({
			tsconfigPath: BASIC_FIXTURE,
			exclude: ["**/types.ts"],
		});
		const relPaths = project.sourceFiles.map((sf) =>
			toProjectRelativePath(project.rootDir, sf.fileName),
		);
		expect(relPaths).not.toContain("src/users/types.ts");
		expect(relPaths).toContain("src/users/login.ts");
	});

	test("resolves tsconfigPath to absolute path", () => {
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE });
		expect(resolve(project.tsconfigPath)).toBe(project.tsconfigPath);
	});

	test("uses tsconfig directory as rootDir when not specified", () => {
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE });
		expect(project.rootDir).toBe(dirname(BASIC_FIXTURE));
	});
});
