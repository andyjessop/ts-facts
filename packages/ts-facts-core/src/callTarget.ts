import { resolve } from "node:path";
import ts from "typescript";
import { normalizePath } from "./provenance";
import type { SymbolFact } from "./schema";
import type { SymbolIndex } from "./symbolIndex";

export type CallTargetClassification =
	| { kind: "project"; symbol: SymbolFact }
	| { kind: "external"; declarationFile: string | null }
	| { kind: "builtin"; declarationFile: string | null }
	| { kind: "unresolved" };

function isBuiltinDeclarationFile(fileName: string): boolean {
	const normalized = fileName.replace(/\\/g, "/");
	const base = normalized.split("/").at(-1) ?? "";

	return (
		normalized.includes("/typescript/lib/lib.") ||
		(base.startsWith("lib.") && base.endsWith(".d.ts")) ||
		normalized.includes("/node_modules/@types/node/") ||
		normalized.includes("/node_modules/bun-types/")
	);
}

function getCandidateSymbols(
	node: ts.CallExpression | ts.NewExpression,
	checker: ts.TypeChecker,
): ts.Symbol[] {
	const symbols: ts.Symbol[] = [];

	const direct = checker.getSymbolAtLocation(node.expression);
	if (direct) {
		symbols.push(direct);
	}

	if (
		ts.isCallExpression(node) &&
		ts.isPropertyAccessExpression(node.expression)
	) {
		const property = checker.getSymbolAtLocation(node.expression.name);
		if (property && property !== direct) {
			symbols.push(property);
		}
	}

	return symbols;
}

export function getCallTargetDeclarations(args: {
	call: ts.CallExpression | ts.NewExpression;
	checker: ts.TypeChecker;
}): ts.Declaration[] {
	const { call, checker } = args;
	const declarations: ts.Declaration[] = [];
	const seen = new Set<ts.Declaration>();

	function add(decl: ts.Declaration) {
		if (!seen.has(decl)) {
			seen.add(decl);
			declarations.push(decl);
		}
	}

	// 1. Try resolved signature first
	const signature = checker.getResolvedSignature(call);
	if (signature) {
		const decl = signature.getDeclaration();
		if (decl) {
			add(decl);
		}
	}

	// 2. Fallback to candidate symbols
	const candidates = getCandidateSymbols(call, checker);

	for (const symbol of candidates) {
		let currentSymbol = symbol;

		// Try alias resolution
		if (symbol.flags & ts.SymbolFlags.Alias) {
			currentSymbol = checker.getAliasedSymbol(symbol);
		}

		// Get declarations from symbol
		const decls = currentSymbol.getDeclarations();
		if (decls) {
			for (const decl of decls) {
				add(decl);
			}
		}
	}

	return declarations;
}

/**
 * Classifies a call or new expression target into project, external, builtin, or unresolved.
 *
 * Policy:
 * - Project: Target resolves to a symbol extracted in this analysis.
 * - Built-in: Target resolves ONLY to TypeScript standard library, Node.js platform APIs (@types/node),
 *   or Bun platform APIs (bun-types).
 * - External: Target resolves to a non-built-in declaration outside project source files.
 * - Unresolved: Target has no declarations or doesn't match the above.
 */
export function classifyCallTarget(args: {
	call: ts.CallExpression | ts.NewExpression;
	checker: ts.TypeChecker;
	symbolIndex: SymbolIndex;
	projectFileNames: Set<string>;
}): CallTargetClassification {
	const { call, checker, symbolIndex, projectFileNames } = args;

	const declarations = getCallTargetDeclarations({ call, checker });

	if (declarations.length === 0) {
		return { kind: "unresolved" };
	}

	// Rule A: Extracted project symbol
	for (const decl of declarations) {
		const fact = symbolIndex.byDeclarationNode.get(decl);
		if (fact) {
			return { kind: "project", symbol: fact };
		}
	}

	// Determine if ALL declarations are built-ins
	let allBuiltins = true;
	let someBuiltin = false;
	let builtinFileName: string | null = null;
	let externalFileName: string | null = null;

	for (const decl of declarations) {
		const fileName = decl.getSourceFile().fileName;
		if (isBuiltinDeclarationFile(fileName)) {
			someBuiltin = true;
			builtinFileName = fileName;
		} else {
			allBuiltins = false;
			externalFileName = fileName;
		}
	}

	// Rule B: Built-in declaration
	if (allBuiltins && someBuiltin) {
		return { kind: "builtin", declarationFile: builtinFileName };
	}

	// Rule C: External library declaration
	// If it has a non-builtin declaration that is NOT in project source files
	for (const decl of declarations) {
		const fileName = normalizePath(resolve(decl.getSourceFile().fileName));
		if (
			!projectFileNames.has(fileName) &&
			!isBuiltinDeclarationFile(fileName)
		) {
			return { kind: "external", declarationFile: externalFileName };
		}
	}

	// Rule D: Unresolved (fallback if it didn't match project but wasn't external or built-in, though technically this means it's an un-extracted project symbol)
	return { kind: "unresolved" };
}
