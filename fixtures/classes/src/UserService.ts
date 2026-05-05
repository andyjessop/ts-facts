export interface CreateUserInput {
	email: string;
}

export interface CreateUserResult {
	id: string;
	email: string;
}

export class UserService {
	constructor(private readonly prefix: string) {}

	createUser(input: CreateUserInput): CreateUserResult {
		const email = this.normalizeEmail(input.email);
		return {
			id: `${this.prefix}-1`,
			email,
		};
	}

	private normalizeEmail(email: string): string {
		return email.toLowerCase();
	}
}
