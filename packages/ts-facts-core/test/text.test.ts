import { describe, expect, test } from "bun:test";
import ts from "typescript";
import {
	buildSignatureText,
	getCheckerTypeText,
	getNodeText,
	getReturnCheckerTypeText,
	getTypeAnnotationText,
} from "../src/text";

function createProgramFromSource(code: string): {
	sourceFile: ts.SourceFile;
	checker: ts.TypeChecker;
} {
	const fileName = "test-text.ts";
	const sourceFile = ts.createSourceFile(
		fileName,
		code,
		ts.ScriptTarget.Latest,
		true,
	);

	const host = ts.createCompilerHost({});
	const originalGetSourceFile = host.getSourceFile.bind(host);
	host.getSourceFile = (name, languageVersion, onError) => {
		if (name === fileName) return sourceFile;
		return originalGetSourceFile(name, languageVersion, onError);
	};
	host.fileExists = (name) => name === fileName || ts.sys.fileExists(name);
	host.readFile = (name) => (name === fileName ? code : ts.sys.readFile(name));

	const program = ts.createProgram([fileName], { strict: true }, host);
	const checker = program.getTypeChecker();
	const sf = program.getSourceFile(fileName);
	if (!sf) throw new Error("Source file not found");

	return { sourceFile: sf, checker };
}

describe("text helpers", () => {
	test("getNodeText returns source text", () => {
		const source = ts.createSourceFile(
			"test.ts",
			"function foo() {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(getNodeText(source, node)).toBe("function foo() {}");
	});

	test("getTypeAnnotationText returns annotation", () => {
		const source = ts.createSourceFile(
			"test.ts",
			"function foo(x: number) {}",
			ts.ScriptTarget.Latest,
			true,
		);
		const func = source.statements[0] as ts.FunctionDeclaration;
		const param = func.parameters[0];
		if (!param) throw new Error("Param not found");
		expect(getTypeAnnotationText(source, param)).toBe("number");
	});

	test("getCheckerTypeText returns checker-rendered text", () => {
		const { sourceFile, checker } = createProgramFromSource(
			"function foo(x: number) { return x; }",
		);
		const func = sourceFile.statements[0] as ts.FunctionDeclaration;
		const param = func.parameters[0];
		if (!param) throw new Error("Param not found");
		expect(getCheckerTypeText(checker, param)).toBe("number");
	});

	test("getReturnCheckerTypeText returns inferred return checker text", () => {
		const { sourceFile, checker } = createProgramFromSource(
			"function foo(x: number) { return String(x); }",
		);
		const func = sourceFile.statements[0] as ts.FunctionDeclaration;
		const result = getReturnCheckerTypeText(checker, func);
		expect(result).toBe("string");
	});

	test("buildSignatureText handles inferred return", () => {
		const { sourceFile, checker } = createProgramFromSource(
			"function foo(x: number) { return String(x); }",
		);
		const func = sourceFile.statements[0] as ts.FunctionDeclaration;
		const sig = buildSignatureText({
			sourceFile,
			checker,
			parameters: func.parameters,
			declaration: func,
		});
		expect(sig).toBe("(x: number)=>string");
	});

	test("buildSignatureText handles multiple parameters", () => {
		const code =
			"function foo(a: string, b: number): boolean { return a.length > b; }";
		const { sourceFile, checker } = createProgramFromSource(code);
		const func = sourceFile.statements[0] as ts.FunctionDeclaration;
		const sig = buildSignatureText({
			sourceFile,
			checker,
			parameters: func.parameters,
			declaration: func,
		});
		expect(sig).toBe("(a: string, b: number)=>boolean");
	});

	test("buildSignatureText formatting: no spaces around =>, comma-space between parameters", () => {
		const code = "function foo(a: string, b: number): void {}";
		const { sourceFile, checker } = createProgramFromSource(code);
		const func = sourceFile.statements[0] as ts.FunctionDeclaration;
		const sig = buildSignatureText({
			sourceFile,
			checker,
			parameters: func.parameters,
			declaration: func,
		});
		expect(sig).toBe("(a: string, b: number)=>void");
		expect(sig).not.toContain(" =>");
		expect(sig).not.toContain("=> ");
		expect(sig).toContain(", ");
	});
});
