import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { isNodeExported } from "../src/exported";

function createSource(code: string): ts.SourceFile {
	return ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
}

describe("isNodeExported", () => {
	test("returns true for exported function", () => {
		const source = createSource("export function login() {}");
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(isNodeExported(node)).toBe(true);
	});

	test("returns false for non-exported function", () => {
		const source = createSource("function login() {}");
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(isNodeExported(node)).toBe(false);
	});

	test("returns true for exported class", () => {
		const source = createSource("export class UserService {}");
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(isNodeExported(node)).toBe(true);
	});

	test("returns false for non-exported class", () => {
		const source = createSource("class UserService {}");
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(isNodeExported(node)).toBe(false);
	});

	test("returns true for exported interface", () => {
		const source = createSource("export interface User {}");
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(isNodeExported(node)).toBe(true);
	});

	test("returns false for non-exported interface", () => {
		const source = createSource("interface User {}");
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(isNodeExported(node)).toBe(false);
	});

	test("returns true for exported enum", () => {
		const source = createSource("export enum Role { Admin }");
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(isNodeExported(node)).toBe(true);
	});

	test("returns false for non-exported enum", () => {
		const source = createSource("enum Role { Admin }");
		const node = source.statements[0];
		if (!node) throw new Error("Node not found");
		expect(isNodeExported(node)).toBe(false);
	});
});
