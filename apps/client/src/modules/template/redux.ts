import type { Middleware } from "@reduxjs/toolkit";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { createModule, selectRouteName } from "pi";
import { getJson } from "../../lib/api";

/**
 * Template module: copy this folder when creating a new feature.
 * Demonstrates Pi patterns: slice, thunks, selectors, and route-based fetch in middleware.
 */

type RequestStatus = "idle" | "loading" | "success" | "error";

type HealthResponse = { ok: true };

export interface TemplateState {
	status: RequestStatus;
	ok: boolean | null;
	error: string | null;
}

const initialState: TemplateState = {
	status: "idle",
	ok: null,
	error: null,
};

export const fetchStatus = createAsyncThunk(
	"template/fetchStatus",
	async () => {
		return getJson<HealthResponse>("/health");
	},
);

const slice = createSlice({
	name: "template",
	initialState,
	reducers: {},
	extraReducers: (builder) => {
		builder
			.addCase(fetchStatus.pending, (state) => {
				state.status = "loading";
				state.error = null;
			})
			.addCase(fetchStatus.fulfilled, (state, action) => {
				state.status = "success";
				state.ok = action.payload.ok;
			})
			.addCase(fetchStatus.rejected, (state, action) => {
				state.status = "error";
				state.error = action.error.message ?? "Request failed";
			});
	},
});

export const selectors = {
	status: (state: { template: TemplateState }) => state.template.status,
	ok: (state: { template: TemplateState }) => state.template.ok,
	error: (state: { template: TemplateState }) => state.template.error,
};

/**
 * Middleware: fetches when user navigates to "home".
 * Data fetching lives here, NOT in useEffect in React.
 */
export const middleware: Middleware = (store) => {
	return (next) => (action) => {
		const result = next(action);
		if (
			action &&
			typeof action === "object" &&
			"type" in action &&
			(action as { type: string }).type === "router/navigateSuccess"
		) {
			const name = selectRouteName(store.getState());
			if (name === "home") {
				store.dispatch(fetchStatus() as never);
			}
		}
		return result;
	};
};

export const module = createModule("template", slice.reducer, [middleware]);
