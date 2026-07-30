import { runAll } from "./run-all";

await runAll("test:integration");

console.log("\n▶ root — bun run scripts/test-install-docker.ts");
const installTest = Bun.spawn(
	["bun", "run", "scripts/test-install-docker.ts"],
	{
		cwd: `${import.meta.dir}/..`,
		stdio: ["inherit", "inherit", "inherit"],
	},
);

if ((await installTest.exited) !== 0) {
	process.exit(1);
}
