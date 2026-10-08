import { NotFoundException, OpenAPIRoute, UnprocessableEntityException } from "chanfana";
import { z } from "zod";
import { requireAuth } from "../lib/session";
import type { AppContext } from "../types";

export class PegawaiFotoConfirm extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Konfirmasi upload foto selesai (admin, panggil setelah PUT ke uploadUrl)",
		request: {
			params: z.object({ id: z.coerce.number().int().positive().describe("ID pegawai") }),
		},
		responses: {
			"200": {
				description: "Foto terkonfirmasi dan tertaut ke pegawai",
				content: {
					"application/json": { schema: z.object({ foto_key: z.string() }) },
				},
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c, "admin");
		const data = await this.getValidatedData<typeof this.schema>();
		const { id } = data.params;

		const row = await c.env.DB.prepare(`SELECT foto_key FROM pegawai WHERE id = ?`)
			.bind(id)
			.first<{ foto_key: string | null }>();
		if (!row) throw new NotFoundException("pegawai tidak ditemukan");

		const key = `pegawai/${id}.jpg`;
		const obj = await c.env.SIMONJP_BUCKET.head(key);
		if (!obj) {
			throw new UnprocessableEntityException("upload belum selesai / objek tidak ditemukan di R2");
		}

		await c.env.DB.prepare(
			`UPDATE pegawai SET foto_key = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
		)
			.bind(key, id)
			.run();
		return c.json({ foto_key: key });
	}
}
