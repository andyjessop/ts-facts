import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { extractTypeDeclarations } from "../src/extractTypeDeclarations";
import { loadProject } from "../src/loadProject";

const BASIC_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/basic/tsconfig.json",
);

describe("extractTypeDeclarations", () => {
	test("extracts type aliases, interfaces, and enums from basic fixture", () => {
		const rootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE, rootDir });

		const declarations = extractTypeDeclarations({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
		});

		// Current fixture has: LoginRequest, LoginResult, User, and UserRole
		expect(declarations.length).toBe(4);

		// Global validation loop
		for (const d of declarations) {
			expect(d.id).toMatch(/^typedecl_[0-9a-f]{8}$/);
			expect(d.stableKey).toMatch(
				/^type-decl:fixtures\/basic\/src\/users\/.*:textHash_[0-9a-f]{8}$/,
			);
			expect(d.name).toBeTruthy();
			expect(["type_alias", "interface", "enum"]).toContain(d.declarationKind);
			expect(typeof d.exported).toBe("boolean");
			expect(d.text).toBeTruthy();
			expect(d.provenance.kind).toBe("ast_node");
			expect(d.provenance.file).toMatch(/^fixtures\/basic\/src\/users\//);
		}

		// Specific lookups
		const loginRequest = declarations.find((d) => d.name === "LoginRequest");
		const user = declarations.find((d) => d.name === "User");
		const userRole = declarations.find((d) => d.name === "UserRole");

		expect(loginRequest).toBeDefined();
		expect(loginRequest?.declarationKind).toBe("type_alias");
		expect(loginRequest?.provenance.nodeKind).toBe("TypeAliasDeclaration");
		expect(loginRequest?.provenance.file).toBe(
			"fixtures/basic/src/users/types.ts",
		);
		expect(loginRequest?.stableKey).toMatch(
			/^type-decl:fixtures\/basic\/src\/users\/types\.ts:type_alias:LoginRequest:textHash_[0-9a-f]{8}$/,
		);

		expect(user).toBeDefined();
		expect(user?.declarationKind).toBe("interface");
		expect(user?.provenance.nodeKind).toBe("InterfaceDeclaration");

		expect(userRole).toBeDefined();
		expect(userRole?.declarationKind).toBe("enum");
		expect(userRole?.provenance.nodeKind).toBe("EnumDeclaration");
		expect(userRole?.exported).toBe(true);
		expect(userRole?.text).toContain("export enum UserRole");
	});

	test("output is sorted by stableKey", () => {
		const rootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE, rootDir });

		const declarations = extractTypeDeclarations({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
		});

		const keys = declarations.map((d) => d.stableKey);
		const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b));
		expect(keys).toEqual(sortedKeys);
	});
});
