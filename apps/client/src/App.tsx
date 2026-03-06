import { selectRouteName } from "pi";
import { useAppSelector } from "./hooks";
import { TemplatePage } from "./modules/template";

function App() {
	const currentRoute = useAppSelector(selectRouteName);

	return (
		<main className="h-screen w-full overflow-hidden">
			<div className="grid h-full min-h-0 grid-cols-1">
				<section className="overflow-y-auto p-3">
					<header className="mb-2 border-b border-border pb-2">
						<h1 className="text-sm font-bold tracking-wide uppercase text-primary">
							Oracle Client
						</h1>
						<p className="text-xs text-muted-foreground">
							Pi-driven client. Use <code>modules/template</code> as the pattern
							for new modules.
						</p>
					</header>
					{currentRoute === "home" ? <TemplatePage /> : <TemplatePage />}
				</section>
			</div>
		</main>
	);
}

export default App;
