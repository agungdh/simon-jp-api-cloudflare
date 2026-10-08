import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { parseStatusAktif, toPegawaiDTO } from "../lib/pegawai";
import { requireAuth } from "../lib/session";
import { type AppContext, Pegawai, PegawaiListQuery } from "../types";

export class PegawaiList extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "List pegawai, cursor pagination untuk infinite scroll",
		request: { query: PegawaiListQuery },
		responses: {
			"200": {
				description: "Halaman pegawai",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							data: Pegawai.array(),
							nextCursor: z.number().int().nullable(),
							hasMore: z.boolean(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c);
		const data = await this.getValidatedData<typeof this.schema>();
		const q = data.query;
		const limit = q.limit ?? 20;
		const statusInt = parseStatusAktif(q.status_aktif);

		const where: string[] = [];
		const params: (string | number)[] = [];
		if (q.cursor !== undefined) {
			where.push(`id < ?`);
			params.push(q.cursor);
		}
		if (q.search) {
			where.push(`(nama LIKE ? ESCAPE '\\' OR nip LIKE ? ESCAPE '\\')`);
			const like = `%${q.search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
			params.push(like, like);
		}
		if (q.unit_kerja) {
			where.push(`unit_kerja = ?`);
			params.push(q.unit_kerja);
		}
		if (q.jabatan) {
			where.push(`jabatan = ?`);
			params.push(q.jabatan);
		}
		if (statusInt !== undefined) {
			where.push(`status_aktif = ?`);
			params.push(statusInt);
		}
		const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

		// Ambil limit+1 untuk tahu hasMore tanpa COUNT (hemat 1 query D1).
		const rows = await c.env.DB.prepare(
			`SELECT * FROM pegawai ${whereSql} ORDER BY id DESC LIMIT ?`,
		)
			.bind(...params, limit + 1)
			.all();
		const all = (rows.results as never[]).map((r) => toPegawaiDTO(r as never));
		const hasMore = all.length > limit;
		const page = hasMore ? all.slice(0, limit) : all;
		const nextCursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

		return c.json({ success: true, data: page, nextCursor, hasMore });
	}
}
