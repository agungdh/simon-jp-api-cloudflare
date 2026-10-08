import { NotFoundException, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { requireAuth } from "../lib/session";
import type { AppContext } from "../types";

export class PegawaiDelete extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Hapus pegawai + fotonya (admin)",
		request: { params: z.object({ id: z.coerce.number().int().positive().describe("ID pegawai") }) },
		responses: {
			"200": {
				description: "Terhapus",
				content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c, "admin");
		const data = await this.getValidatedData<typeof this.schema>();
		const row = await c.env.DB.prepare(`SELECT foto_key FROM pegawai WHERE id = ?`)
			.bind(data.params.id)
			.first<{ foto_key: string | null }>();
		if (!row) throw new NotFoundException("pegawai tidak ditemukan");

		await c.env.DB.prepare(`DELETE FROM pegawai WHERE id = ?`).bind(data.params.id).run();
		if (row.foto_key) {
			await c.env.FOTO_BUCKET.delete(row.foto_key).catch(() => {});
		}
		return c.json({ success: true });
	}
}
