import { OpenAPIRoute, UnauthorizedException } from "chanfana";
import { generateOpaqueToken, sha256Hex, verifyPassword } from "../lib/crypto";
import { SESSION_TTL_MS, setSessionCookie } from "../lib/session";
import { type AppContext, LoginInput, PublicUser } from "../types";

export class AuthLogin extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Login, set session cookie HttpOnly",
		request: {
			body: { content: { "application/json": { schema: LoginInput } } },
		},
		responses: {
			"200": {
				description: "Login sukses",
				content: { "application/json": { schema: PublicUser } },
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { username, password } = data.body;

		const row = await c.env.DB.prepare(`SELECT * FROM users WHERE username = ?`)
			.bind(username)
			.first<{ id: number; username: string; password_hash: string; salt: string; role: "admin" | "user"; created_at: string }>();
		if (!row) throw new UnauthorizedException("username atau password salah");

		const ok = await verifyPassword(password, row.salt, row.password_hash);
		if (!ok) throw new UnauthorizedException("username atau password salah");

		const rawToken = generateOpaqueToken();
		const tokenHash = await sha256Hex(rawToken);
		const now = Date.now();
		await c.env.DB.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).bind(now).run();
		await c.env.DB.prepare(
			`INSERT INTO sessions (token_hash, user_id, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?)`,
		)
			.bind(tokenHash, row.id, now + SESSION_TTL_MS, now, c.req.header("user-agent") ?? null)
			.run();

		setSessionCookie(c, rawToken);
		return c.json({
			id: row.id,
			username: row.username,
			role: row.role,
			created_at: row.created_at,
		});
	}
}
