import { ConflictException, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { toPegawaiDTO } from "../lib/pegawai";
import { requireAuth } from "../lib/session";
import { type AppContext, Pegawai, PegawaiCreateInput } from "../types";

export class PegawaiCreate extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Tambah pegawai (admin)",
		request: {
			body: { content: { "application/json": { schema: PegawaiCreateInput } } },
		},
		responses: {
			"201": {
				description: "Pegawai dibuat",
				content: { "application/json": { schema: z.object({ success: z.boolean(), pegawai: Pegawai }) } },
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c, "admin");
		const data = await this.getValidatedData<typeof this.schema>();
		const b = data.body;

		try {
			const res = await c.env.DB.prepare(
				`INSERT INTO pegawai (nip, nama, jabatan, unit_kerja, status_aktif) VALUES (?, ?, ?, ?, ?)`,
			)
				.bind(b.nip, b.nama, b.jabatan ?? null, b.unit_kerja ?? null, b.status_aktif ? 1 : 0)
				.run();
			const id = Number(res.meta.last_row_id);
			const row = await c.env.DB.prepare(`SELECT * FROM pegawai WHERE id = ?`).bind(id).first();
			return c.json({ success: true, pegawai: toPegawaiDTO(row as never) }, 201);
		} catch (e: unknown) {
			if (e instanceof Error && e.message.includes("UNIQUE")) {
				throw new ConflictException("NIP sudah dipakai");
			}
			throw e;
		}
	}
}
