import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { extractSymbols } from "../src/extractSymbols";
import { loadProject } from "../src/loadProject";
import type { SymbolFact } from "../src/schema";

const BASIC_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/basic/tsconfig.json",
);

describe("extractSymbols", () => {
	function expectNoDiagnostics(project: { program: ts.Program }) {
		const diagnostics = [
			...project.program.getSyntacticDiagnostics(),
			...project.program.getSemanticDiagnostics(),
		];

		const readable = diagnostics.map((d) => ({
			message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
			file: d.file?.fileName,
		}));

		expect(readable).toEqual([]);
	}

	function validateSymbols(symbols: SymbolFact[]) {
		for (const symbol of symbols) {
			expect(symbol.id).toMatch(/^sym_[0-9a-f]{8}$/);
			expect(symbol.stableKey).toStartWith("symbol:");
			expect(symbol.provenance.kind).toBe("ast_node");
			expect(typeof symbol.provenance.file).toBe("string");
			expect(symbol.provenance.file.length).toBeGreaterThan(0);
			expect(symbol.provenance.start.line).toBeGreaterThan(0);
			expect(symbol.provenance.start.column).toBeGreaterThan(0);
			expect(symbol.provenance.end.line).toBeGreaterThan(0);
			expect(symbol.provenance.end.column).toBeGreaterThan(0);

			for (const param of symbol.parameters) {
				expect(param.provenance.kind).toBe("type_checker");
				expect(param.provenance.nodeKind).toBe("Parameter");
				expect(param.checkerTypeText).toBeTruthy();
			}

			if (symbol.returnType) {
				expect(symbol.returnType.provenance.kind).toBe("type_checker");
				expect(symbol.returnType.checkerTypeText).toBeTruthy();
			}
		}
	}

	test("extracts basic named function declarations with exact assertions", () => {
		const rootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE, rootDir });
		expectNoDiagnostics(project);

		const symbols = extractSymbols({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		expect(symbols.length).toBe(2);
		validateSymbols(symbols);

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
		validateSymbols(symbols);
	});

	test("local function variables are skipped", () => {
		const code = `
			export function outer() {
				const helper = () => 1;
				return helper();
			}
		`;
		const sourceFile = ts.createSourceFile(
			"test3.ts",
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
			if (fileName === "test3.ts") return sourceFile;
			return originalGetSourceFile(
				fileName,
				version,
				onError,
				shouldCreateNewSourceFile,
			);
		};

		const program = ts.createProgram(["test3.ts"], { allowJs: true }, host);
		const checker = program.getTypeChecker();

		const symbols = extractSymbols({
			rootDir: "/",
			sourceFiles: [sourceFile],
			checker,
		});

		// Only 'outer' should be extracted. 'helper' is local.
		expect(symbols.length).toBe(1);
		expect(symbols[0].name).toBe("outer");
		validateSymbols(symbols);
	});

	test("extracts class, method, and constructor symbols from classes fixture", () => {
		const CLASSES_FIXTURE = resolve(
			import.meta.dir,
			"../../../fixtures/classes/tsconfig.json",
		);
		const rootDir = resolve(dirname(CLASSES_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: CLASSES_FIXTURE, rootDir });
		expectNoDiagnostics(project);

		const symbols = extractSymbols({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		validateSymbols(symbols);

		const userService = symbols.find((s) => s.name === "UserService");
		expect(userService).toBeDefined();
		expect(userService?.kind).toBe("class");
		expect(userService?.qualifiedName).toBe("UserService");
		expect(userService?.exported).toBe(true);
		expect(userService?.signatureText).toBeNull();
		expect(userService?.parameters).toEqual([]);
		expect(userService?.returnType).toBeNull();
		expect(userService?.provenance.kind).toBe("ast_node");
		expect(userService?.provenance.nodeKind).toBe("ClassDeclaration");
		expect(userService?.stableKey).toBe(
			"symbol:fixtures/classes/src/UserService.ts:class:UserService",
		);

		const ctorSymbol = symbols.find((s) => s.name === "constructor");
		expect(ctorSymbol).toBeDefined();
		expect(ctorSymbol?.kind).toBe("constructor");
		expect(ctorSymbol?.qualifiedName).toBe("UserService.constructor");
		expect(ctorSymbol?.exported).toBe(false);
		expect(ctorSymbol?.signatureText).toBe("(prefix: string)=>UserService");
		expect(ctorSymbol?.parameters.length).toBe(1);
		expect(ctorSymbol?.parameters[0].name).toBe("prefix");
		expect(ctorSymbol?.parameters[0].typeAnnotationText).toBe("string");
		expect(ctorSymbol?.parameters[0].checkerTypeText).toBe("string");
		expect(ctorSymbol?.returnType?.typeAnnotationText).toBeNull();
		expect(ctorSymbol?.returnType?.checkerTypeText).toBe("UserService");
		expect(ctorSymbol?.provenance.kind).toBe("ast_node");
		expect(ctorSymbol?.provenance.nodeKind).toBe("Constructor");
		expect(ctorSymbol?.stableKey).toBe(
			"symbol:fixtures/classes/src/UserService.ts:constructor:UserService.constructor:(prefix: string)=>UserService",
		);

		const createUser = symbols.find((s) => s.name === "createUser");
		expect(createUser).toBeDefined();
		expect(createUser?.kind).toBe("method");
		expect(createUser?.qualifiedName).toBe("UserService.createUser");
		expect(createUser?.exported).toBe(false);
		expect(createUser?.signatureText).toBe(
			"(input: CreateUserInput)=>CreateUserResult",
		);
		expect(createUser?.parameters[0].typeAnnotationText).toBe(
			"CreateUserInput",
		);
		expect(createUser?.returnType?.typeAnnotationText).toBe("CreateUserResult");
		expect(createUser?.provenance.nodeKind).toBe("MethodDeclaration");
		expect(createUser?.stableKey).toBe(
			"symbol:fixtures/classes/src/UserService.ts:method:UserService.createUser:(input: CreateUserInput)=>CreateUserResult",
		);

		const normalizeEmail = symbols.find((s) => s.name === "normalizeEmail");
		expect(normalizeEmail).toBeDefined();
		expect(normalizeEmail?.kind).toBe("method");
		expect(normalizeEmail?.qualifiedName).toBe("UserService.normalizeEmail");
		expect(normalizeEmail?.exported).toBe(false);
		expect(normalizeEmail?.signatureText).toBe("(email: string)=>string");
		expect(normalizeEmail?.provenance.nodeKind).toBe("MethodDeclaration");
	});

	test("extracts function variable symbols from function-variables fixture", () => {
		const VARS_FIXTURE = resolve(
			import.meta.dir,
			"../../../fixtures/function-variables/tsconfig.json",
		);
		const rootDir = resolve(dirname(VARS_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: VARS_FIXTURE, rootDir });
		expectNoDiagnostics(project);

		const symbols = extractSymbols({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		validateSymbols(symbols);

		const approveInvoice = symbols.find((s) => s.name === "approveInvoice");
		expect(approveInvoice).toBeDefined();
		expect(approveInvoice?.kind).toBe("function_variable");
		expect(approveInvoice?.qualifiedName).toBe("approveInvoice");
		expect(approveInvoice?.exported).toBe(true);
		expect(approveInvoice?.signatureText).toBe(
			"(input: ApproveInvoiceInput)=>ApproveInvoiceResult",
		);
		expect(approveInvoice?.parameters.length).toBe(1);
		expect(approveInvoice?.returnType).toBeDefined();
		expect(approveInvoice?.provenance.nodeKind).toBe("VariableDeclaration");
		expect(approveInvoice?.returnType?.provenance.nodeKind).toBe(
			"ArrowFunction",
		);
		expect(approveInvoice?.stableKey).toBe(
			"symbol:fixtures/function-variables/src/actions.ts:function_variable:approveInvoice:(input: ApproveInvoiceInput)=>ApproveInvoiceResult",
		);

		const rejectInvoice = symbols.find((s) => s.name === "rejectInvoice");
		expect(rejectInvoice).toBeDefined();
		expect(rejectInvoice?.kind).toBe("function_variable");
		expect(rejectInvoice?.exported).toBe(false);
		expect(rejectInvoice?.signatureText).toBe(
			"(input: ApproveInvoiceInput)=>ApproveInvoiceResult",
		);
		expect(rejectInvoice?.provenance.nodeKind).toBe("VariableDeclaration");
		expect(rejectInvoice?.returnType?.provenance.nodeKind).toBe(
			"FunctionExpression",
		);
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
