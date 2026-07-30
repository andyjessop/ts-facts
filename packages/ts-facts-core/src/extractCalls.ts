import { resolve } from "node:path";
import ts from "typescript";
import { classifyCallTarget } from "./callTarget";
import { makeCallStableKey, makeId } from "./ids";
import {
	makeProvenance,
	normalizePath,
	toProjectRelativePath,
} from "./provenance";
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

	const projectFileNames = new Set(
		sourceFiles.map((sf) => normalizePath(resolve(sf.fileName))),
	);

	function visit(node: ts.Node, sourceFile: ts.SourceFile) {
		if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
			const from = findEnclosingCallableSymbol(node, symbolIndex);

			const target = classifyCallTarget({
				call: node,
				checker,
				symbolIndex,
				projectFileNames,
			});

			if (target.kind !== "builtin") {
				const to = target.kind === "project" ? target.symbol.id : null;
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
		}

		ts.forEachChild(node, (child) => visit(child, sourceFile));
	}

	for (const sourceFile of sourceFiles) {
		ts.forEachChild(sourceFile, (node) => visit(node, sourceFile));
	}

	facts.sort((a, b) => a.stableKey.localeCompare(b.stableKey));

	return facts;
}
