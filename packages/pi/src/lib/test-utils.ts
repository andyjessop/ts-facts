export const waitForState = async <TState>(
	store: {
		getState: () => TState;
		subscribe: (listener: () => void) => () => void;
	},
	predicate: (state: TState) => boolean,
	timeout = 1000,
) => {
	return new Promise<void>((resolve, reject) => {
		const check = () => {
			if (predicate(store.getState())) {
				unsubscribe();
				resolve();
			}
		};

		const unsubscribe = store.subscribe(check);
		check(); // Check immediately in case it's already true

		setTimeout(() => {
			unsubscribe();
			reject(new Error("Timeout waiting for state condition"));
		}, timeout);
	});
};

import fs from "node:fs";
import type { Middleware } from "@reduxjs/toolkit";

/**
 * Creates a Redux middleware that logs every action and the resulting state to a JSONL file.
 * This is useful for headless debugging by agents.
 *
 * @param filePath The absolute path to the log file.
 */
export const createTraceMiddleware =
	(filePath: string): Middleware =>
	(store) =>
	(next) =>
	(action) => {
		// 1. Timestamp before action
		const timestamp = Date.now();

		// 2. Perform action
		const result = next(action);

		// 3. Capture state after action
		const state = store.getState();

		// 4. Create trace entry
		const traceEntry = {
			timestamp,
			action,
			state,
		};

		// 5. Append to file synchronously
		try {
			fs.appendFileSync(filePath, `${JSON.stringify(traceEntry)}\n`);
		} catch (error) {
			console.error("Failed to write debug trace:", error);
		}

		return result;
	};

/**
 * Creates a Redux middleware that logs every action and the resulting state to the console.
 * Use when running the app headlessly in Node (e.g. a debug script) for full visibility
 * of application behaviour without a browser.
 *
 * Import from "pi" and pass to createPi({ extraMiddleware: [createDebugMiddleware()] }).
 */
export const createDebugMiddleware =
	(): Middleware => (store) => (next) => (action) => {
		const result = next(action);
		const state = store.getState();
		console.log("[pi]", action, "→ state:", state);
		return result;
	};
