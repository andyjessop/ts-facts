import { createHash } from "node:crypto";
import type { SymbolKind, TypeDeclarationKind } from "./schema";

/**
 * Hash text using SHA-256 and return the first `length` lowercase hex characters.
 */
export function hashText(text: string, length = 8): string {
	const hash = createHash("sha256").update(text).digest("hex");
	return hash.slice(0, length);
}

/**
 * Create a prefixed ID from a stable key.
 * Example: makeId("sym", stableKey) => "sym_8f12a91c"
 */
export function makeId(
	prefix: "sym" | "typedecl" | "call",
	stableKey: string,
): string {
	return `${prefix}_${hashText(stableKey)}`;
}

/**
 * Build a stable key for a symbol fact.
 *
 * Format:
 *   symbol:<file>:<kind>:<qualifiedName>:<signatureText>
 *
 * For class symbols (signatureText is null):
 *   symbol:<file>:class:<qualifiedName>
 */
export function makeSymbolStableKey(args: {
	file: string;
	kind: SymbolKind;
	qualifiedName: string;
	signatureText: string | null;
}): string {
	if (args.kind === "class") {
		return `symbol:${args.file}:class:${args.qualifiedName}`;
	}
	if (args.signatureText === null) {
		throw new Error("signatureText is required for non-class symbols");
	}
	return `symbol:${args.file}:${args.kind}:${args.qualifiedName}:${args.signatureText}`;
}

/**
 * Build a stable key for a type declaration fact.
 *
 * Format:
 *   type-decl:<file>:<declarationKind>:<name>:textHash_<hash>
 */
export function makeTypeDeclarationStableKey(args: {
	file: string;
	declarationKind: TypeDeclarationKind;
	name: string;
	text: string;
}): string {
	const textHash = hashText(args.text);
	return `type-decl:${args.file}:${args.declarationKind}:${args.name}:textHash_${textHash}`;
}

/**
 * Build a stable key for a call fact.
 *
 * Format:
 *   call:<from|null>:<to|null>:<file>:exprHash_<hash>:ordinal_<number>
 */
export function makeCallStableKey(args: {
	from: string | null;
	to: string | null;
	file: string;
	expressionText: string;
	ordinal: number;
}): string {
	const exprHash = hashText(args.expressionText);
	return `call:${args.from}:${args.to}:${args.file}:exprHash_${exprHash}:ordinal_${args.ordinal}`;
}
