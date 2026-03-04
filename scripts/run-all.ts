import { Glob } from "bun";
import { dirname } from "node:path";

const WORKSPACE_GLOBS = ["apps/*/package.json", "packages/*/package.json"];

export async function runAll(scriptName: string): Promise<void> {
	const root = `${import.meta.dir}/..`;
	const dirs: string[] = [];

	for (const pattern of WORKSPACE_GLOBS) {
		const glob = new Glob(pattern);
		for await (const path of glob.scan({ cwd: root })) {
			dirs.push(dirname(path));
		}
	}

	dirs.sort();

	let failed = false;

	for (const dir of dirs) {
		const pkgPath = Bun.file(`${import.meta.dir}/../${dir}/package.json`);
		const pkg = await pkgPath.json();
		const hasScript = pkg.scripts?.[scriptName];

		if (!hasScript) {
			console.log(`⏭  ${dir} — no "${scriptName}" script, skipping`);
			continue;
		}

		console.log(`\n▶ ${dir} — bun run --cwd ${dir} ${scriptName}`);

		const proc = Bun.spawn(["bun", "run", "--cwd", dir, scriptName], {
			cwd: `${import.meta.dir}/..`,
			stdio: ["inherit", "inherit", "inherit"],
		});

		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			console.error(`✗ ${dir} "${scriptName}" failed (exit ${exitCode})`);
			failed = true;
		}
	}

	if (failed) {
		process.exit(1);
	}

	console.log(`\n✓ "${scriptName}" passed in all packages`);
}
