import { NotFoundException } from "chanfana";
import type { AppContext } from "../types";
import { requireAuth } from "../lib/session";

export async function fotoGet(c: AppContext) {
	await requireAuth(c);
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) throw new NotFoundException("pegawai tidak ditemukan");

	const row = await c.env.DB.prepare(`SELECT foto_key FROM pegawai WHERE id = ?`)
		.bind(id)
		.first<{ foto_key: string | null }>();
	if (!row || !row.foto_key) throw new NotFoundException("foto tidak ditemukan");

	const obj = await c.env.SIMONJP_BUCKET.get(row.foto_key);
	if (!obj) throw new NotFoundException("foto tidak ditemukan");

	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	headers.set("cache-control", "private, max-age=3600");
	return new Response(obj.body, { headers });
}

export async function fotoDelete(c: AppContext) {
	await requireAuth(c, "admin");
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) throw new NotFoundException("pegawai tidak ditemukan");

	const row = await c.env.DB.prepare(`SELECT foto_key FROM pegawai WHERE id = ?`)
		.bind(id)
		.first<{ foto_key: string | null }>();
	if (!row) throw new NotFoundException("pegawai tidak ditemukan");
	if (row.foto_key) {
		await c.env.SIMONJP_BUCKET.delete(row.foto_key).catch(() => {});
	}
	await c.env.DB.prepare(
		`UPDATE pegawai SET foto_key = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
	)
		.bind(id)
		.run();
	return c.json({ success: true });
}
