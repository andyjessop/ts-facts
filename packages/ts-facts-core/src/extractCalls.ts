import ts from "typescript";
import { makeCallStableKey, makeId } from "./ids";
import { makeProvenance, toProjectRelativePath } from "./provenance";
import type { CallFact } from "./schema";
import type { SymbolIndex } from "./symbolIndex";
import { getCheckerTypeText } from "./text";

/**
 * Traverses up from a node to find the nearest containing symbol in the index.
 * Only returns callable symbols (excludes classes).
 */
export function findEnclosingCallableSymbol(
	node: ts.Node,
	index: SymbolIndex,
): string | null {
	let current = node.parent;
	while (current) {
		const fact = index.byDeclarationNode.get(current);
		if (fact && fact.kind !== "class") {
			return fact.id;
		}
		current = current.parent;
	}
	return null;
}

/**
 * Gets candidate symbols for a call site, including property access fallback.
 */
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

/**
 * Resolves the target symbol ID for a call-like expression.
 */
export function resolveCallTarget(
	node: ts.CallExpression | ts.NewExpression,
	checker: ts.TypeChecker,
	index: SymbolIndex,
): string | null {
	// 1. Try resolved signature first (highest fidelity for overloads and constructors)
	const signature = checker.getResolvedSignature(node);
	if (signature) {
		const decl = signature.getDeclaration();
		if (decl) {
			const fact = index.byDeclarationNode.get(decl);
			if (fact) {
				return fact.id;
			}
		}
	}

	// 2. Fallback to candidate symbols (property access, etc.)
	const candidates = getCandidateSymbols(node, checker);

	for (const symbol of candidates) {
		// Try direct symbol lookup
		const fact = index.byTsSymbol.get(symbol);
		if (fact) {
			return fact.id;
		}

		// Try alias resolution
		if (symbol.flags & ts.SymbolFlags.Alias) {
			const aliased = checker.getAliasedSymbol(symbol);
			const aliasedFact = index.byTsSymbol.get(aliased);
			if (aliasedFact) {
				return aliasedFact.id;
			}
		}

		// Fallback to declarations from symbol
		const declarations = symbol.getDeclarations();
		if (declarations) {
			for (const decl of declarations) {
				const declFact = index.byDeclarationNode.get(decl);
				if (declFact) {
					return declFact.id;
				}
			}
		}
	}

	return null;
}

/**
 * Get return type text with fallback to type at location.
 */
function getCallReturnTypeText(
	checker: ts.TypeChecker,
	node: ts.CallExpression | ts.NewExpression,
): string {
	const signature = checker.getResolvedSignature(node);
	if (signature) {
		const returnType = checker.getReturnTypeOfSignature(signature);
		return checker.typeToString(returnType);
	}

	const type = checker.getTypeAtLocation(node);
	return checker.typeToString(type);
}

export function extractCalls(args: {
	rootDir: string;
	sourceFiles: readonly ts.SourceFile[];
	checker: ts.TypeChecker;
	symbolIndex: SymbolIndex;
}): CallFact[] {
	const { rootDir, sourceFiles, checker, symbolIndex } = args;
	const facts: CallFact[] = [];
	const ordinals = new Map<string, number>();

	function visit(node: ts.Node, sourceFile: ts.SourceFile) {
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
			const from = findEnclosingCallableSymbol(node, symbolIndex);
			const to = resolveCallTarget(node, checker, symbolIndex);
			const expressionText = node.getText(sourceFile);

			const file = toProjectRelativePath(rootDir, sourceFile.fileName);
			const ordinalScope = from ?? `file:${file}`;
			const ordinal = (ordinals.get(ordinalScope) ?? 0) + 1;
			ordinals.set(ordinalScope, ordinal);

			const argumentTypes = (node.arguments ?? []).map((arg) => {
				return {
					expressionText: arg.getText(sourceFile),
					checkerTypeText: getCheckerTypeText(checker, arg),
					provenance: makeProvenance({
						kind: "type_checker",
						rootDir,
						sourceFile,
						node: arg,
					}),
				};
			});

			const returnType = {
				checkerTypeText: getCallReturnTypeText(checker, node),
				provenance: makeProvenance({
					kind: "type_checker",
					rootDir,
					sourceFile,
					node,
				}),
			};

			const provenance = makeProvenance({
				kind: "ast_node",
				rootDir,
				sourceFile,
				node,
			});

			const stableKey = makeCallStableKey({
				file,
				from,
				to,
				expressionText,
				ordinal,
			});

			const id = makeId("call", stableKey);

			facts.push({
				id,
				stableKey,
				from,
				to,
				expressionText,
				argumentTypes,
				returnType,
				provenance,
			});
		}

		ts.forEachChild(node, (child) => visit(child, sourceFile));
	}

	for (const sourceFile of sourceFiles) {
		ts.forEachChild(sourceFile, (node) => visit(node, sourceFile));
	}

	facts.sort((a, b) => a.stableKey.localeCompare(b.stableKey));

	return facts;
}
