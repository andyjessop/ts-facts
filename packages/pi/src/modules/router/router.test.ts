import { describe, expect, it } from "vitest";
import { createPi } from "../../pi.js";
import {
	createRoutes,
	getRouteFromUrl,
	getUrlFromRoute,
	navigateTo,
	selectRouteName,
} from "./router.js";

describe("router", () => {
	it("initializes to home on node runtime", () => {
		const app = createPi({
			modules: {},
			routes: createRoutes({
				home: { path: "/" },
				about: { path: "/about" },
			}),
		});
		const store = app.init();
		expect(selectRouteName(store.getState())).toBe("home");
	});

	it("navigates to configured routes", () => {
		const app = createPi({
			modules: {},
			routes: {
				home: { path: "/" },
				query: { path: "/query/:id" },
			},
		});
		const store = app.init();

		store.dispatch(
			navigateTo({
				name: "query",
				params: { id: "abc" },
				search: { tab: "details" },
				hash: "top",
			}),
		);

		expect(store.getState().router.route).toEqual({
			name: "query",
			params: { id: "abc" },
			search: { tab: "details" },
			hash: "top",
		});
	});

	it("parses and generates URLs", () => {
		const routes = {
			home: { path: "/" },
			file: { path: "/file/:path" },
		};
		const parsed = getRouteFromUrl(
			routes,
			"https://example.test/file/src?kind=ts#snippet",
		);
		expect(parsed).toEqual({
			name: "file",
			params: { path: "src" },
			search: { kind: "ts" },
			hash: "snippet",
		});

		const generated = getUrlFromRoute(
			routes,
			"file",
			{ path: "src" },
			{ kind: "ts" },
			"snippet",
		);
		expect(generated).toBe("/file/src?kind=ts#snippet");
	});
});
