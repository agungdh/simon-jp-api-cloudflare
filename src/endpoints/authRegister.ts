import { ConflictException, OpenAPIRoute } from "chanfana";
import { generateSaltHex, hashPassword } from "../lib/crypto";
import { requireAuth } from "../lib/session";
import { type AppContext, PublicUser, RegisterInput } from "../types";

export class AuthRegister extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Register user baru (admin only, kecuali bootstrap user pertama)",
		request: {
			body: { content: { "application/json": { schema: RegisterInput } } },
		},
		responses: {
			"201": {
				description: "User dibuat",
				content: { "application/json": { schema: PublicUser } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { username, password, role } = data.body;

		const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>();
		const isBootstrap = (count?.n ?? 0) === 0;

		if (!isBootstrap) {
			await requireAuth(c, "admin");
		}

		const finalRole = isBootstrap && role !== "admin" ? "admin" : role;

		const salt = generateSaltHex();
		const password_hash = await hashPassword(password, salt);

		try {
			const res = await c.env.DB.prepare(
				`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)`,
			)
				.bind(username, password_hash, salt, finalRole)
				.run();
			const id = Number(res.meta.last_row_id);
			const row = await c.env.DB.prepare(
				`SELECT id, username, role, created_at FROM users WHERE id = ?`,
			)
				.bind(id)
				.first();
			return c.json(row, 201);
		} catch (e: unknown) {
			if (e instanceof Error && e.message.includes("UNIQUE")) {
				throw new ConflictException("username sudah dipakai");
			}
			throw e;
		}
	}
}
