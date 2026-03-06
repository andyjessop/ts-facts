import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PiModule, PiThunkAction } from "../../types.js";

export interface RouteConfig {
	path: string;
}

export type RouterConfig = Record<string, RouteConfig>;

export interface Route {
	name: string;
	params?: Record<string, string>;
	search?: Record<string, string>;
	hash?: string;
}

export interface FullRoute {
	name: string;
	params: Record<string, string>;
	search: Record<string, string>;
	hash: string;
}

export interface RouterState {
	route: FullRoute | null;
}

const initialState: RouterState = {
	route: null,
};

const routerSlice = createSlice({
	name: "router",
	initialState,
	reducers: {
		navigateSuccess: (state, action: PayloadAction<FullRoute>) => {
			state.route = action.payload;
		},
	},
});

export const { navigateSuccess } = routerSlice.actions;

let currentRouterConfig: RouterConfig | null = null;
let popstateListener: ((this: Window, event: PopStateEvent) => void) | null =
	null;

function withFallbackRoute(config: RouterConfig): RouterConfig {
	if (config.notFound !== undefined) {
		return config;
	}
	return {
		...config,
		notFound: { path: "/404" },
	};
}

function getRouterConfig(): RouterConfig {
	if (currentRouterConfig === null) {
		throw new Error("Router not initialized. Call initRouter first.");
	}
	return currentRouterConfig;
}

function splitPath(pathname: string): string[] {
	return pathname.split("/").filter(Boolean);
}

export function getRouteFromUrl(
	routes: RouterConfig,
	fullUrl: string,
): FullRoute | null {
	try {
		const url = new URL(fullUrl);
		const pathnameTokens = splitPath(decodeURIComponent(url.pathname));
		for (const [name, route] of Object.entries(routes)) {
			const routeTokens = splitPath(route.path);
			if (routeTokens.length !== pathnameTokens.length) {
				continue;
			}

			const params: Record<string, string> = {};
			let matches = true;
			for (let index = 0; index < routeTokens.length; index += 1) {
				const routeToken = routeTokens[index];
				const urlToken = pathnameTokens[index];
				if (routeToken === undefined || urlToken === undefined) {
					matches = false;
					break;
				}
				if (routeToken.startsWith(":")) {
					params[routeToken.slice(1)] = urlToken;
					continue;
				}
				if (routeToken !== urlToken) {
					matches = false;
					break;
				}
			}

			if (matches) {
				return {
					name,
					params,
					search: Object.fromEntries(url.searchParams.entries()),
					hash: decodeURIComponent(url.hash.replace("#", "")),
				};
			}
		}
		return null;
	} catch {
		return null;
	}
}

export function getUrlFromRoute(
	routes: RouterConfig,
	name: string,
	params: Record<string, string> = {},
	search: Record<string, string> = {},
	hash = "",
): string {
	const route = routes[name];
	if (route === undefined) {
		throw new Error(`Route "${name}" not found`);
	}

	let path = route.path;
	const requiredParams = route.path.match(/:(\w+)/g) ?? [];
	for (const entry of requiredParams) {
		const paramName = entry.slice(1);
		const value = params[paramName];
		if (value === undefined) {
			throw new Error(`Route "${name}" requires parameter "${paramName}"`);
		}
		path = path.replace(entry, value);
	}

	const searchString = Object.entries(search)
		.map(
			([key, value]) =>
				`${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
		)
		.join("&");
	const searchPart = searchString === "" ? "" : `?${searchString}`;
	const hashPart = hash === "" ? "" : `#${hash}`;
	return `${path}${searchPart}${hashPart}`;
}

type RouterThunk = PiThunkAction<
	void,
	{ router: RouterState } & Record<string, unknown>
>;

function getNotFoundRoute(config: RouterConfig): FullRoute {
	void config;
	return {
		name: "notFound",
		params: {},
		search: {},
		hash: "",
	};
}

export function initRouter(config: RouterConfig): RouterThunk {
	return (dispatch) => {
		const mergedConfig = withFallbackRoute(config);
		currentRouterConfig = mergedConfig;

		if (typeof window === "undefined") {
			const defaultRouteName =
				mergedConfig.home !== undefined ? "home" : Object.keys(mergedConfig)[0];
			dispatch(
				navigateSuccess({
					name: defaultRouteName ?? "notFound",
					params: {},
					search: {},
					hash: "",
				}),
			);
			return;
		}

		if (popstateListener !== null) {
			window.removeEventListener("popstate", popstateListener);
		}

		popstateListener = () => {
			const route = getRouteFromUrl(mergedConfig, window.location.href);
			dispatch(navigateSuccess(route ?? getNotFoundRoute(mergedConfig)));
		};

		window.addEventListener("popstate", popstateListener);
		const initialRoute = getRouteFromUrl(mergedConfig, window.location.href);
		dispatch(navigateSuccess(initialRoute ?? getNotFoundRoute(mergedConfig)));
	};
}

export function navigateTo(route: Route | null): RouterThunk {
	return (dispatch) => {
		const config = getRouterConfig();
		const resolved: FullRoute =
			route === null
				? getNotFoundRoute(config)
				: {
						name: route.name,
						params: route.params ?? {},
						search: route.search ?? {},
						hash: route.hash ?? "",
					};

		if (typeof window !== "undefined") {
			const url = getUrlFromRoute(
				config,
				resolved.name,
				resolved.params,
				resolved.search,
				resolved.hash,
			);
			window.history.pushState({}, "", url);
		}

		dispatch(navigateSuccess(resolved));
	};
}

export function destroyRouter(): RouterThunk {
	return () => {
		if (typeof window !== "undefined" && popstateListener !== null) {
			window.removeEventListener("popstate", popstateListener);
		}
		popstateListener = null;
		currentRouterConfig = null;
	};
}

export function selectRoute(state: { router: RouterState }): FullRoute | null {
	return state.router.route;
}

export function selectRouteName(state: {
	router: RouterState;
}): string | undefined {
	return state.router.route?.name;
}

export function selectRouteParams(state: {
	router: RouterState;
}): Record<string, string> | undefined {
	return state.router.route?.params;
}

export function selectRouteSearch(state: {
	router: RouterState;
}): Record<string, string> | undefined {
	return state.router.route?.search;
}

export function selectRouteHash(state: {
	router: RouterState;
}): string | undefined {
	return state.router.route?.hash;
}

export function createRoutes<T extends RouterConfig>(routes: T): T {
	return routes;
}

export const routerModule: PiModule<RouterState> = {
	key: "router",
	reducer: routerSlice.reducer,
	middleware: [],
};
