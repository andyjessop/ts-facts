import type ts from "typescript";

/**
 * Get the source text of a node.
 */
export function getNodeText(sourceFile: ts.SourceFile, node: ts.Node): string {
	return node.getText(sourceFile);
}

/**
 * Get the source text of a type annotation, if present.
 * Returns null when no explicit type annotation exists.
 */
export function getTypeAnnotationText(
	sourceFile: ts.SourceFile,
	nodeWithType: { type?: ts.TypeNode },
): string | null {
	if (nodeWithType.type) {
		return nodeWithType.type.getText(sourceFile);
	}
	return null;
}

/**
 * Get the checker-rendered type text at a node location.
 */
export function getCheckerTypeText(
	checker: ts.TypeChecker,
	node: ts.Node,
): string {
	const type = checker.getTypeAtLocation(node);
	return checker.typeToString(type);
}

/**
 * Get the checker-rendered return type text from a signature declaration.
 * Returns null if no signature is available.
 */
export function getReturnCheckerTypeText(
	checker: ts.TypeChecker,
	node: ts.SignatureDeclaration,
): string | null {
	const signature = checker.getSignatureFromDeclaration(node);
	if (!signature) {
		return null;
	}
	const returnType = checker.getReturnTypeOfSignature(signature);
	return checker.typeToString(returnType);
}

/**
 * Build a normalized signature text string.
 *
 * Format: (paramName: ParamType, second: SecondType)=>ReturnType
 *
 * - Uses explicit annotation text when present, otherwise checker type text.
 * - No spaces around `=>`.
 * - Comma-space between parameters.
 */
export function buildSignatureText(args: {
	sourceFile: ts.SourceFile;
	checker: ts.TypeChecker;
	parameters: ts.NodeArray<ts.ParameterDeclaration>;
	declaration: ts.SignatureDeclaration;
}): string {
	const { sourceFile, checker, parameters, declaration } = args;

	const paramParts: string[] = [];
	for (const param of parameters) {
		const name = param.name.getText(sourceFile);
		const annotation = getTypeAnnotationText(sourceFile, param);
		const typeText = annotation ?? getCheckerTypeText(checker, param);
		paramParts.push(`${name}: ${typeText}`);
	}

	// Return type: prefer explicit annotation, fall back to checker
	let returnText: string;
	const returnAnnotation = getTypeAnnotationText(sourceFile, declaration);
	if (returnAnnotation) {
		returnText = returnAnnotation;
	} else {
		const checkerReturn = getReturnCheckerTypeText(checker, declaration);
		if (!checkerReturn) {
			throw new Error("Unable to determine return type for signature");
		}
		returnText = checkerReturn;
	}

	return `(${paramParts.join(", ")})=>${returnText}`;
}
