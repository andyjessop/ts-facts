#!/usr/bin/env bun

(async () => {
	const oclif = await import("@oclif/core");
	await oclif.execute({ development: true, dir: import.meta.dirname });
})();
