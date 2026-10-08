import { NotFoundException, UnprocessableEntityException } from "chanfana";
import type { AppContext } from "../types";
import { fotoKeyFor } from "../lib/pegawai";
import { requireAuth } from "../lib/session";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

async function readUpload(c: AppContext): Promise<{ bytes: ArrayBuffer; contentType: string }> {
	const ct = c.req.header("content-type") ?? "";
	if (ct.includes("multipart/form-data")) {
		const body = await c.req.parseBody();
		const f = body["foto"];
		const file = Array.isArray(f) ? f[0] : f;
		if (!(file instanceof File)) {
			throw new UnprocessableEntityException("field 'foto' wajib file");
		}
		const bytes = await file.arrayBuffer();
		return { bytes, contentType: file.type || "application/octet-stream" };
	}
	const bytes = await c.req.arrayBuffer();
	return { bytes, contentType: (ct.split(";")[0]?.trim() || "application/octet-stream") };
}

export async function fotoPut(c: AppContext) {
	await requireAuth(c, "admin");
	const id = Number(c.req.param("id"));
	if (!Number.isInteger(id) || id <= 0) throw new NotFoundException("pegawai tidak ditemukan");

	const exists = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE id = ?`).bind(id).first();
	if (!exists) throw new NotFoundException("pegawai tidak ditemukan");

	const { bytes, contentType } = await readUpload(c);
	if (!ALLOWED.has(contentType)) {
		return c.json({ success: false, error: "foto harus jpeg/png/webp" }, 400);
	}
	if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
		return c.json({ success: false, error: "ukuran foto 1 byte - 5MB" }, 400);
	}

	const key = fotoKeyFor(id);
	await c.env.SIMONJP_BUCKET.put(key, bytes, { httpMetadata: { contentType } });
	await c.env.DB.prepare(
		`UPDATE pegawai SET foto_key = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
	)
		.bind(key, id)
		.run();
	return c.json({ success: true, foto_key: key });
}

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
