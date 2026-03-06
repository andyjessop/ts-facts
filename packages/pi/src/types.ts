import type {
	EnhancedStore,
	Middleware,
	Reducer,
	ThunkAction,
	ThunkDispatch,
	UnknownAction,
} from "@reduxjs/toolkit";
import type { RouterConfig } from "./modules/router/router.js";

export interface PiModule<TState = unknown> {
	key: string;
	reducer: Reducer<TState>;
	middleware?: Middleware[];
}

export type PiModules = Record<string, PiModule<unknown>>;

export interface PiConfig<TModules extends PiModules = PiModules> {
	modules: TModules;
	routes?: RouterConfig;
	extraMiddleware?: Middleware[];
}

export type InferStoreState<TModules extends PiModules> = {
	[K in keyof TModules]: TModules[K] extends PiModule<infer TState>
		? TState
		: never;
};

export interface PiStore<TState = unknown>
	extends Omit<EnhancedStore<TState, UnknownAction>, "dispatch"> {
	dispatch: ThunkDispatch<TState, unknown, UnknownAction>;
}

export type PiThunkAction<TReturnType = void, TState = unknown> = ThunkAction<
	TReturnType,
	TState,
	unknown,
	UnknownAction
>;
