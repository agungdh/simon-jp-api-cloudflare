import { ConflictException, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { hashPassword, generateSaltHex } from "../lib/crypto";
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
				content: { "application/json": { schema: z.object({ success: z.boolean(), user: PublicUser }) } },
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
		// Bootstrap: user pertama selalu admin agar tidak terkunci.

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
				.first<{ id: number; username: string; role: "admin" | "user"; created_at: string }>();
			return c.json({ success: true, user: row }, 201);
		} catch (e: unknown) {
			if (e instanceof Error && e.message.includes("UNIQUE")) {
				throw new ConflictException("username sudah dipakai");
			}
			throw e;
		}
	}
}
