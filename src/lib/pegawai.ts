type PegawaiRow = {
	id: number;
	user_id: number | null;
	bidang_id: number | null;
	pangkat_golongan_id: number | null;
	tipe: string;
	status: string;
	nip: string;
	nama: string;
	jabatan: string | null;
	peran: string | null;
	kategori_jabatan: string | null;
	kategori_kebutuhan_jam_pelatihan: string | null;
	foto_key: string | null;
	bidang?: string | null;
	pangkat_golongan?: string | null;
	created_at: string;
	updated_at: string;
};

export type PegawaiDTO = {
	id: number;
	user_id: number | null;
	bidang_id: number | null;
	pangkat_golongan_id: number | null;
	tipe: string;
	status: string;
	nip: string;
	nama: string;
	jabatan: string | null;
	peran: string | null;
	kategori_jabatan: string | null;
	kategori_kebutuhan_jam_pelatihan: string | null;
	foto_key: string | null;
	bidang: string | null;
	pangkat_golongan: string | null;
	created_at: string;
	updated_at: string;
};

export function toPegawaiDTO(row: PegawaiRow): PegawaiDTO {
	return {
		id: row.id,
		user_id: row.user_id,
		bidang_id: row.bidang_id,
		pangkat_golongan_id: row.pangkat_golongan_id,
		tipe: row.tipe,
		status: row.status,
		nip: row.nip,
		nama: row.nama,
		jabatan: row.jabatan,
		peran: row.peran,
		kategori_jabatan: row.kategori_jabatan,
		kategori_kebutuhan_jam_pelatihan: row.kategori_kebutuhan_jam_pelatihan,
		foto_key: row.foto_key,
		bidang: row.bidang ?? null,
		pangkat_golongan: row.pangkat_golongan ?? null,
		created_at: row.created_at,
		updated_at: row.updated_at,
	};
}

/** SELECT pegawai + join nama bidang & pangkat/golongan (format "Pangkat/Golongan" ala API lama). */
export const PEGAWAI_SELECT = `SELECT p.*,
	b.bidang AS bidang,
	CASE WHEN pg.id IS NULL THEN NULL ELSE pg.pangkat || '/' || pg.golongan END AS pangkat_golongan
	FROM pegawai p
	LEFT JOIN bidangs b ON b.id = p.bidang_id
	LEFT JOIN pangkat_golongans pg ON pg.id = p.pangkat_golongan_id`;

export function fotoKeyFor(id: number): string {
	return `pegawai/${id}.jpg`;
}

/** R2 key arsip modul: {module}/{recordId}/{filename} (filename dari DB, bukan dari key). */
export function arsipKeyFor(module: string, recordId: number): string {
	return `${module}/${recordId}`;
}
