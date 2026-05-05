import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { loadProject } from "../src/loadProject";
import { isInsideRoot, toProjectRelativePath } from "../src/provenance";

const BASIC_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/basic/tsconfig.json",
);

describe("Milestone 1 Verification", () => {
	test("basic fixture has no semantic diagnostics", () => {
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE });
		const diagnostics = project.program.getSemanticDiagnostics();

		const readable = diagnostics.map((d) => ({
			message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
			file: d.file?.fileName,
		}));

		expect(readable).toEqual([]);
	});

	test("rootDir does not change tsconfig-relative include resolution", () => {
		const projectRootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({
			tsconfigPath: BASIC_FIXTURE,
			rootDir: projectRootDir,
		});

		const relPaths = project.sourceFiles.map((sf) =>
			toProjectRelativePath(project.rootDir, sf.fileName),
		);

		expect(relPaths).toContain("fixtures/basic/src/users/login.ts");
		expect(relPaths).toContain("fixtures/basic/src/users/types.ts");
	});

	test("isInsideRoot correctly identifies containment", () => {
		const root = "/repo";
		expect(isInsideRoot(root, "/repo/src/file.ts")).toBe(true);
		expect(isInsideRoot(root, "/repo/file.ts")).toBe(true);
		expect(isInsideRoot(root, "/repo")).toBe(true);

		expect(isInsideRoot(root, "/repo-other/file.ts")).toBe(false);
		expect(isInsideRoot(root, "/other/repo/file.ts")).toBe(false);
	});
});
