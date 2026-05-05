import { z } from "zod";

export function localHelper(input: string): string {
	return input.trim();
}

export function run(value: unknown, values: number[]) {
	const asJson = JSON.stringify(value);
	const parsed = JSON.parse(asJson);
	const now = new Date();
	const iso = now.toISOString();
	const max = Math.max(...values);
	const keys = Object.keys(parsed ?? {});
	const isArray = Array.isArray(values);
	const resolved = Promise.resolve(value);
	console.log(max, keys, isArray, resolved);

	localHelper(String(value));

	const schema = z.object({ id: z.string() });
	schema.parse(value);

	const action = "dynamic";
	(schema as any)[action](value);

	// Node platform API test: should be filtered
	Buffer.from("hello");

	// Nested call test: console.log should be skipped, String skipped, but localHelper kept.
	console.log(localHelper(String(value)));
}
