import { NotFoundException, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { toPegawaiDTO } from "../lib/pegawai";
import { requireAuth } from "../lib/session";
import { type AppContext, Pegawai } from "../types";

export class PegawaiFetch extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Detail pegawai by id",
		request: { params: z.object({ id: z.coerce.number().int().positive().describe("ID pegawai") }) },
		responses: {
			"200": {
				description: "Detail pegawai",
				content: { "application/json": { schema: z.object({ success: z.boolean(), pegawai: Pegawai }) } },
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c);
		const data = await this.getValidatedData<typeof this.schema>();
		const row = await c.env.DB.prepare(`SELECT * FROM pegawai WHERE id = ?`).bind(data.params.id).first();
		if (!row) throw new NotFoundException("pegawai tidak ditemukan");
		return c.json({ success: true, pegawai: toPegawaiDTO(row as never) });
	}
}
