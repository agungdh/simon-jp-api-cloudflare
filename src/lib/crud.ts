import { ConflictException, ForbiddenException, NotFoundException, OpenAPIRoute, UnprocessableEntityException } from "chanfana";
import { z } from "zod";
import { ownerFilter, requireAuth } from "./session";
import type { AppContext } from "../types";
import { ActivityListQuery } from "../types";

export type CrudConfig = {
	tag: string;
	table: string;
	singular: string;
	rowSchema: z.ZodTypeAny;
	createSchema: z.ZodTypeAny;
	updateSchema: z.ZodTypeAny;
	listQuery?: z.ZodTypeAny;
	/** Kolom writable sesuai urutan values saat INSERT */
	columns: string[];
	/** Kolom tanggal untuk filter dari/sampai, null = tanpa filter tanggal */
	dateColumn: string | null;
	/** Kolom untuk LIKE search */
	searchColumns: string[];
	/** JOIN pegawai untuk embed nama/nip */
	joinPegawai: boolean;
	/** Non-admin dibatasi ke miliknya via kolom ini (null = tanpa scoping) */
	ownerColumn: string | null;
	/** Role minimal untuk create/update/delete (null = semua user login) */
	writeRole?: "admin";
	/** Hapus objek R2 saat record dihapus */
	fileModule: string | null;
};

function escapeLike(s: string): string {
	return `%${s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function mapDbError(e: unknown, singular: string): never {
	if (e instanceof Error) {
		if (e.message.includes("UNIQUE")) throw new ConflictException(`${singular} sudah ada (duplikat)`);
		if (e.message.includes("FOREIGN KEY")) {
			throw new UnprocessableEntityException(`relasi ${singular} tidak valid`);
		}
	}
	throw e;
}

function baseTable(cfg: CrudConfig): string {
	return cfg.joinPegawai
		? `${cfg.table} t LEFT JOIN pegawai p ON p.id = t.pegawai_id`
		: `${cfg.table} t`;
}

function selectCols(cfg: CrudConfig): string {
	return cfg.joinPegawai ? `t.*, p.nama AS pegawai_nama, p.nip AS pegawai_nip` : `t.*`;
}

export function crudEndpoints(cfg: CrudConfig) {
	const listQuery = cfg.listQuery ?? ActivityListQuery;

	class List extends OpenAPIRoute {
		schema = {
			tags: [cfg.tag],
			summary: `List ${cfg.tag} (cursor pagination)`,
			request: { query: listQuery as unknown as z.ZodObject },
			responses: {
				"200": {
					description: `Halaman ${cfg.tag}`,
					content: {
						"application/json": {
							schema: z.object({
								data: z.array(cfg.rowSchema as never),
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
			const q = listQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams)) as {
				limit?: number;
				cursor?: number;
				pegawai_id?: number;
				search?: string;
				dari_tanggal?: string;
				sampai_tanggal?: string;
			};
			const limit = q.limit ?? 20;
			const where: string[] = [];
			const params: (string | number)[] = [];

			if (q.cursor !== undefined) {
				where.push(`t.id < ?`);
				params.push(q.cursor);
			}
			if (cfg.ownerColumn) {
				const own = ownerFilter(sess);
				if (own !== null) {
					where.push(`t.${cfg.ownerColumn} = ?`);
					params.push(own);
				} else if (q.pegawai_id !== undefined) {
					where.push(`t.${cfg.ownerColumn} = ?`);
					params.push(q.pegawai_id);
				}
			}
			if (q.search && cfg.searchColumns.length > 0) {
				where.push(`(${cfg.searchColumns.map((col) => `t.${col} LIKE ? ESCAPE '\\'`).join(" OR ")})`);
				const like = escapeLike(q.search);
				for (const _col of cfg.searchColumns) params.push(like);
			}
			if (cfg.dateColumn) {
				if (q.dari_tanggal) {
					where.push(`t.${cfg.dateColumn} >= ?`);
					params.push(q.dari_tanggal);
				}
				if (q.sampai_tanggal) {
					where.push(`t.${cfg.dateColumn} <= ?`);
					params.push(q.sampai_tanggal);
				}
			}
			const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
			const rows = await c.env.DB.prepare(
				`SELECT ${selectCols(cfg)} FROM ${baseTable(cfg)} ${whereSql} ORDER BY t.id DESC LIMIT ?`,
			)
				.bind(...params, limit + 1)
				.all();
			const all = rows.results as Record<string, unknown>[];
			const hasMore = all.length > limit;
			const page = hasMore ? all.slice(0, limit) : all;
			const nextCursor =
				hasMore && page.length > 0 ? (page[page.length - 1]!["id"] as number) : null;
			return c.json({ data: page, nextCursor, hasMore });
		}
	}

	class Create extends OpenAPIRoute {
		schema = {
			tags: [cfg.tag],
			summary: `Tambah ${cfg.singular}`,
			request: { body: { content: { "application/json": { schema: cfg.createSchema } } } },
			responses: {
				"201": {
					description: `${cfg.singular} dibuat`,
					content: { "application/json": { schema: cfg.rowSchema } },
				},
			},
		};

		async handle(c: AppContext) {
			const sess = await requireAuth(c, cfg.writeRole ?? undefined);
			const body = cfg.createSchema.parse(await c.req.json()) as Record<string, unknown>;
			if (cfg.ownerColumn) {
				const own = ownerFilter(sess);
				if (own !== null) {
					if (body[cfg.ownerColumn] !== undefined && body[cfg.ownerColumn] !== own) {
						throw new ForbiddenException("bukan milik anda");
					}
					body[cfg.ownerColumn] = own;
				}
			}
			try {
				const res = await c.env.DB.prepare(
					`INSERT INTO ${cfg.table} (${cfg.columns.join(", ")}) VALUES (${cfg.columns.map(() => "?").join(", ")})`,
				)
					.bind(...cfg.columns.map((col) => (body[col] as string | number | null | undefined) ?? null))
					.run();
				const id = Number(res.meta.last_row_id);
				const row = await c.env.DB.prepare(`SELECT ${selectCols(cfg)} FROM ${baseTable(cfg)} WHERE t.id = ?`)
					.bind(id)
					.first();
				return c.json(row, 201);
			} catch (e: unknown) {
				mapDbError(e, cfg.singular);
			}
		}
	}

	const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

	async function loadRow(c: AppContext, id: number): Promise<Record<string, unknown>> {
		const row = await c.env.DB.prepare(`SELECT ${selectCols(cfg)} FROM ${baseTable(cfg)} WHERE t.id = ?`)
			.bind(id)
			.first<Record<string, unknown>>();
		if (!row) throw new NotFoundException(`${cfg.singular} tidak ditemukan`);
		return row;
	}

	function assertOwner(sess: { user: { role: string }; pegawaiId: number | null }, row: Record<string, unknown>) {
		if (cfg.ownerColumn && sess.user.role !== "admin") {
			if (sess.pegawaiId === null || row[cfg.ownerColumn] !== sess.pegawaiId) {
				throw new ForbiddenException("bukan milik anda");
			}
		}
	}

	class Fetch extends OpenAPIRoute {
		schema = {
			tags: [cfg.tag],
			summary: `Detail ${cfg.singular}`,
			request: { params: paramsSchema },
			responses: {
				"200": {
					description: `Detail ${cfg.singular}`,
					content: { "application/json": { schema: cfg.rowSchema } },
				},
			},
		};

		async handle(c: AppContext) {
			const sess = await requireAuth(c);
			const id = Number(c.req.param("id"));
			const row = await loadRow(c, id);
			assertOwner(sess, row);
			return c.json(row);
		}
	}

	class Update extends OpenAPIRoute {
		schema = {
			tags: [cfg.tag],
			summary: `Update ${cfg.singular}`,
			request: {
				params: paramsSchema,
				body: { content: { "application/json": { schema: cfg.updateSchema } } },
			},
			responses: {
				"200": {
					description: `${cfg.singular} terupdate`,
					content: { "application/json": { schema: cfg.rowSchema } },
				},
			},
		};

		async handle(c: AppContext) {
			const sess = await requireAuth(c, cfg.writeRole ?? undefined);
			const id = Number(c.req.param("id"));
			const row = await loadRow(c, id);
			assertOwner(sess, row);
			const body = cfg.updateSchema.parse(await c.req.json()) as Record<string, unknown>;
			if (cfg.ownerColumn && sess.user.role !== "admin" && body[cfg.ownerColumn] !== undefined) {
				if (body[cfg.ownerColumn] !== sess.pegawaiId) throw new ForbiddenException("bukan milik anda");
			}
			const keys = cfg.columns.filter((col) => body[col] !== undefined);
			if (keys.length === 0) return c.json(row);
			try {
				await c.env.DB.prepare(
					`UPDATE ${cfg.table} SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
				)
					.bind(...keys.map((k) => (body[k] as string | number | null) ?? null), id)
					.run();
			} catch (e: unknown) {
				mapDbError(e, cfg.singular);
			}
			return c.json(await loadRow(c, id));
		}
	}

	class Delete extends OpenAPIRoute {
		schema = {
			tags: [cfg.tag],
			summary: `Hapus ${cfg.singular}`,
			request: { params: paramsSchema },
			responses: {
				"200": {
					description: "Terhapus",
					content: { "application/json": { schema: z.object({ id: z.number().int() }) } },
				},
			},
		};

		async handle(c: AppContext) {
			const sess = await requireAuth(c, cfg.writeRole ?? undefined);
			const id = Number(c.req.param("id"));
			const row = await loadRow(c, id);
			assertOwner(sess, row);
			try {
				await c.env.DB.prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).bind(id).run();
			} catch (e: unknown) {
				if (e instanceof Error && e.message.includes("FOREIGN KEY")) {
					throw new ConflictException(`${cfg.singular} masih dipakai data lain`);
				}
				throw e;
			}
			if (cfg.fileModule) {
				await c.env.SIMONJP_BUCKET.delete(`${cfg.fileModule}/${id}`).catch(() => {});
			}
			return c.json({ id });
		}
	}

	return { List, Create, Fetch, Update, Delete };
}
