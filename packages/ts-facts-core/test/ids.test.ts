import { describe, expect, test } from "bun:test";
import {
	hashText,
	makeSymbolStableKey,
	makeTypeDeclarationStableKey,
} from "../src/ids";

describe("ids", () => {
	test("hashText returns an 8-character hex string by default", () => {
		const hash = hashText("hello world");
		expect(hash).toHaveLength(8);
		expect(hash).toMatch(/^[a-f0-9]+$/);
	});

	test("makeSymbolStableKey produces the correct format for functions", () => {
		const key = makeSymbolStableKey({
			file: "src/login.ts",
			kind: "function",
			qualifiedName: "login",
			signatureText: "(input: LoginRequest)=>Promise<LoginResult>",
		});
		expect(key).toBe(
			"symbol:src/login.ts:function:login:(input: LoginRequest)=>Promise<LoginResult>",
		);
	});

	test("makeSymbolStableKey produces the correct format for class symbols", () => {
		const key = makeSymbolStableKey({
			file: "src/users.ts",
			kind: "class",
			qualifiedName: "UserService",
			signatureText: null,
		});
		expect(key).toBe("symbol:src/users.ts:class:UserService");
	});

	test("makeSymbolStableKey throws if signatureText is null for non-class", () => {
		expect(() =>
			makeSymbolStableKey({
				file: "src/login.ts",
				kind: "function",
				qualifiedName: "login",
				signatureText: null,
			}),
		).toThrow("signatureText is required for non-class symbols");
	});

	test("makeTypeDeclarationStableKey follows the correct format with type_alias", () => {
		const key = makeTypeDeclarationStableKey({
			file: "src/types.ts",
			declarationKind: "type_alias",
			name: "User",
			text: "type User = { id: string }",
		});
		expect(key).toContain("type-decl:src/types.ts:type_alias:User:textHash_");
	});
});
