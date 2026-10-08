import { ForbiddenException, NotFoundException, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { ownerFilter, requireAuth } from "../lib/session";
import type { AppContext } from "../types";

const MINIMAL_JAM: Record<string, number> = { admin: 20, pejabat: 40, auditor: 40 };

const TABLES = [
	{ tipe: "Diklat", table: "diklats", date: "dari_tanggal_pelaksanaan", jam: "jumlah_jam_pelatihan" },
	{ tipe: "PPM", table: "ppms", date: "tanggal_pelaksanaan", jam: "jumlah_jam_pelatihan" },
	{ tipe: "Seminar", table: "seminars", date: "tanggal_pelaksanaan", jam: "jumlah_jam" },
	{ tipe: "Webinar", table: "webinars", date: "tanggal_pelaksanaan", jam: "jumlah_jam" },
	{ tipe: "LC", table: "lcs", date: "tanggal_pelaksanaan", jam: "jumlah_jam" },
];

const DashboardQuery = z.object({
	tahun: z.coerce.number().int().min(2000).max(2100).optional().describe("Tahun (default tahun berjalan)"),
	pegawai_id: z.coerce.number().int().positive().optional().describe("Target pegawai (admin)"),
});

const DashboardResponse = z.object({
	pegawai: z.object({ id: z.number().int(), nip: z.string(), nama: z.string() }),
	tahun: z.number().int(),
	kategori: z.string().nullable(),
	jumlah_minimal: z.number().int(),
	jumlah_capaian: z.number().int(),
	detail_capaian: z.object({
		diklat: z.number().int(),
		ppm: z.number().int(),
		seminar: z.number().int(),
		webinar: z.number().int(),
		lc: z.number().int(),
	}),
	rekapitulasi: z.object({
		triwulan_1: z.number().int(),
		triwulan_2: z.number().int(),
		triwulan_3: z.number().int(),
		triwulan_4: z.number().int(),
	}),
	detail_items: z.array(
		z.object({
			id: z.number().int(),
			tipe: z.string(),
			tanggal: z.string(),
			materi: z.string(),
			jumlah_jam: z.number().int(),
		}),
	),
});

export class Dashboard extends OpenAPIRoute {
	schema = {
		tags: ["Dashboard"],
		summary: "Rekap jam pelatihan pegawai per tahun",
		request: { query: DashboardQuery },
		responses: {
			"200": {
				description: "Rekap dashboard",
				content: { "application/json": { schema: DashboardResponse } },
			},
		},
	};

	async handle(c: AppContext) {
		const sess = await requireAuth(c);
		const data = await this.getValidatedData<typeof this.schema>();
		const tahun = data.query.tahun ?? new Date().getFullYear();

		let pegawaiId: number;
		if (data.query.pegawai_id !== undefined) {
			if (sess.user.role !== "admin") throw new ForbiddenException("bukan milik anda");
			pegawaiId = data.query.pegawai_id;
		} else {
			const own = ownerFilter(sess);
			if (own === null) throw new ForbiddenException("tentukan pegawai_id");
			pegawaiId = own;
		}

		const pg = await c.env.DB.prepare(
			`SELECT id, nip, nama, kategori_kebutuhan_jam_pelatihan FROM pegawai WHERE id = ?`,
		)
			.bind(pegawaiId)
			.first<{ id: number; nip: string; nama: string; kategori_kebutuhan_jam_pelatihan: string | null }>();
		if (!pg) throw new NotFoundException("pegawai tidak ditemukan");

		const sums = await Promise.all(
			TABLES.map((t) =>
				c.env.DB.prepare(
					`SELECT IFNULL(SUM(${t.jam}), 0) AS s FROM ${t.table} WHERE pegawai_id = ? AND strftime('%Y', ${t.date}) = ?`,
				)
					.bind(pegawaiId, String(tahun))
					.first<{ s: number }>(),
			),
		);
		const detail = {
			diklat: sums[0]?.s ?? 0,
			ppm: sums[1]?.s ?? 0,
			seminar: sums[2]?.s ?? 0,
			webinar: sums[3]?.s ?? 0,
			lc: sums[4]?.s ?? 0,
		};

		const triwulan = await c.env.DB.prepare(
			`SELECT ${[1, 2, 3, 4]
				.map((q) => {
					const start = String((q - 1) * 3 + 1).padStart(2, "0");
					const end = String(q * 3).padStart(2, "0");
					const parts = TABLES.map(
						(t) =>
							`IFNULL((SELECT SUM(${t.jam}) FROM ${t.table} WHERE pegawai_id = p.id AND strftime('%Y', ${t.date}) = ? AND strftime('%m', ${t.date}) BETWEEN '${start}' AND '${end}'), 0)`,
					).join(" + ");
					return `(${parts}) AS triwulan_${q}`;
				})
				.join(", ")} FROM pegawai p WHERE p.id = ?`,
		)
			.bind(...[1, 2, 3, 4].flatMap(() => TABLES.map(() => String(tahun))), pegawaiId)
			.first<{ triwulan_1: number; triwulan_2: number; triwulan_3: number; triwulan_4: number }>();

		const items = (
			await Promise.all(
				TABLES.map((t) =>
					c.env.DB.prepare(
						`SELECT id, ${t.date} AS tanggal, materi_pengembangan AS materi, ${t.jam} AS jumlah_jam FROM ${t.table} WHERE pegawai_id = ? AND strftime('%Y', ${t.date}) = ? ORDER BY ${t.date}`,
					)
						.bind(pegawaiId, String(tahun))
						.all<{ id: number; tanggal: string; materi: string; jumlah_jam: number }>(),
				),
			)
		).flatMap((res, i) =>
			(res.results ?? []).map((r) => ({ id: r.id, tipe: TABLES[i]!.tipe, tanggal: r.tanggal, materi: r.materi, jumlah_jam: r.jumlah_jam })),
		);
		items.sort((a, b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0));

		const kategori = pg.kategori_kebutuhan_jam_pelatihan;
		return c.json({
			pegawai: { id: pg.id, nip: pg.nip, nama: pg.nama },
			tahun,
			kategori,
			jumlah_minimal: (kategori && MINIMAL_JAM[kategori]) || 0,
			jumlah_capaian: detail.diklat + detail.ppm + detail.seminar + detail.webinar + detail.lc,
			detail_capaian: detail,
			rekapitulasi: {
				triwulan_1: triwulan?.triwulan_1 ?? 0,
				triwulan_2: triwulan?.triwulan_2 ?? 0,
				triwulan_3: triwulan?.triwulan_3 ?? 0,
				triwulan_4: triwulan?.triwulan_4 ?? 0,
			},
			detail_items: items,
		});
	}
}
