import { ForbiddenException, NotFoundException } from "chanfana";
import type { AppContext } from "../types";
import { ownerFilter, requireAuth } from "../lib/session";

const MODULE_TABLE: Record<string, string> = {
	diklat: "diklats",
	seminar: "seminars",
	webinar: "webinars",
	lc: "lcs",
	"belajar-mandiri": "belajar_mandiris",
	mentoring: "mentorings",
	coaching: "coachings",
	workshop: "workshops",
};

export const UPLOAD_MODULES = Object.keys(MODULE_TABLE);

const MIME_MAP: Record<string, string> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	txt: "text/plain",
	zip: "application/zip",
	rar: "application/x-rar-compressed",
};

export function mimeFor(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase() ?? "";
	return MIME_MAP[ext] ?? "application/octet-stream";
}

export async function downloadArsip(c: AppContext) {
	const sess = await requireAuth(c);
	const module = c.req.param("module");
	const id = Number(c.req.param("id"));
	const table = MODULE_TABLE[module ?? ""];
	if (!table || !Number.isInteger(id) || id <= 0) throw new NotFoundException("arsip tidak ditemukan");

	const row = await c.env.DB.prepare(`SELECT pegawai_id, filename FROM ${table} WHERE id = ?`)
		.bind(id)
		.first<{ pegawai_id: number; filename: string | null }>();
	if (!row) throw new NotFoundException("arsip tidak ditemukan");
	if (sess.user.role !== "admin") {
		const own = ownerFilter(sess);
		if (own === null || row.pegawai_id !== own) throw new ForbiddenException("bukan milik anda");
	}
	if (!row.filename) throw new NotFoundException("tidak ada file terlampir");

	const obj = await c.env.SIMONJP_BUCKET.get(`${module}/${id}`);
	if (!obj) throw new NotFoundException("file tidak ditemukan");

	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	headers.set("content-type", mimeFor(row.filename));
	headers.set("content-disposition", `attachment; filename="${encodeURIComponent(row.filename)}"`);
	headers.set("cache-control", "private, max-age=3600");
	return new Response(obj.body, { headers });
}
