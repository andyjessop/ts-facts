import type { LoginRequest, LoginResult, User } from "./types";

export async function login(input: LoginRequest): Promise<LoginResult> {
	const user = await findUserByEmail(input.email);

	if (!user) {
		return { kind: "invalid_password" };
	}

	if (user.locked) {
		return { kind: "locked_account" };
	}

	return { kind: "success", user };
}

async function findUserByEmail(_email: string): Promise<User | null> {
	return null;
}
