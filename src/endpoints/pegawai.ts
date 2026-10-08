import { ConflictException, ForbiddenException, NotFoundException, OpenAPIRoute, UnprocessableEntityException } from "chanfana";
import { z } from "zod";
import { PEGAWAI_SELECT, toPegawaiDTO } from "../lib/pegawai";
import { requireAuth } from "../lib/session";
import { type AppContext, Pegawai, PegawaiCreateInput, PegawaiListQuery } from "../types";

const COLUMNS = [
	"user_id",
	"bidang_id",
	"pangkat_golongan_id",
	"tipe",
	"status",
	"nip",
	"nama",
	"jabatan",
	"peran",
	"kategori_jabatan",
	"kategori_kebutuhan_jam_pelatihan",
];

function dbError(e: unknown): never {
	if (e instanceof Error) {
		if (e.message.includes("UNIQUE")) throw new ConflictException("NIP / user sudah dipakai");
		if (e.message.includes("FOREIGN KEY")) {
			throw new UnprocessableEntityException("user / bidang / pangkat tidak valid");
		}
	}
	throw e;
}

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
				content: { "application/json": { schema: Pegawai } },
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c, "admin");
		const data = await this.getValidatedData<typeof this.schema>();
		const b = data.body as Record<string, unknown>;
		try {
			const res = await c.env.DB.prepare(
				`INSERT INTO pegawai (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(() => "?").join(", ")})`,
			)
				.bind(...COLUMNS.map((col) => (b[col] as string | number | null | undefined) ?? null))
				.run();
			const id = Number(res.meta.last_row_id);
			const row = await c.env.DB.prepare(`${PEGAWAI_SELECT} WHERE p.id = ?`).bind(id).first();
			return c.json(toPegawaiDTO(row as never), 201);
		} catch (e: unknown) {
			dbError(e);
		}
	}
}

export class PegawaiList extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "List pegawai (cursor pagination, user biasa hanya miliknya)",
		request: { query: PegawaiListQuery },
		responses: {
			"200": {
				description: "Halaman pegawai",
				content: {
					"application/json": {
						schema: z.object({
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
		const sess = await requireAuth(c);
		const data = await this.getValidatedData<typeof this.schema>();
		const q = data.query;
		const limit = q.limit ?? 20;

		const where: string[] = [];
		const params: (string | number)[] = [];
		if (sess.user.role !== "admin") {
			if (sess.pegawaiId === null) throw new ForbiddenException("akun belum tertaut pegawai");
			where.push(`p.id = ?`);
			params.push(sess.pegawaiId);
		}
		if (q.cursor !== undefined) {
			where.push(`p.id < ?`);
			params.push(q.cursor);
		}
		if (q.search) {
			where.push(`(p.nama LIKE ? ESCAPE '\\' OR p.nip LIKE ? ESCAPE '\\')`);
			const like = `%${q.search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
			params.push(like, like);
		}
		if (q.status) {
			where.push(`p.status = ?`);
			params.push(q.status);
		}
		if (q.tipe) {
			where.push(`p.tipe = ?`);
			params.push(q.tipe);
		}
		if (q.bidang_id !== undefined) {
			where.push(`p.bidang_id = ?`);
			params.push(q.bidang_id);
		}
		const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
		const rows = await c.env.DB.prepare(
			`${PEGAWAI_SELECT} ${whereSql} ORDER BY p.id DESC LIMIT ?`,
		)
			.bind(...params, limit + 1)
			.all();
		const all = (rows.results as never[]).map((r) => toPegawaiDTO(r as never));
		const hasMore = all.length > limit;
		const page = hasMore ? all.slice(0, limit) : all;
		const nextCursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;
		return c.json({ data: page, nextCursor, hasMore });
	}
}

const idParams = z.object({ id: z.coerce.number().int().positive().describe("ID pegawai") });

export class PegawaiFetch extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Detail pegawai",
		request: { params: idParams },
		responses: {
			"200": {
				description: "Detail pegawai",
				content: { "application/json": { schema: Pegawai } },
			},
		},
	};

	async handle(c: AppContext) {
		const sess = await requireAuth(c);
		const data = await this.getValidatedData<typeof this.schema>();
		if (sess.user.role !== "admin" && sess.pegawaiId !== data.params.id) {
			throw new ForbiddenException("bukan milik anda");
		}
		const row = await c.env.DB.prepare(`${PEGAWAI_SELECT} WHERE p.id = ?`).bind(data.params.id).first();
		if (!row) throw new NotFoundException("pegawai tidak ditemukan");
		return c.json(toPegawaiDTO(row as never));
	}
}

export class PegawaiUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Update pegawai (admin)",
		request: {
			params: idParams,
			body: {
				content: {
					"application/json": {
						schema: PegawaiCreateInput.partial(),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Pegawai terupdate",
				content: { "application/json": { schema: Pegawai } },
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c, "admin");
		const data = await this.getValidatedData<typeof this.schema>();
		const { id } = data.params;
		const b = data.body as Record<string, unknown>;
		const keys = COLUMNS.filter((col) => b[col] !== undefined);
		if (keys.length === 0) {
			const row = await c.env.DB.prepare(`${PEGAWAI_SELECT} WHERE p.id = ?`).bind(id).first();
			if (!row) throw new NotFoundException("pegawai tidak ditemukan");
			return c.json(toPegawaiDTO(row as never));
		}
		try {
			const res = await c.env.DB.prepare(
				`UPDATE pegawai SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
			)
				.bind(...keys.map((k) => (b[k] as string | number | null) ?? null), id)
				.run();
			if ((res.meta.changes ?? 0) === 0) throw new NotFoundException("pegawai tidak ditemukan");
		} catch (e: unknown) {
			if (e instanceof NotFoundException) throw e;
			dbError(e);
		}
		const row = await c.env.DB.prepare(`${PEGAWAI_SELECT} WHERE p.id = ?`).bind(id).first();
		return c.json(toPegawaiDTO(row as never));
	}
}

export class PegawaiDelete extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Hapus pegawai + fotonya (admin)",
		request: { params: idParams },
		responses: {
			"200": {
				description: "Terhapus",
				content: { "application/json": { schema: z.object({ id: z.number().int() }) } },
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
			await c.env.SIMONJP_BUCKET.delete(row.foto_key).catch(() => {});
		}
		return c.json({ id: data.params.id });
	}
}
