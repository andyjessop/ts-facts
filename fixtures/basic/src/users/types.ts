export type LoginRequest = {
	email: string;
	password: string;
};

export type LoginResult =
	| { kind: "success"; user: User }
	| { kind: "invalid_password" }
	| { kind: "locked_account" };

export interface User {
	id: string;
	email: string;
	locked: boolean;
}

export enum UserRole {
	Admin = "admin",
	Member = "member",
}
