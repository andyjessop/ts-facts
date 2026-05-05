import ts from "typescript";

/**
 * Determine whether a declaration node is exported.
 *
 * Returns true when:
 * - The node has an `export` modifier keyword.
 * - Or, when a checker is provided, the symbol is in the exports of the source file.
 */
export function isNodeExported(
	node: ts.Node,
	checker?: ts.TypeChecker,
): boolean {
	// Check for direct export modifier
	if (ts.canHaveModifiers(node)) {
		const modifiers = ts.getModifiers(node);
		if (modifiers) {
			for (const mod of modifiers) {
				if (mod.kind === ts.SyntaxKind.ExportKeyword) {
					return true;
				}
			}
		}
	}

	// Check via checker symbol exports if available
	if (checker) {
		const symbol = getNodeSymbol(node, checker);
		if (symbol) {
			const sourceFile = node.getSourceFile();
			const sourceFileSymbol = checker.getSymbolAtLocation(sourceFile);
			if (sourceFileSymbol) {
				const exports = checker.getExportsOfModule(sourceFileSymbol);
				for (const exp of exports) {
					if (exp === symbol || exp.name === symbol.name) {
						return true;
					}
				}
			}
		}
	}

	return false;
}

function getNodeSymbol(
	node: ts.Node,
	checker: ts.TypeChecker,
): ts.Symbol | undefined {
	// For declarations with a name, use the name node
	if ("name" in node && node.name && ts.isIdentifier(node.name as ts.Node)) {
		return checker.getSymbolAtLocation(node.name as ts.Node);
	}
	return undefined;
}
