import { Command } from "@oclif/core";

export default class Hello extends Command {
	static summary = "Say hello (bare-bones oclif example)";

	static description =
		"Prints a greeting. Use this as a template for new commands.";

	async run(): Promise<void> {
		this.log("Hello from the CLI!");
	}
}
