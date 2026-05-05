import ts from "typescript";
import type { ExtractedSymbolInternal } from "./extractSymbols";
import type { SymbolFact } from "./schema";

/**
 * A robust index for looking up symbol facts.
 */
export interface SymbolIndex {
	byDeclarationNode: Map<ts.Node, SymbolFact>;
	byTsSymbol: Map<ts.Symbol, SymbolFact>;
}

/**
 * Builds a SymbolIndex from extracted internal symbol records.
 */
export function buildSymbolIndex(args: {
	extracted: ExtractedSymbolInternal[];
	checker: ts.TypeChecker;
}): SymbolIndex {
	const { extracted, checker } = args;
	const byDeclarationNode = new Map<ts.Node, SymbolFact>();
	const byTsSymbol = new Map<ts.Symbol, SymbolFact>();

	for (const { fact, declaration } of extracted) {
		byDeclarationNode.set(declaration, fact);

		// Try to get the TS symbol for this declaration
		let sym: ts.Symbol | undefined;

		if (
			ts.isFunctionDeclaration(declaration) ||
			ts.isClassDeclaration(declaration) ||
			ts.isMethodDeclaration(declaration) ||
			ts.isVariableDeclaration(declaration)
		) {
			if (declaration.name) {
				sym = checker.getSymbolAtLocation(declaration.name);
			}
		} else if (ts.isConstructorDeclaration(declaration)) {
			// Constructors are primarily resolved through signature.getDeclaration()
			// but we still attempt symbol mapping for consistency.
			sym = checker.getSymbolAtLocation(declaration);
		}

		if (sym) {
			byTsSymbol.set(sym, fact);
		}
	}

	return { byDeclarationNode, byTsSymbol };
}
