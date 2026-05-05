import { dirname, resolve } from "node:path";
import picomatch from "picomatch";
import ts from "typescript";
import { isInsideRoot, toProjectRelativePath } from "./provenance";

export interface LoadProjectOptions {
	tsconfigPath: string;
	rootDir?: string;
	exclude?: string[];
}

export interface LoadedProject {
	rootDir: string;
	tsconfigPath: string;
	program: ts.Program;
	checker: ts.TypeChecker;
	sourceFiles: ts.SourceFile[];
}

/**
 * Load a TypeScript project from a tsconfig path.
 */
export function loadProject(options: LoadProjectOptions): LoadedProject {
	const tsconfigPath = resolve(options.tsconfigPath);
	const configDir = dirname(tsconfigPath);

	const rootDir = options.rootDir ? resolve(options.rootDir) : configDir;

	// Read tsconfig
	const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
	if (configFile.error) {
		const message = ts.flattenDiagnosticMessageText(
			configFile.error.messageText,
			"\n",
		);
		throw new Error(`Failed to read tsconfig: ${message}`);
	}

	// Parse tsconfig content
	const parsedConfig = ts.parseJsonConfigFileContent(
		configFile.config,
		ts.sys,
		configDir,
		undefined,
		tsconfigPath,
	);

	if (parsedConfig.errors.length > 0) {
		const message = parsedConfig.errors
			.map((diagnostic) =>
				ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
			)
			.join("\n");
		throw new Error(`Failed to parse tsconfig: ${message}`);
	}

	// Create program and checker using robust signature
	const program = ts.createProgram({
		rootNames: parsedConfig.fileNames,
		options: parsedConfig.options,
		projectReferences: parsedConfig.projectReferences,
	});
	const checker = program.getTypeChecker();

	// Build exclude matcher
	const excludePatterns = options.exclude ?? [];
	const isExcluded =
		excludePatterns.length > 0
			? picomatch(excludePatterns)
			: (_path: string) => false;

	// Filter and sort source files
	const sourceFiles = program
		.getSourceFiles()
		.filter((sf) => {
			if (sf.isDeclarationFile) return false;

			const absPath = resolve(sf.fileName);
			if (!isInsideRoot(rootDir, absPath)) return false;

			const relPath = toProjectRelativePath(rootDir, absPath);
			if (isExcluded(relPath)) return false;

			return true;
		})
		.sort((a, b) => {
			const relA = toProjectRelativePath(rootDir, resolve(a.fileName));
			const relB = toProjectRelativePath(rootDir, resolve(b.fileName));
			return relA.localeCompare(relB);
		});

	return {
		rootDir,
		tsconfigPath,
		program,
		checker,
		sourceFiles,
	};
}
