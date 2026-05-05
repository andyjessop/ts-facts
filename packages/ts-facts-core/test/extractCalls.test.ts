import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { extractCalls, findEnclosingCallableSymbol } from "../src/extractCalls";
import { extractSymbolsInternal } from "../src/extractSymbols";
import { loadProject } from "../src/loadProject";
import type { SymbolIndex } from "../src/symbolIndex";
import { buildSymbolIndex } from "../src/symbolIndex";

const BASIC_FIXTURE = resolve(
	import.meta.dir,
	"../../../fixtures/basic/tsconfig.json",
);

describe("findEnclosingCallableSymbol", () => {
	test("finds enclosing function for a call site in the basic fixture", () => {
		const rootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE, rootDir });

		const extracted = extractSymbolsInternal({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		const index = buildSymbolIndex({ extracted, checker: project.checker });

		// Find the 'login' function declaration
		const loginSymbol = extracted.find((s) => s.fact.name === "login");
		expect(loginSymbol).toBeDefined();

		const loginDecl = loginSymbol?.declaration as ts.FunctionDeclaration;

		// In login.ts:
		// export async function login(input: LoginRequest): Promise<LoginResult> {
		//   const user = await findUserByEmail(input.email);
		//   ...
		// }

		// Let's find the findUserByEmail call site
		let foundCallSite: ts.CallExpression | null = null;
		function findCall(node: ts.Node) {
			if (ts.isCallExpression(node)) {
				if (node.expression.getText() === "findUserByEmail") {
					foundCallSite = node;
				}
			}
			ts.forEachChild(node, findCall);
		}
		if (loginDecl) {
			findCall(loginDecl);
		}

		expect(foundCallSite).not.toBeNull();

		if (foundCallSite) {
			const enclosingId = findEnclosingCallableSymbol(foundCallSite, index);
			expect(enclosingId).toBe(loginSymbol?.fact.id ?? null);
		}
	});

	test("returns null for top-level call site", () => {
		const code = "foo();";
		const sourceFile = ts.createSourceFile(
			"test.ts",
			code,
			ts.ScriptTarget.Latest,
			true,
		);
		const callSite = (sourceFile.statements[0] as ts.ExpressionStatement)
			.expression as ts.CallExpression;

		const index: SymbolIndex = {
			byDeclarationNode: new Map(),
			byTsSymbol: new Map(),
		};
		const enclosingId = findEnclosingCallableSymbol(callSite, index);
		expect(enclosingId).toBeNull();
	});

	test("extracts and resolves calls in the basic fixture", () => {
		const rootDir = resolve(dirname(BASIC_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: BASIC_FIXTURE, rootDir });

		const extractedSymbols = extractSymbolsInternal({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		const symbolIndex = buildSymbolIndex({
			extracted: extractedSymbols,
			checker: project.checker,
		});

		const calls = extractCalls({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
			symbolIndex,
		});

		const loginSymbol = extractedSymbols.find((s) => s.fact.name === "login");
		const findUserSymbol = extractedSymbols.find(
			(s) => s.fact.name === "findUserByEmail",
		);

		const callToFindUser = calls.find(
			(c) =>
				c.from === loginSymbol?.fact.id &&
				c.expressionText.startsWith("findUserByEmail"),
		);

		expect(callToFindUser).toBeDefined();
		expect(callToFindUser?.expressionText).toBe("findUserByEmail(input.email)");
		expect(callToFindUser?.to).toBe(findUserSymbol?.fact.id);
		expect(callToFindUser?.argumentTypes.length).toBe(1);
		expect(callToFindUser?.argumentTypes[0]?.checkerTypeText).toBe("string");
		expect(callToFindUser?.returnType.checkerTypeText).toBe(
			"Promise<User | null>",
		);
		expect(callToFindUser?.provenance.kind).toBe("ast_node");
		expect(callToFindUser?.provenance.nodeKind).toBe("CallExpression");
	});

	test("extracts and resolves member calls in the classes fixture", () => {
		const CLASSES_FIXTURE = resolve(
			import.meta.dir,
			"../../../fixtures/classes/tsconfig.json",
		);
		const rootDir = resolve(dirname(CLASSES_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: CLASSES_FIXTURE, rootDir });

		const extractedSymbols = extractSymbolsInternal({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		const symbolIndex = buildSymbolIndex({
			extracted: extractedSymbols,
			checker: project.checker,
		});

		const calls = extractCalls({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
			symbolIndex,
		});

		const createUser = extractedSymbols.find(
			(s) => s.fact.name === "createUser",
		);
		const normalizeEmail = extractedSymbols.find(
			(s) => s.fact.name === "normalizeEmail",
		);

		const callToNormalize = calls.find(
			(c) =>
				c.from === createUser?.fact.id &&
				c.expressionText.startsWith("this.normalizeEmail"),
		);

		expect(callToNormalize).toBeDefined();
		expect(callToNormalize?.expressionText).toBe(
			"this.normalizeEmail(input.email)",
		);
		expect(callToNormalize?.to).toBe(normalizeEmail?.fact.id);
		expect(callToNormalize?.argumentTypes.length).toBe(1);
		expect(callToNormalize?.argumentTypes[0]?.checkerTypeText).toBe("string");
		expect(callToNormalize?.returnType.checkerTypeText).toBe("string");
	});

	test("extracts and resolves calls in the calls fixture with spec-critical checks", () => {
		const CALLS_FIXTURE = resolve(
			import.meta.dir,
			"../../../fixtures/calls/tsconfig.json",
		);
		const rootDir = resolve(dirname(CALLS_FIXTURE), "../../");
		const project = loadProject({ tsconfigPath: CALLS_FIXTURE, rootDir });

		// 0. Check diagnostics
		const diagnostics = [
			...project.program.getSyntacticDiagnostics(),
			...project.program.getSemanticDiagnostics(),
		];
		expect(
			diagnostics.map((d) => ({
				message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
				file: d.file?.fileName,
			})),
		).toEqual([]);

		const extractedSymbols = extractSymbolsInternal({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		const symbolIndex = buildSymbolIndex({
			extracted: extractedSymbols,
			checker: project.checker,
		});

		const calls = extractCalls({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
			symbolIndex,
		});

		// Global validation loop
		for (const call of calls) {
			expect(call.id).toMatch(/^call_[0-9a-f]{8}$/);
			expect(call.stableKey).toStartWith("call:");
			expect("from" in call).toBe(true);
			expect("to" in call).toBe(true);
			expect(call.expressionText).toBeTruthy();
			expect(call.argumentTypes).toBeArray();
			expect(call.returnType.checkerTypeText).toBeTruthy();
			expect(call.provenance.kind).toBe("ast_node");

			for (const arg of call.argumentTypes) {
				expect(arg.expressionText).toBeTruthy();
				expect(arg.checkerTypeText).toBeTruthy();
				expect(arg.provenance.kind).toBe("type_checker");
			}
		}

		// 1. Check expressionText (full text including arguments)
		const mainSymbol = extractedSymbols.find((s) => s.fact.name === "main");
		const greetCall = calls.find(
			(c) =>
				c.from === mainSymbol?.fact.id &&
				c.expressionText.startsWith("g.greet"),
		);
		expect(greetCall?.expressionText).toBe('g.greet("World")');

		// 2. Check top-level ordinals
		// In index.ts, we have:
		// 1. new Logger()
		// 2. logger.log(...)
		// 3. main()
		// 4. main()
		const topLevelMainCalls = calls.filter(
			(c) => c.from === null && c.expressionText === "main()",
		);
		expect(topLevelMainCalls.length).toBe(2);

		// Assert the set of ordinals, not the order in the array
		const ordinals = topLevelMainCalls
			.map((c) => {
				const match = c.stableKey.match(/:ordinal_(\d+)$/);
				return match ? match[1] : null;
			})
			.sort();
		expect(ordinals).toEqual(["3", "4"]);

		for (const call of topLevelMainCalls) {
			expect(call.from).toBeNull();
			expect(call.to).toBe(mainSymbol?.fact.id ?? null);
		}

		// 3. Check property access resolution
		const loggerCall = calls.find(
			(c) => c.from === null && c.expressionText.includes("logger.log"),
		);
		const logMethod = extractedSymbols.find((s) => s.fact.name === "log");
		expect(loggerCall?.to).toBe(logMethod?.fact.id ?? null);

		// 4. Check dynamic call resolution (should be null)
		const dynamicCall = calls.find(
			(c) =>
				c.from === mainSymbol?.fact.id && c.expressionText.includes("[action]"),
		);
		expect(dynamicCall).toBeDefined();
		expect(dynamicCall?.from).toBe(mainSymbol?.fact.id ?? null);
		expect(dynamicCall?.to).toBeNull();
		expect(dynamicCall?.argumentTypes.length).toBe(1);

		// 5. Check NewExpression extraction
		const newGreeter = calls.find(
			(c) =>
				c.from === mainSymbol?.fact.id &&
				c.expressionText.startsWith("new Greeter"),
		);
		const greeterCtor = extractedSymbols.find(
			(s) =>
				s.fact.name === "constructor" &&
				s.fact.qualifiedName.startsWith("Greeter"),
		);
		expect(newGreeter).toBeDefined();
		expect(newGreeter?.expressionText).toBe('new Greeter("Hello")');
		expect(newGreeter?.to).toBe(greeterCtor?.fact.id ?? null);
		expect(newGreeter?.from).toBe(mainSymbol?.fact.id ?? null);
		expect(newGreeter?.argumentTypes.length).toBe(1);
		expect(newGreeter?.argumentTypes[0]?.expressionText).toBe('"Hello"');
		expect(newGreeter?.argumentTypes[0]?.checkerTypeText).toBeTruthy(); // Evidence exists
		expect(newGreeter?.returnType.checkerTypeText).toBe("Greeter");
		expect(newGreeter?.provenance.nodeKind).toBe("NewExpression");

		// 6. Check external calls (console.log)
		const consoleCalls = calls.filter((c) =>
			c.expressionText.startsWith("console.log("),
		);
		expect(consoleCalls.length).toBeGreaterThan(0);
		for (const call of consoleCalls) {
			expect(call.to).toBeNull();
		}
	});

	test("class symbols are never used as from", () => {
		const code = `
			class C {
				value = makeValue();
			}
			function makeValue() { return 1; }
		`;
		const sourceFile = ts.createSourceFile(
			"test_class.ts",
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
			if (fileName === "test_class.ts") return sourceFile;
			return originalGetSourceFile(
				fileName,
				version,
				onError,
				shouldCreateNewSourceFile,
			);
		};

		const program = ts.createProgram(
			["test_class.ts"],
			{ allowJs: true },
			host,
		);
		const checker = program.getTypeChecker();

		const extracted = extractSymbolsInternal({
			rootDir: "/",
			sourceFiles: [sourceFile],
			checker,
		});

		const index = buildSymbolIndex({ extracted, checker });

		const calls = extractCalls({
			rootDir: "/",
			sourceFiles: [sourceFile],
			checker,
			symbolIndex: index,
		});

		const makeValueCall = calls.find((c) =>
			c.expressionText.startsWith("makeValue("),
		);
		expect(makeValueCall).toBeDefined();
		// 'from' should be null, because it's inside a class property but not a callable
		expect(makeValueCall?.from).toBeNull();
	});
});
