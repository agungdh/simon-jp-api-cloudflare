import { ConflictException, NotFoundException, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { toPegawaiDTO } from "../lib/pegawai";
import { requireAuth } from "../lib/session";
import { type AppContext, Pegawai, PegawaiUpdateInput } from "../types";

export class PegawaiUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Update pegawai (admin)",
		request: {
			params: z.object({ id: z.coerce.number().int().positive().describe("ID pegawai") }),
			body: { content: { "application/json": { schema: PegawaiUpdateInput } } },
		},
		responses: {
			"200": {
				description: "Pegawai terupdate",
				content: { "application/json": { schema: z.object({ success: z.boolean(), pegawai: Pegawai }) } },
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c, "admin");
		const data = await this.getValidatedData<typeof this.schema>();
		const { id } = data.params;
		const b = data.body;

		const sets: string[] = [];
		const params: (string | number | null)[] = [];
		if (b.nip !== undefined) {
			sets.push("nip = ?");
			params.push(b.nip);
		}
		if (b.nama !== undefined) {
			sets.push("nama = ?");
			params.push(b.nama);
		}
		if (b.jabatan !== undefined) {
			sets.push("jabatan = ?");
			params.push(b.jabatan);
		}
		if (b.unit_kerja !== undefined) {
			sets.push("unit_kerja = ?");
			params.push(b.unit_kerja);
		}
		if (b.status_aktif !== undefined) {
			sets.push("status_aktif = ?");
			params.push(b.status_aktif ? 1 : 0);
		}
		if (sets.length === 0) {
			const row = await c.env.DB.prepare(`SELECT * FROM pegawai WHERE id = ?`).bind(id).first();
			if (!row) throw new NotFoundException("pegawai tidak ditemukan");
			return c.json({ success: true, pegawai: toPegawaiDTO(row as never) });
		}
		sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");

		try {
			const res = await c.env.DB.prepare(`UPDATE pegawai SET ${sets.join(", ")} WHERE id = ?`)
				.bind(...params, id)
				.run();
			if ((res.meta.changes ?? 0) === 0) throw new NotFoundException("pegawai tidak ditemukan");
		} catch (e: unknown) {
			if (e instanceof NotFoundException) throw e;
			if (e instanceof Error && e.message.includes("UNIQUE")) {
				throw new ConflictException("NIP sudah dipakai");
			}
			throw e;
		}
		const row = await c.env.DB.prepare(`SELECT * FROM pegawai WHERE id = ?`).bind(id).first();
		return c.json({ success: true, pegawai: toPegawaiDTO(row as never) });
	}
}
