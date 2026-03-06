/**
 * Headless debug script: same Pi config as the client, with createDebugMiddleware.
 * Run from repo root: bun run apps/client/scripts/debug-headless.ts
 */
import { createPi, createRoutes, createDebugMiddleware, navigateTo } from "pi";
import type { PiModule } from "pi";
import { module as templateModule } from "../src/modules/template";
import { fetchStatus } from "../src/modules/template/redux";

const routes = createRoutes({
	home: { path: "/" },
});

const app = createPi({
	modules: {
		template: templateModule as unknown as PiModule<unknown>,
	},
	routes,
	extraMiddleware: [createDebugMiddleware()],
});

const store = app.init();

async function run() {
	console.log(
		"=== 1. Navigate to home (triggers template middleware → fetchStatus) ===\n",
	);
	store.dispatch(navigateTo({ name: "home" }) as never);

	console.log("\n=== 2. Simulate button click: dispatch fetchStatus() ===\n");
	await store.dispatch(fetchStatus());

	console.log("\n=== Done ===\n");
}

run().catch(console.error);
