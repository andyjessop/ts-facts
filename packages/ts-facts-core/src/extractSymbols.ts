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

export interface ExtractedSymbolInternal {
	fact: SymbolFact;
	declaration: ts.Node;
}

function extractParameterFacts(args: {
	rootDir: string;
	sourceFile: ts.SourceFile;
	checker: ts.TypeChecker;
	parameters: ts.NodeArray<ts.ParameterDeclaration>;
}): SymbolParameterFact[] {
	const { rootDir, sourceFile, checker, parameters } = args;
	return parameters.map((param) => {
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
}

function extractReturnTypeFact(args: {
	rootDir: string;
	sourceFile: ts.SourceFile;
	checker: ts.TypeChecker;
	declaration: ts.SignatureDeclaration;
}): SymbolReturnTypeFact | null {
	const { rootDir, sourceFile, checker, declaration } = args;
	const returnAnnotation = getTypeAnnotationText(sourceFile, declaration);
	const returnCheckerText = getReturnCheckerTypeText(checker, declaration);

	if (!returnCheckerText) {
		return null;
	}

	return {
		typeAnnotationText: returnAnnotation,
		checkerTypeText: returnCheckerText,
		provenance: makeProvenance({
			kind: "type_checker",
			rootDir,
			sourceFile,
			node: declaration,
		}),
	};
}

function buildConstructorSignatureText(args: {
	sourceFile: ts.SourceFile;
	checker: ts.TypeChecker;
	parameters: ts.NodeArray<ts.ParameterDeclaration>;
	className: string;
}): string {
	const paramParts = args.parameters.map((param) => {
		const name = param.name.getText(args.sourceFile);
		const annotation = getTypeAnnotationText(args.sourceFile, param);
		const typeText = annotation ?? getCheckerTypeText(args.checker, param);
		return `${name}: ${typeText}`;
	});

	return `(${paramParts.join(", ")})=>${args.className}`;
}

function isTopLevelVariableDeclaration(node: ts.VariableDeclaration): boolean {
	return (
		ts.isVariableDeclarationList(node.parent) &&
		ts.isVariableStatement(node.parent.parent) &&
		ts.isSourceFile(node.parent.parent.parent)
	);
}

export function extractSymbolsInternal(args: {
	rootDir: string;
	sourceFiles: readonly ts.SourceFile[];
	checker: ts.TypeChecker;
}): ExtractedSymbolInternal[] {
	const { rootDir, sourceFiles, checker } = args;
	const results: ExtractedSymbolInternal[] = [];

	function visit(
		node: ts.Node,
		sourceFile: ts.SourceFile,
		containingClass?: string,
	) {
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

			const parameters = extractParameterFacts({
				rootDir,
				sourceFile,
				checker,
				parameters: node.parameters,
			});

			const returnType = extractReturnTypeFact({
				rootDir,
				sourceFile,
				checker,
				declaration: node,
			});

			if (!returnType) {
				throw new Error(
					`Unable to determine return type for function ${name} in ${sourceFile.fileName}`,
				);
			}

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

			results.push({
				fact: {
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
				},
				declaration: node,
			});
		} else if (ts.isClassDeclaration(node) && node.name) {
			const name = node.name.text;
			const qualifiedName = name;
			const exported = isNodeExported(node, checker);

			const provenance = makeProvenance({
				kind: "ast_node",
				rootDir,
				sourceFile,
				node,
			});

			const file = toProjectRelativePath(rootDir, sourceFile.fileName);
			const stableKey = makeSymbolStableKey({
				file,
				kind: "class",
				qualifiedName,
				signatureText: null, // Classes don't have a signature
			});

			const id = makeId("sym", stableKey);

			results.push({
				fact: {
					id,
					stableKey,
					kind: "class",
					name,
					qualifiedName,
					exported,
					signatureText: null,
					parameters: [],
					returnType: null,
					provenance,
				},
				declaration: node,
			});

			// Visit class members, passing the class name
			ts.forEachChild(node, (child) => visit(child, sourceFile, name));
			return; // Don't double visit children
		} else if (
			ts.isMethodDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			containingClass
		) {
			const name = node.name.text;
			const qualifiedName = `${containingClass}.${name}`;
			const exported = false; // Methods are not individually exported

			const signatureText = buildSignatureText({
				sourceFile,
				checker,
				parameters: node.parameters,
				declaration: node,
			});

			const parameters = extractParameterFacts({
				rootDir,
				sourceFile,
				checker,
				parameters: node.parameters,
			});

			const returnType = extractReturnTypeFact({
				rootDir,
				sourceFile,
				checker,
				declaration: node,
			});

			if (!returnType) {
				throw new Error(
					`Unable to determine return type for method ${qualifiedName} in ${sourceFile.fileName}`,
				);
			}

			const provenance = makeProvenance({
				kind: "ast_node",
				rootDir,
				sourceFile,
				node,
			});

			const file = toProjectRelativePath(rootDir, sourceFile.fileName);
			const stableKey = makeSymbolStableKey({
				file,
				kind: "method",
				qualifiedName,
				signatureText,
			});

			const id = makeId("sym", stableKey);

			results.push({
				fact: {
					id,
					stableKey,
					kind: "method",
					name,
					qualifiedName,
					exported,
					signatureText,
					parameters,
					returnType,
					provenance,
				},
				declaration: node,
			});
		} else if (ts.isConstructorDeclaration(node) && containingClass) {
			const name = "constructor";
			const qualifiedName = `${containingClass}.constructor`;
			const exported = false;

			const signatureText = buildConstructorSignatureText({
				sourceFile,
				checker,
				parameters: node.parameters,
				className: containingClass,
			});

			const parameters = extractParameterFacts({
				rootDir,
				sourceFile,
				checker,
				parameters: node.parameters,
			});

			const returnType: SymbolReturnTypeFact = {
				typeAnnotationText: null,
				checkerTypeText: containingClass, // Constructor returns the class instance
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
				kind: "constructor",
				qualifiedName,
				signatureText,
			});

			const id = makeId("sym", stableKey);

			results.push({
				fact: {
					id,
					stableKey,
					kind: "constructor",
					name,
					qualifiedName,
					exported,
					signatureText,
					parameters,
					returnType,
					provenance,
				},
				declaration: node,
			});
		} else if (
			ts.isVariableDeclaration(node) &&
			isTopLevelVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.initializer
		) {
			if (
				ts.isArrowFunction(node.initializer) ||
				ts.isFunctionExpression(node.initializer)
			) {
				const name = node.name.text;
				const qualifiedName = name;
				// Exported is determined from the parent variable statement
				const exported = !!(
					node.parent?.parent &&
					ts.isVariableStatement(node.parent.parent) &&
					node.parent.parent.modifiers?.some(
						(m) => m.kind === ts.SyntaxKind.ExportKeyword,
					)
				);

				const signatureText = buildSignatureText({
					sourceFile,
					checker,
					parameters: node.initializer.parameters,
					declaration: node.initializer,
				});

				const parameters = extractParameterFacts({
					rootDir,
					sourceFile,
					checker,
					parameters: node.initializer.parameters,
				});

				const returnType = extractReturnTypeFact({
					rootDir,
					sourceFile,
					checker,
					declaration: node.initializer,
				});

				if (!returnType) {
					throw new Error(
						`Unable to determine return type for function variable ${name} in ${sourceFile.fileName}`,
					);
				}

				const provenance = makeProvenance({
					kind: "ast_node",
					rootDir,
					sourceFile,
					node,
				});

				const file = toProjectRelativePath(rootDir, sourceFile.fileName);
				const stableKey = makeSymbolStableKey({
					file,
					kind: "function_variable",
					qualifiedName,
					signatureText,
				});

				const id = makeId("sym", stableKey);

				results.push({
					fact: {
						id,
						stableKey,
						kind: "function_variable",
						name,
						qualifiedName,
						exported,
						signatureText,
						parameters,
						returnType,
						provenance,
					},
					declaration: node,
				});
			}
		}

		ts.forEachChild(node, (child) => visit(child, sourceFile, containingClass));
	}

	for (const sourceFile of sourceFiles) {
		ts.forEachChild(sourceFile, (node) => visit(node, sourceFile));
	}

	results.sort((a, b) => a.fact.stableKey.localeCompare(b.fact.stableKey));

	return results;
}

export function extractSymbols(args: {
	rootDir: string;
	sourceFiles: readonly ts.SourceFile[];
	checker: ts.TypeChecker;
}): SymbolFact[] {
	return extractSymbolsInternal(args).map((r) => r.fact);
}
