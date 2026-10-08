import { OpenAPIRoute } from "chanfana";
import { requireAuth } from "../lib/session";
import { type AppContext, PublicUser } from "../types";

export class AuthMe extends OpenAPIRoute {
	schema = {
		tags: ["Auth"],
		summary: "Cek session saat ini",
		responses: {
			"200": {
				description: "Session aktif",
				content: { "application/json": { schema: PublicUser } },
			},
		},
	};

	async handle(c: AppContext) {
		const sess = await requireAuth(c);
		return c.json(sess.user);
	}
}
