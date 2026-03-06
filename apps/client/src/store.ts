import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";
import type { PiModule, RouterState } from "pi";
import { createPi, createRoutes } from "pi";
import { module as templateModule } from "./modules/template";
import type { TemplateState } from "./modules/template/redux";

const routes = createRoutes({
	home: { path: "/" },
});

const app = createPi({
	modules: {
		template: templateModule as unknown as PiModule<unknown>,
	},
	routes,
});

export const store = app.init();
export type RootState = {
	template: TemplateState;
	router: RouterState;
};
export type AppDispatch = ThunkDispatch<RootState, undefined, UnknownAction> &
	typeof store.dispatch;
