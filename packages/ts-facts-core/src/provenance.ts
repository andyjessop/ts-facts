import { isAbsolute, relative } from "node:path";
import ts from "typescript";
import type { Provenance, ProvenanceKind } from "./schema";

/**
 * Convert an absolute file path to a project-relative POSIX path.
 */
export function toProjectRelativePath(
	rootDir: string,
	absoluteFilePath: string,
): string {
	let rel = relative(rootDir, absoluteFilePath);

	// Replace Windows backslashes with POSIX forward slashes
	rel = rel.replace(/\\/g, "/");

	// Strip leading "./"
	if (rel.startsWith("./")) {
		rel = rel.slice(2);
	}

	return rel;
}

/**
 * Check if a file is inside the project root directory.
 */
export function isInsideRoot(rootDir: string, filePath: string): boolean {
	const rel = relative(rootDir, filePath);
	// In Node.js path.relative:
	// - If it's the same path, returns ""
	// - If it's outside (parent or sibling), it starts with ".."
	// - If it's an absolute path (on different drives in Windows), it's absolute
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Get a human-readable syntax kind name for a TypeScript AST node.
 * Examples: "FunctionDeclaration", "Parameter", "CallExpression".
 */
export function getNodeKindName(node: ts.Node): string {
	return ts.SyntaxKind[node.kind] ?? `Unknown(${node.kind})`;
}

/**
 * Build a Provenance object from an AST node.
 *
 * Line and column values are one-based.
 */
export function makeProvenance(args: {
	kind: ProvenanceKind;
	rootDir: string;
	sourceFile: ts.SourceFile;
	node: ts.Node;
}): Provenance {
	const { kind, rootDir, sourceFile, node } = args;

	const file = toProjectRelativePath(rootDir, sourceFile.fileName);

	const startPos = node.getStart(sourceFile);
	const endPos = node.getEnd();

	const startLc = sourceFile.getLineAndCharacterOfPosition(startPos);
	const endLc = sourceFile.getLineAndCharacterOfPosition(endPos);

	return {
		kind,
		file,
		nodeKind: getNodeKindName(node),
		start: {
			line: startLc.line + 1,
			column: startLc.character + 1,
		},
		end: {
			line: endLc.line + 1,
			column: endLc.character + 1,
		},
	};
}
