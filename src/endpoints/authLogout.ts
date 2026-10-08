import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { clearSessionCookie, getSession } from "../lib/session";
import type { AppContext } from "../types";

export class AuthLogout extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Logout, hapus session + cookie",
		responses: {
			"200": {
				description: "Logout sukses",
				content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const sess = await getSession(c);
		if (sess) {
			await c.env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(sess.tokenHash).run();
		}
		clearSessionCookie(c);
		return c.json({ success: true });
	}
}
