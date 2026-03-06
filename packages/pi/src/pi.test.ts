import { createSlice } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import { createModule, createPi } from "./pi.js";
import type { PiModule } from "./types.js";

describe("pi core", () => {
	it("builds a store from modules", () => {
		const counterSlice = createSlice({
			name: "counter",
			initialState: { value: 0 },
			reducers: {
				increment: (state) => {
					state.value += 1;
				},
			},
		});

		const app = createPi({
			modules: {
				counter: createModule(
					"counter",
					counterSlice.reducer,
				) as unknown as PiModule<unknown>,
			},
		});

		const store = app.init();
		const state = store.getState() as { counter: { value: number } };
		expect(state.counter.value).toBe(0);
		store.dispatch(counterSlice.actions.increment());
		const updated = store.getState() as { counter: { value: number } };
		expect(updated.counter.value).toBe(1);
	});

	it("throws before init", () => {
		const app = createPi({ modules: {} });
		expect(() => app.getStore()).toThrow("Pi not initialized");
	});
});
