import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { extractSymbols } from "../src/extractSymbols";
import { loadProject } from "../src/loadProject";

const BASIC_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/basic/tsconfig.json",
);

describe("extractSymbols", () => {
	test("extracts basic named function declarations with exact assertions", () => {
		const rootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE, rootDir });

		const symbols = extractSymbols({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		expect(symbols.length).toBe(2);

		// Global validation loop
		for (const symbol of symbols) {
			expect(symbol.id).toMatch(/^sym_[0-9a-f]{8}$/);
			expect(symbol.stableKey).toStartWith("symbol:");
			expect(symbol.kind).toBe("function");
			expect(symbol.name).toBeTruthy();
			expect(symbol.qualifiedName).toBe(symbol.name);
			expect(typeof symbol.exported).toBe("boolean");
			expect(symbol.signatureText).not.toBeNull();
			expect(symbol.parameters).toBeArray();
			expect(symbol.returnType).not.toBeNull();
			expect(symbol.provenance.kind).toBe("ast_node");
			expect(symbol.provenance.nodeKind).toBe("FunctionDeclaration");

			for (const param of symbol.parameters) {
				expect(param.name).toBeTruthy();
				expect("typeAnnotationText" in param).toBe(true);
				expect(param.checkerTypeText).toBeTruthy();
				expect(param.provenance.kind).toBe("type_checker");
				expect(param.provenance.nodeKind).toBe("Parameter");
			}

			expect(symbol.returnType?.checkerTypeText).toBeTruthy();
			expect(symbol.returnType?.provenance.kind).toBe("type_checker");
		}

		const login = symbols.find((s) => s.name === "login");
		const findUser = symbols.find((s) => s.name === "findUserByEmail");

		expect(login).toBeDefined();
		expect(login?.stableKey).toBe(
			"symbol:fixtures/basic/src/users/login.ts:function:login:(input: LoginRequest)=>Promise<LoginResult>",
		);

		expect(findUser).toBeDefined();
		expect(findUser?.stableKey).toBe(
			"symbol:fixtures/basic/src/users/login.ts:function:findUserByEmail:(_email: string)=>Promise<User | null>",
		);
	});

	test("anonymous default functions are skipped", () => {
		const code = "export default function () { return 1; }";
		const sourceFile = ts.createSourceFile(
			"test.ts",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
		const host = ts.createCompilerHost({});
		const originalGetSourceFile = host.getSourceFile;
		host.getSourceFile = (
			fileName,
			version,
			onError,
			shouldCreateNewSourceFile,
		) => {
			if (fileName === "test.ts") return sourceFile;
			return originalGetSourceFile(
				fileName,
				version,
				onError,
				shouldCreateNewSourceFile,
			);
		};

		const program = ts.createProgram(["test.ts"], { allowJs: true }, host);
		const checker = program.getTypeChecker();

		const symbols = extractSymbols({
			rootDir: "/",
			sourceFiles: [sourceFile],
			checker,
		});

		expect(symbols.length).toBe(0);
	});

	test("named default functions are extracted", () => {
		const code = "export default function namedDefault() { return 2; }";
		const sourceFile = ts.createSourceFile(
			"test2.ts",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
		const host = ts.createCompilerHost({});
		const originalGetSourceFile = host.getSourceFile;
		host.getSourceFile = (
			fileName,
			version,
			onError,
			shouldCreateNewSourceFile,
		) => {
			if (fileName === "test2.ts") return sourceFile;
			return originalGetSourceFile(
				fileName,
				version,
				onError,
				shouldCreateNewSourceFile,
			);
		};

		const program = ts.createProgram(["test2.ts"], { allowJs: true }, host);
		const checker = program.getTypeChecker();

		const symbols = extractSymbols({
			rootDir: "/",
			sourceFiles: [sourceFile],
			checker,
		});

		expect(symbols.length).toBe(1);
		expect(symbols[0].name).toBe("namedDefault");
		expect(symbols[0].exported).toBe(true);
	});

	test("output is sorted by stableKey", () => {
		const rootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE, rootDir });

		const symbols = extractSymbols({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		const keys = symbols.map((s) => s.stableKey);
		const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b));
		expect(keys).toEqual(sortedKeys);
	});
});
