#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
	buildSymbolIndex,
	extractCalls,
	extractSymbolsInternal,
	extractTypeDeclarations,
	loadProject,
	type StaticFactsFile,
	toProjectRelativePath,
	writeJsonFile,
} from "ts-facts-core";

function getProjectName(projectRoot: string): string {
	const pkgPath = resolve(projectRoot, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			if (pkg.name) {
				return pkg.name;
			}
		} catch {
			// ignore parse errors
		}
	}
	return basename(projectRoot);
}

async function main() {
	try {
		const { values } = parseArgs({
			options: {
				tsconfig: { type: "string" },
				out: { type: "string", default: "./ts-static-facts.json" },
				rootDir: { type: "string" },
				exclude: { type: "string", multiple: true },
			},
			strict: true,
			allowPositionals: false,
		});

		if (!values.tsconfig) {
			throw new Error("--tsconfig is required");
		}

		const excludes =
			values.exclude && values.exclude.length > 0
				? values.exclude
				: [
						"**/*.test.ts",
						"**/*.spec.ts",
						"**/__tests__/**",
						"node_modules/**",
						"dist/**",
						"build/**",
					];

		const project = loadProject({
			tsconfigPath: values.tsconfig,
			rootDir: values.rootDir,
			exclude: excludes,
		});

		const typeDeclarations = extractTypeDeclarations({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
		});

		const extractedSymbols = extractSymbolsInternal({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
		});

		const symbolIndex = buildSymbolIndex({
			extracted: extractedSymbols,
			checker: project.checker,
		});

		const calls = extractCalls({
			rootDir: project.rootDir,
			sourceFiles: project.sourceFiles,
			checker: project.checker,
			symbolIndex,
		});

		// Symbols exposed in JSON should just be the facts
		const symbols = extractedSymbols.map((e) => e.fact);

		const staticFactsFile: StaticFactsFile = {
			schemaVersion: "0.1.0",
			mode: "typescript_static_facts",
			project: {
				name: getProjectName(project.rootDir),
				root: project.rootDir,
				tsconfig: toProjectRelativePath(project.rootDir, project.tsconfigPath),
				sourceFiles: project.sourceFiles.map((f) =>
					toProjectRelativePath(project.rootDir, f.fileName),
				),
			},
			symbols,
			typeDeclarations,
			calls,
		};

		const outRaw = values.out as string;
		const outPath = isAbsolute(outRaw)
			? resolve(outRaw)
			: resolve(project.rootDir, outRaw);
		await writeJsonFile(outPath, staticFactsFile);

		console.log(`Wrote ${outPath}`);
	} catch (err: unknown) {
		if (err instanceof Error) {
			console.error(`Error: ${err.message}`);
		} else {
			console.error(String(err));
		}
		process.exit(1);
	}
}

main();
