import {
	configureStore,
	type Middleware,
	type Reducer,
} from "@reduxjs/toolkit";
import {
	initRouter,
	type RouterState,
	routerModule,
} from "./modules/router/router.js";
import type {
	InferStoreState,
	PiConfig,
	PiModule,
	PiModules,
	PiStore,
} from "./types.js";

type RootWithRouter<TModules extends PiModules> = InferStoreState<TModules> & {
	router: RouterState;
};

export class Pi<TModules extends PiModules = PiModules> {
	private store: PiStore<RootWithRouter<TModules>> | null = null;

	constructor(private readonly config: PiConfig<TModules>) {}

	init(): PiStore<RootWithRouter<TModules>> {
		const allModules: Record<string, PiModule<unknown>> = {
			...this.config.modules,
			router: routerModule,
		};

		const reducers: Record<string, Reducer<unknown>> = {};
		const middleware: Middleware[] = [];

		for (const [key, module] of Object.entries(allModules)) {
			reducers[key] = module.reducer;
			if (module.middleware !== undefined) {
				middleware.push(...module.middleware);
			}
		}

		this.store = configureStore({
			reducer: reducers,
			middleware: (getDefaultMiddleware) =>
				getDefaultMiddleware({
					serializableCheck: {
						ignoredActions: ["router/navigateSuccess"],
					},
				})
					.concat(middleware)
					.concat(this.config.extraMiddleware ?? []),
		}) as PiStore<RootWithRouter<TModules>>;

		if (this.config.routes !== undefined) {
			this.store.dispatch(initRouter(this.config.routes));
		}

		return this.store;
	}

	getStore(): PiStore<RootWithRouter<TModules>> {
		if (this.store === null) {
			throw new Error("Pi not initialized. Call init() first.");
		}
		return this.store;
	}

	getState(): RootWithRouter<TModules> {
		return this.getStore().getState();
	}

	dispatch: PiStore<RootWithRouter<TModules>>["dispatch"] = (
		action: Parameters<PiStore<RootWithRouter<TModules>>["dispatch"]>[0],
	) => {
		return this.getStore().dispatch(action);
	};

	subscribe(listener: () => void): () => void {
		return this.getStore().subscribe(listener);
	}
}

export function createPi<TModules extends PiModules>(
	config: PiConfig<TModules>,
): Pi<TModules> {
	return new Pi(config);
}

export function createModule<TState>(
	key: string,
	reducer: Reducer<TState>,
	middleware: Middleware[] = [],
): PiModule<TState> {
	return { key, reducer, middleware };
}

export * from "./modules/router/router.js";
export * from "./types.js";
