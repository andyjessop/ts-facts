const DEFAULT_CORE_API_BASE_URL = "http://127.0.0.1:8787";

export function getCoreApiBaseUrl(): string {
	const url =
		import.meta.env.VITE_CORE_API_BASE_URL ?? DEFAULT_CORE_API_BASE_URL;
	return url.replace(/\/$/, "");
}

export async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(`${getCoreApiBaseUrl()}${path}`);
	if (!response.ok) {
		throw new Error(
			`Request failed: ${response.status} ${response.statusText}`,
		);
	}
	return (await response.json()) as T;
}
