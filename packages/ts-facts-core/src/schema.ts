// ─── Provenance ──────────────────────────────────────────────

export type ProvenanceKind = "ast_node" | "type_checker";

export interface SourcePosition {
	line: number;
	column: number;
}

export interface Provenance {
	kind: ProvenanceKind;
	file: string;
	nodeKind: string;
	start: SourcePosition;
	end: SourcePosition;
}

// ─── Symbols ─────────────────────────────────────────────────

export type SymbolKind =
	| "function"
	| "method"
	| "constructor"
	| "class"
	| "function_variable";

export interface SymbolParameterFact {
	name: string;
	typeAnnotationText: string | null;
	checkerTypeText: string;
	provenance: Provenance;
}

export interface SymbolReturnTypeFact {
	typeAnnotationText: string | null;
	checkerTypeText: string;
	provenance: Provenance;
}

export interface SymbolFact {
	id: string;
	stableKey: string;
	kind: SymbolKind;
	name: string;
	qualifiedName: string;
	exported: boolean;
	signatureText: string | null;
	parameters: SymbolParameterFact[];
	returnType: SymbolReturnTypeFact | null;
	provenance: Provenance;
}

// ─── Type Declarations ──────────────────────────────────────

export type TypeDeclarationKind = "type_alias" | "interface" | "enum";

export interface TypeDeclarationFact {
	id: string;
	stableKey: string;
	name: string;
	declarationKind: TypeDeclarationKind;
	exported: boolean;
	text: string;
	provenance: Provenance;
}

// ─── Calls ──────────────────────────────────────────────────

export interface CallArgumentTypeFact {
	expressionText: string;
	checkerTypeText: string;
	provenance: Provenance;
}

export interface CallReturnTypeFact {
	checkerTypeText: string;
	provenance: Provenance;
}

export interface CallFact {
	id: string;
	stableKey: string;
	from: string | null;
	to: string | null;
	expressionText: string;
	argumentTypes: CallArgumentTypeFact[];
	returnType: CallReturnTypeFact;
	provenance: Provenance;
}

// ─── Top-Level Output ───────────────────────────────────────

export interface ProjectMetadata {
	name: string;
	root: string;
	tsconfig: string;
	sourceFiles: string[];
}

export interface StaticFactsFile {
	schemaVersion: "0.1.0";
	mode: "typescript_static_facts";
	project: ProjectMetadata;
	symbols: SymbolFact[];
	typeDeclarations: TypeDeclarationFact[];
	calls: CallFact[];
}
