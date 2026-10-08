import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export type UserRole = "admin" | "user";

export const Role = z.enum(["admin", "user"]).openapi({ example: "admin" });

// ---- Auth ----
export const LoginInput = z.object({
	username: z.string().min(1).max(64).openapi({ example: "admin" }),
	password: z.string().min(1).max(200).openapi({ example: "secret123" }),
});

export const RegisterInput = z.object({
	username: z.string().min(3).max(64).openapi({ example: "operator1" }),
	password: z.string().min(8).max(200).openapi({ example: "secret12345" }),
	role: Role.default("user"),
});

export const PublicUser = z.object({
	id: z.number().int().openapi({ example: 1 }),
	username: z.string().openapi({ example: "admin" }),
	role: Role,
	created_at: z.string().openapi({ example: "2026-10-08T00:00:00.000Z" }),
});

// ---- Master ----
export const Bidang = z.object({
	id: z.number().int(),
	bidang: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
});
export const BidangInput = z.object({
	bidang: z.string().min(1).max(200).openapi({ example: "Bidang Pengawasan" }),
});

export const PangkatGolongan = z.object({
	id: z.number().int(),
	jenjang: z.string(),
	pangkat: z.string(),
	golongan: z.string(),
	ruang: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
});
export const PangkatGolonganInput = z.object({
	jenjang: z.string().min(1).max(100).openapi({ example: "Pembina" }),
	pangkat: z.string().min(1).max(100).openapi({ example: "Penata Tingkat I" }),
	golongan: z.string().min(1).max(20).openapi({ example: "III/d" }),
	ruang: z.string().min(1).max(20).openapi({ example: "III/d" }),
});

export const JenisPelatihan = z.object({
	id: z.number().int(),
	jenis_pelatihan: z.string(),
	created_at: z.string(),
	updated_at: z.string(),
});
export const JenisPelatihanInput = z.object({
	jenis_pelatihan: z.string().min(1).max(200).openapi({ example: "Diklat Teknis" }),
});

// ---- Pegawai ----
export const TipePegawai = z.enum(["pegawai", "admin"]).openapi({ example: "pegawai" });
export const StatusPegawai = z.enum(["aktif", "non aktif"]).openapi({ example: "aktif" });
export const KategoriJabatan = z
	.enum(["struktural", "fungsional auditor", "fungsional tertentu"])
	.openapi({ example: "fungsional auditor" });
export const KategoriJam = z.enum(["admin", "pejabat", "auditor"]).openapi({ example: "auditor" });

export const Pegawai = z.object({
	id: z.number().int(),
	user_id: z.number().int().nullable(),
	bidang_id: z.number().int().nullable(),
	pangkat_golongan_id: z.number().int().nullable(),
	tipe: TipePegawai,
	status: StatusPegawai,
	nip: z.string(),
	nama: z.string(),
	jabatan: z.string().nullable(),
	peran: z.string().nullable(),
	kategori_jabatan: KategoriJabatan.nullable(),
	kategori_kebutuhan_jam_pelatihan: KategoriJam.nullable(),
	foto_key: z.string().nullable(),
	bidang: z.string().nullable().describe("Nama bidang (join)"),
	pangkat_golongan: z.string().nullable().describe("Pangkat/golongan (join)"),
	created_at: z.string(),
	updated_at: z.string(),
});

export const PegawaiCreateInput = z.object({
	user_id: z.number().int().positive().nullish().openapi({ example: 1 }),
	bidang_id: z.number().int().positive().nullish().openapi({ example: 1 }),
	pangkat_golongan_id: z.number().int().positive().nullish().openapi({ example: 1 }),
	tipe: TipePegawai.default("pegawai"),
	status: StatusPegawai.default("aktif"),
	nip: z.string().min(1).max(64).openapi({ example: "198501012010011001" }),
	nama: z.string().min(1).max(200).openapi({ example: "Budi Santoso" }),
	jabatan: z.string().max(200).nullish(),
	peran: z.string().max(200).nullish(),
	kategori_jabatan: KategoriJabatan.nullish(),
	kategori_kebutuhan_jam_pelatihan: KategoriJam.nullish(),
});

export const PegawaiUpdateInput = PegawaiCreateInput.partial().omit({ nip: true }).extend({
	nip: z.string().min(1).max(64).optional(),
});

export const PegawaiListQuery = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	cursor: z.coerce.number().int().positive().optional().describe("ID terakhir halaman sebelumnya"),
	search: z.string().max(200).optional().describe("Cari nama / NIP"),
	status: StatusPegawai.optional(),
	tipe: TipePegawai.optional(),
	bidang_id: z.coerce.number().int().positive().optional(),
});

// ---- Aktivitas (7 tabel identik + diklat/ppm/materi) ----
const timestamps = {
	created_at: z.string(),
	updated_at: z.string(),
};

export const ActivityBase = z.object({
	id: z.number().int(),
	pegawai_id: z.number().int(),
	materi_pengembangan: z.string(),
	tanggal_pelaksanaan: z.string().openapi({ example: "2026-05-01" }),
	jumlah_jam: z.number().int(),
	filename: z.string().nullable(),
	pegawai_nama: z.string().optional().describe("Nama pegawai (join)"),
	pegawai_nip: z.string().optional().describe("NIP pegawai (join)"),
	...timestamps,
});

export const ActivityBaseInput = z.object({
	pegawai_id: z.number().int().positive().openapi({ example: 1 }),
	materi_pengembangan: z.string().min(1).max(500),
	tanggal_pelaksanaan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "format YYYY-MM-DD"),
	jumlah_jam: z.number().int().min(0).max(10000),
	filename: z.string().max(500).nullable().optional(),
});

export const Diklat = ActivityBase.omit({ jumlah_jam: true, tanggal_pelaksanaan: true }).extend({
	jenis_pelatihan_id: z.number().int(),
	nomor_surat: z.string(),
	dari_tanggal_pelaksanaan: z.string(),
	sampai_tanggal_pelaksanaan: z.string(),
	jumlah_jam_pelatihan: z.number().int(),
});

export const DiklatInput = z.object({
	pegawai_id: z.number().int().positive(),
	jenis_pelatihan_id: z.number().int().positive(),
	nomor_surat: z.string().min(1).max(200),
	materi_pengembangan: z.string().min(1).max(500),
	dari_tanggal_pelaksanaan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	sampai_tanggal_pelaksanaan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	jumlah_jam_pelatihan: z.number().int().min(0).max(10000),
	filename: z.string().max(500).nullable().optional(),
});

export const Ppm = ActivityBase.omit({ jumlah_jam: true }).extend({
	nomor_surat: z.string(),
	jumlah_jam_pelatihan: z.number().int(),
});

export const PpmInput = z.object({
	pegawai_id: z.number().int().positive(),
	nomor_surat: z.string().min(1).max(200),
	materi_pengembangan: z.string().min(1).max(500),
	tanggal_pelaksanaan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	jumlah_jam_pelatihan: z.number().int().min(0).max(10000),
});

export const MateriPpm = z.object({
	id: z.number().int(),
	nomor_surat: z.string().nullable(),
	nama_pemateri: z.string().nullable(),
	materi_pengembangan: z.string(),
	tanggal_pelaksanaan: z.string(),
	link_materi: z.string().nullable(),
	link_dokumentasi: z.string().nullable(),
	...timestamps,
});

export const MateriPpmInput = z.object({
	nomor_surat: z.string().max(200).nullable().optional(),
	nama_pemateri: z.string().max(200).nullable().optional(),
	materi_pengembangan: z.string().min(1).max(500),
	tanggal_pelaksanaan: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	link_materi: z.string().max(1000).nullable().optional(),
	link_dokumentasi: z.string().max(1000).nullable().optional(),
});

export const ActivityListQuery = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	cursor: z.coerce.number().int().positive().optional(),
	pegawai_id: z.coerce.number().int().positive().optional().describe("Filter pegawai (admin)"),
	search: z.string().max(200).optional().describe("Cari materi / nomor surat"),
	dari_tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	sampai_tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
