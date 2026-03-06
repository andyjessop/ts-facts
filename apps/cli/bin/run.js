#!/usr/bin/env node

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

(async () => {
	const oclif = await import("@oclif/core");
	await oclif.execute({ development: false, dir: __dirname });
})();
