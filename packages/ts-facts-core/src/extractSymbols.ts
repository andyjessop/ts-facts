import ts from "typescript";
import { isNodeExported } from "./exported";
import { makeId, makeSymbolStableKey } from "./ids";
import { makeProvenance, toProjectRelativePath } from "./provenance";
import type {
	SymbolFact,
	SymbolParameterFact,
	SymbolReturnTypeFact,
} from "./schema";
import {
	buildSignatureText,
	getCheckerTypeText,
	getReturnCheckerTypeText,
	getTypeAnnotationText,
} from "./text";

export function extractSymbols(args: {
	rootDir: string;
	sourceFiles: readonly ts.SourceFile[];
	checker: ts.TypeChecker;
}): SymbolFact[] {
	const { rootDir, sourceFiles, checker } = args;
	const facts: SymbolFact[] = [];

	function visit(node: ts.Node, sourceFile: ts.SourceFile) {
		if (ts.isFunctionDeclaration(node) && node.name) {
			const name = node.name.text;
			const qualifiedName = name;
			const exported = isNodeExported(node, checker);

			const signatureText = buildSignatureText({
				sourceFile,
				checker,
				parameters: node.parameters,
				declaration: node,
			});

			const parameters: SymbolParameterFact[] = node.parameters.map((param) => {
				const paramName = param.name.getText(sourceFile);
				const typeAnnotationText = getTypeAnnotationText(sourceFile, param);
				const checkerTypeText = getCheckerTypeText(checker, param);
				const paramProvenance = makeProvenance({
					kind: "type_checker",
					rootDir,
					sourceFile,
					node: param,
				});

				return {
					name: paramName,
					typeAnnotationText,
					checkerTypeText,
					provenance: paramProvenance,
				};
			});

			const returnAnnotation = getTypeAnnotationText(sourceFile, node);
			const returnCheckerText = getReturnCheckerTypeText(checker, node);

			if (!returnCheckerText) {
				throw new Error(
					`Unable to determine return type for function ${name} in ${sourceFile.fileName}`,
				);
			}

			const returnType: SymbolReturnTypeFact = {
				typeAnnotationText: returnAnnotation,
				checkerTypeText: returnCheckerText,
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

			const file = toProjectRelativePath(rootDir, sourceFile.fileName);
			const stableKey = makeSymbolStableKey({
				file,
				kind: "function",
				qualifiedName,
				signatureText,
			});

			const id = makeId("sym", stableKey);

			facts.push({
				id,
				stableKey,
				kind: "function",
				name,
				qualifiedName,
				exported,
				signatureText,
				parameters,
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
