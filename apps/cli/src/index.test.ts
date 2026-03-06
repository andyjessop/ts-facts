import { expect, test } from "bun:test";
import { add } from "./utils";

test("adds two numbers together", () => {
	expect(add(2, 3)).toBe(5);
});
