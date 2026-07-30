import { createHash } from "node:crypto";
import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const ROOT = `${import.meta.dir}/..`;
const STAGING = resolve(ROOT, ".tmp/install-test");
const PORT = 9876;
const HOST = "host.docker.internal";

type LinuxPlatform = "linux-x64" | "linux-arm64";

function assetName(platform: LinuxPlatform): string {
	return `ts-facts-${platform}`;
}

async function commandExists(command: string): Promise<boolean> {
	const proc = Bun.spawn(["sh", "-c", `command -v ${command}`], {
		stdout: "ignore",
		stderr: "ignore",
	});
	return (await proc.exited) === 0;
}

async function detectDockerPlatform(): Promise<LinuxPlatform> {
	const proc = Bun.spawn(
		["docker", "run", "--rm", "debian:bookworm-slim", "uname", "-m"],
		{
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`Failed to detect docker platform: ${stderr}`);
	}

	const arch = (await new Response(proc.stdout).text()).trim();
	if (arch === "aarch64" || arch === "arm64") {
		return "linux-arm64";
	}
	if (arch === "x86_64" || arch === "amd64") {
		return "linux-x64";
	}

	throw new Error(`Unsupported docker platform architecture: ${arch}`);
}

async function compileBinary(platform: LinuxPlatform): Promise<string> {
	const outfile = resolve(ROOT, "release", assetName(platform));
	mkdirSync(resolve(ROOT, "release"), { recursive: true });

	console.log(`▶ Compiling ${assetName(platform)} for install test`);
	const proc = Bun.spawn(
		[
			"bun",
			"run",
			"scripts/compile-cli.ts",
			`--platform=${platform}`,
			`--out=${outfile}`,
		],
		{
			cwd: ROOT,
			stdio: ["inherit", "inherit", "inherit"],
		},
	);

	if ((await proc.exited) !== 0) {
		throw new Error(`Failed to compile ${assetName(platform)}`);
	}

	return outfile;
}

function stageRelease(binaryPath: string, platform: LinuxPlatform): string {
	const asset = assetName(platform);

	rmSync(STAGING, { recursive: true, force: true });
	mkdirSync(STAGING, { recursive: true });

	copyFileSync(binaryPath, resolve(STAGING, asset));
	copyFileSync(
		resolve(ROOT, "docs/install.sh"),
		resolve(STAGING, "install.sh"),
	);

	const bytes = readFileSync(resolve(STAGING, asset));
	const checksum = createHash("sha256").update(bytes).digest("hex");
	writeFileSync(resolve(STAGING, "checksums.txt"), `${checksum}  ${asset}\n`);

	return asset;
}

async function runInstallTest(asset: string): Promise<void> {
	const fixtureDir = resolve(ROOT, "fixtures/basic");
	const downloadUrl = `http://${HOST}:${PORT}/${asset}`;
	const checksumsUrl = `http://${HOST}:${PORT}/checksums.txt`;
	const installUrl = `http://${HOST}:${PORT}/install.sh`;

	const containerScript = [
		"set -eu",
		"apt-get update",
		"apt-get install -y --no-install-recommends curl ca-certificates",
		"rm -rf /var/lib/apt/lists/*",
		`curl -fsSL "${installUrl}" | sh`,
		"export PATH=/usr/local/bin:$PATH",
		"ts-facts --tsconfig /fixture/tsconfig.json --out /tmp/ts-static-facts.json",
		"test -s /tmp/ts-static-facts.json",
		'grep -q \'"mode": "typescript_static_facts"\' /tmp/ts-static-facts.json',
	].join("\n");

	console.log("▶ Running install.sh inside docker");
	const proc = Bun.spawn(
		[
			"docker",
			"run",
			"--rm",
			"--add-host",
			`${HOST}:host-gateway`,
			"-e",
			`TS_FACTS_DOWNLOAD_URL=${downloadUrl}`,
			"-e",
			`TS_FACTS_CHECKSUMS_URL=${checksumsUrl}`,
			"-e",
			"TS_FACTS_INSTALL_DIR=/usr/local/bin",
			"-v",
			`${fixtureDir}:/fixture:ro`,
			"debian:bookworm-slim",
			"sh",
			"-c",
			containerScript,
		],
		{
			cwd: ROOT,
			stdio: ["inherit", "inherit", "inherit"],
		},
	);

	if ((await proc.exited) !== 0) {
		throw new Error("Docker install integration test failed");
	}
}

async function main(): Promise<void> {
	if (!(await commandExists("docker"))) {
		throw new Error("docker is required for the install integration test");
	}

	const dockerInfo = Bun.spawn(["docker", "info"], {
		stdout: "ignore",
		stderr: "pipe",
	});
	if ((await dockerInfo.exited) !== 0) {
		const stderr = await new Response(dockerInfo.stderr).text();
		throw new Error(`docker is not running: ${stderr}`);
	}

	const platform = await detectDockerPlatform();
	const binaryPath = await compileBinary(platform);
	const asset = stageRelease(binaryPath, platform);

	const server = Bun.serve({
		port: PORT,
		hostname: "0.0.0.0",
		fetch(request) {
			const pathname = new URL(request.url).pathname.replace(/^\//, "");
			const filePath = resolve(STAGING, pathname);
			if (!filePath.startsWith(STAGING)) {
				return new Response("Not found", { status: 404 });
			}
			return new Response(Bun.file(filePath));
		},
	});

	try {
		await runInstallTest(asset);
		console.log("✓ install integration test passed");
	} finally {
		server.stop();
		rmSync(STAGING, { recursive: true, force: true });
	}
}

main().catch((err: unknown) => {
	if (err instanceof Error) {
		console.error(err.message);
	} else {
		console.error(String(err));
	}
	process.exit(1);
});
