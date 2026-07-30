import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = `${import.meta.dir}/..`;
const ENTRY = resolve(ROOT, "apps/ts-facts/src/index.ts");
const OUT_DIR = resolve(ROOT, "release");

const TARGETS: Record<string, string> = {
	"darwin-arm64": "bun-darwin-arm64",
	"darwin-x64": "bun-darwin-x64",
	"linux-x64": "bun-linux-x64",
	"linux-arm64": "bun-linux-arm64",
	"windows-x64": "bun-windows-x64",
};

function detectPlatformKey(): string {
	const os = process.platform;
	const arch = process.arch;

	if (os === "darwin" && arch === "arm64") return "darwin-arm64";
	if (os === "darwin" && arch === "x64") return "darwin-x64";
	if (os === "linux" && arch === "x64") return "linux-x64";
	if (os === "linux" && arch === "arm64") return "linux-arm64";
	if (os === "win32" && arch === "x64") return "windows-x64";

	throw new Error(`Unsupported platform: ${os} ${arch}`);
}

function assetName(platformKey: string): string {
	if (platformKey === "windows-x64") {
		return "ts-facts-windows-x64.exe";
	}
	return `ts-facts-${platformKey}`;
}

async function main(): Promise<void> {
	const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
	const outArg = process.argv.find((arg) => arg.startsWith("--out="));

	const platformKey =
		platformArg?.slice("--platform=".length) ?? detectPlatformKey();
	const bunTarget = TARGETS[platformKey];

	if (!bunTarget) {
		throw new Error(`Unknown platform key: ${platformKey}`);
	}

	const outfile =
		outArg?.slice("--out=".length) ?? resolve(OUT_DIR, assetName(platformKey));
	mkdirSync(dirname(outfile), { recursive: true });

	console.log(`Compiling ts-facts for ${platformKey} → ${outfile}`);

	const proc = Bun.spawn(
		[
			"bun",
			"build",
			"--compile",
			`--target=${bunTarget}`,
			`--outfile=${outfile}`,
			ENTRY,
		],
		{
			cwd: ROOT,
			stdio: ["inherit", "inherit", "inherit"],
		},
	);

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		process.exit(exitCode);
	}

	console.log(`Done: ${outfile}`);
}

main().catch((err: unknown) => {
	if (err instanceof Error) {
		console.error(err.message);
	} else {
		console.error(String(err));
	}
	process.exit(1);
});
