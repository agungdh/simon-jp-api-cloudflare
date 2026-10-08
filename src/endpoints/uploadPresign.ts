import { ForbiddenException, InternalServerErrorException, NotFoundException, OpenAPIRoute, UnprocessableEntityException } from "chanfana";
import { z } from "zod";
import { PRESIGN_EXPIRES_IN, presignedPutUrl, readPresignConfig } from "../lib/presign";
import { ownerFilter, requireAuth } from "../lib/session";
import type { AppContext } from "../types";
import { UPLOAD_MODULES } from "../routes/download";

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

const ALLOWED_UPLOAD = [
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"text/plain",
	"application/zip",
	"application/x-rar-compressed",
];

export class UploadPresign extends OpenAPIRoute {
	schema = {
		tags: ["Upload"],
		summary: "Minta presigned URL upload arsip (lalu update record dengan filename)",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							module: z.enum(UPLOAD_MODULES as [string, ...string[]]).describe("Modul arsip"),
							record_id: z.number().int().positive().describe("ID record (buat dulu tanpa filename)"),
							contentType: z.string().max(200).describe("Tipe file yang akan diupload"),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Presigned PUT URL (5 menit)",
				content: {
					"application/json": {
						schema: z.object({
							uploadUrl: z.string(),
							key: z.string(),
							expiresIn: z.number().int(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const sess = await requireAuth(c);
		const data = await this.getValidatedData<typeof this.schema>();
		const { module, record_id, contentType } = data.body;

		if (!ALLOWED_UPLOAD.includes(contentType)) {
			throw new UnprocessableEntityException("tipe file tidak diizinkan");
		}
		const table = MODULE_TABLE[module];
		if (!table) throw new NotFoundException("modul tidak dikenal");

		const row = await c.env.DB.prepare(`SELECT pegawai_id FROM ${table} WHERE id = ?`)
			.bind(record_id)
			.first<{ pegawai_id: number }>();
		if (!row) throw new NotFoundException("record tidak ditemukan");
		if (sess.user.role !== "admin") {
			const own = ownerFilter(sess);
			if (own === null || row.pegawai_id !== own) throw new ForbiddenException("bukan milik anda");
		}

		const cfg = readPresignConfig(c.env);
		if (!cfg) throw new InternalServerErrorException("presign R2 belum dikonfigurasi (R2_* secrets)");

		const key = `${module}/${record_id}`;
		const uploadUrl = await presignedPutUrl(cfg, key, contentType);
		return c.json({ uploadUrl, key, expiresIn: PRESIGN_EXPIRES_IN });
	}
}
