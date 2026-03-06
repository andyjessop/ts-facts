import type { Middleware } from "@reduxjs/toolkit";

export type StateSyncFunction<TState> = (
	state: TState,
) => Record<string, unknown>;
export type StateRestoreFunction<TState> = (
	params: Record<string, string>,
) => Partial<TState>;

function serializeValue(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	return JSON.stringify(value);
}

function _deserializeValue(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

export function createUrlSyncMiddleware<TState>(
	moduleKey: string,
	toParams: StateSyncFunction<TState>,
	fromParams: StateRestoreFunction<TState>,
): Middleware {
	return (store) => (next) => (action) => {
		const result = next(action);

		if (typeof action !== "object" || action === null || !("type" in action)) {
			return result;
		}

		const typedAction = action as { type: string };
		if (typedAction.type === "router/navigateSuccess") {
			const fullState = store.getState() as Record<string, unknown>;
			const routerState = fullState.router as
				| { route?: { search?: Record<string, string> } }
				| undefined;
			const routeSearch = routerState?.route?.search;
			if (routeSearch !== undefined) {
				const moduleState = fromParams(routeSearch);
				store.dispatch({
					type: `${moduleKey}/restoreFromUrl`,
					payload: moduleState,
				});
			}
			return result;
		}

		if (!typedAction.type.startsWith(`${moduleKey}/`)) {
			return result;
		}

		if (typeof window === "undefined") {
			return result;
		}

		const fullState = store.getState() as Record<string, unknown>;
		const moduleState = fullState[moduleKey] as TState | undefined;
		if (moduleState === undefined) {
			return result;
		}

		const serialized = toParams(moduleState);
		const url = new URL(window.location.href);
		const currentSearchParams = new URLSearchParams(url.search);

		for (const [key, value] of Object.entries(serialized)) {
			currentSearchParams.set(`${moduleKey}.${key}`, serializeValue(value));
		}

		for (const key of currentSearchParams.keys()) {
			if (!key.startsWith(`${moduleKey}.`)) {
				continue;
			}
			const localKey = key.replace(`${moduleKey}.`, "");
			if (!(localKey in serialized)) {
				currentSearchParams.delete(key);
			}
		}

		const nextSearch = currentSearchParams.toString();
		const nextUrl = `${url.pathname}${nextSearch === "" ? "" : `?${nextSearch}`}${url.hash}`;
		window.history.replaceState({}, "", nextUrl);
		return result;
	};
}
