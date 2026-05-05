import ts from "typescript";
import { isNodeExported } from "./exported";
import { makeId, makeTypeDeclarationStableKey } from "./ids";
import { makeProvenance, toProjectRelativePath } from "./provenance";
import type { TypeDeclarationFact, TypeDeclarationKind } from "./schema";
import { getNodeText } from "./text";

export function extractTypeDeclarations(args: {
	rootDir: string;
	sourceFiles: readonly ts.SourceFile[];
}): TypeDeclarationFact[] {
	const { rootDir, sourceFiles } = args;
	const facts: TypeDeclarationFact[] = [];

	function emitTypeDeclaration(
		node:
			| ts.TypeAliasDeclaration
			| ts.InterfaceDeclaration
			| ts.EnumDeclaration,
		declarationKind: TypeDeclarationKind,
		sourceFile: ts.SourceFile,
	) {
		const name = node.name.text;
		const text = getNodeText(sourceFile, node);
		const exported = isNodeExported(node);
		const provenance = makeProvenance({
			kind: "ast_node",
			rootDir,
			sourceFile,
			node,
		});

		const file = toProjectRelativePath(rootDir, sourceFile.fileName);
		const stableKey = makeTypeDeclarationStableKey({
			file,
			declarationKind,
			name,
			text,
		});

		const id = makeId("typedecl", stableKey);

		facts.push({
			id,
			stableKey,
			name,
			declarationKind,
			exported,
			text,
			provenance,
		});
	}

	function visit(node: ts.Node, sourceFile: ts.SourceFile) {
		if (ts.isTypeAliasDeclaration(node)) {
			emitTypeDeclaration(node, "type_alias", sourceFile);
		} else if (ts.isInterfaceDeclaration(node)) {
			emitTypeDeclaration(node, "interface", sourceFile);
		} else if (ts.isEnumDeclaration(node)) {
			emitTypeDeclaration(node, "enum", sourceFile);
		}

		ts.forEachChild(node, (child) => visit(child, sourceFile));
	}

	for (const sourceFile of sourceFiles) {
		ts.forEachChild(sourceFile, (node) => visit(node, sourceFile));
	}

	facts.sort((a, b) => a.stableKey.localeCompare(b.stableKey));

	return facts;
}
