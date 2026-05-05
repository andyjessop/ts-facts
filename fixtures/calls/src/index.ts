export class Greeter {
	constructor(private readonly greeting: string) {}
	greet(name: string): string {
		return `${this.greeting}, ${name}!`;
	}
}

export function main() {
	const g = new Greeter("Hello");
	const msg = g.greet("World");
	console.log(msg);

	const action = "greet";
	(g as any)[action]("Dynamic"); // Dynamic call
}

export class Logger {
	log(msg: string) {
		console.log(msg);
	}
}

const logger = new Logger();
logger.log("Top-level property call");

// Top-level calls for ordinal testing
main();
main();
