import { InternalServerErrorException, NotFoundException, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { fotoKeyFor } from "../lib/pegawai";
import { PRESIGN_EXPIRES_IN, presignedPutUrl, readPresignConfig } from "../lib/presign";
import { requireAuth } from "../lib/session";
import type { AppContext } from "../types";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export class PegawaiFotoPresign extends OpenAPIRoute {
	schema = {
		tags: ["Pegawai"],
		summary: "Minta presigned URL untuk upload foto langsung ke R2 (admin)",
		request: {
			params: z.object({ id: z.coerce.number().int().positive().describe("ID pegawai") }),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							contentType: z.enum(ALLOWED_CONTENT_TYPES).describe("Tipe file yang akan diupload"),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Presigned PUT URL (berlaku 5 menit), lalu panggil confirm setelah upload",
				content: {
					"application/json": {
						schema: z.object({
							uploadUrl: z.string(),
							foto_key: z.string(),
							expiresIn: z.number().int(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		await requireAuth(c, "admin");
		const data = await this.getValidatedData<typeof this.schema>();
		const { id } = data.params;

		const exists = await c.env.DB.prepare(`SELECT id FROM pegawai WHERE id = ?`).bind(id).first();
		if (!exists) throw new NotFoundException("pegawai tidak ditemukan");

		const cfg = readPresignConfig(c.env);
		if (!cfg) {
			throw new InternalServerErrorException("presign R2 belum dikonfigurasi (R2_* secrets)");
		}

		const key = fotoKeyFor(id);
		const uploadUrl = await presignedPutUrl(cfg, key, data.body.contentType);
		return c.json({ uploadUrl, foto_key: key, expiresIn: PRESIGN_EXPIRES_IN });
	}
}
