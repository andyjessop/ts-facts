import { Button } from "../../components/ui/button";
import { useAppDispatch, useAppSelector } from "../../hooks";
import { getCoreApiBaseUrl } from "../../lib/api";
import { fetchStatus, selectors } from "./redux";

/**
 * Pure React: only useAppSelector + useAppDispatch.
 * No useEffect for data — data is fetched by middleware on route (see redux.ts).
 */
export function TemplatePage() {
	const dispatch = useAppDispatch();
	const status = useAppSelector(selectors.status);
	const ok = useAppSelector(selectors.ok);
	const error = useAppSelector(selectors.error);

	return (
		<section className="space-y-2 border bg-card p-3">
			<p className="text-xs text-muted-foreground">
				API: <code>{getCoreApiBaseUrl()}</code>
			</p>
			<div className="space-y-1 text-xs">
				<h2 className="text-xs font-bold tracking-wide uppercase text-primary">
					Template (Pi example)
				</h2>
				<p className="border-b border-border/60 py-1">
					<strong>Status:</strong> {status === "loading" && "Loading..."}
					{status === "success" && String(ok)}
					{status === "error" && "Failed"}
					{status === "idle" && "Idle"}
				</p>
				{error ? <p className="text-xs text-destructive">{error}</p> : null}
			</div>
			<Button
				type="button"
				size="sm"
				onClick={() => void dispatch(fetchStatus())}
			>
				Refresh
			</Button>
		</section>
	);
}
