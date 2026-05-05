import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { StaticFactsFile } from "./schema";

/**
 * Sorts all arrays within a StaticFactsFile deterministically.
 */
export function sortFactsFile(file: StaticFactsFile): StaticFactsFile {
	return {
		...file,
		project: {
			...file.project,
			sourceFiles: [...file.project.sourceFiles].sort(),
		},
		symbols: [...file.symbols].sort((a, b) =>
			a.stableKey.localeCompare(b.stableKey),
		),
		typeDeclarations: [...file.typeDeclarations].sort((a, b) =>
			a.stableKey.localeCompare(b.stableKey),
		),
		calls: [...file.calls].sort((a, b) =>
			a.stableKey.localeCompare(b.stableKey),
		),
	};
}

/**
 * Serializes the static facts file to the given path deterministically.
 * Creates intermediate directories if they do not exist.
 */
export async function writeJsonFile(
	outPath: string,
	data: StaticFactsFile,
): Promise<void> {
	const sorted = sortFactsFile(data);
	const content = `${JSON.stringify(sorted, null, 2)}\n`;

	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, content, "utf-8");
}
