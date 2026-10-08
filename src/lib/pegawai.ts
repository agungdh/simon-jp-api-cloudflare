type PegawaiRow = {
	id: number;
	nip: string;
	nama: string;
	jabatan: string | null;
	unit_kerja: string | null;
	status_aktif: number;
	foto_key: string | null;
	created_at: string;
	updated_at: string;
};

export type PegawaiDTO = {
	id: number;
	nip: string;
	nama: string;
	jabatan: string | null;
	unit_kerja: string | null;
	status_aktif: boolean;
	foto_key: string | null;
	created_at: string;
	updated_at: string;
};

export function toPegawaiDTO(row: PegawaiRow): PegawaiDTO {
	return {
		id: row.id,
		nip: row.nip,
		nama: row.nama,
		jabatan: row.jabatan,
		unit_kerja: row.unit_kerja,
		status_aktif: row.status_aktif === 1,
		foto_key: row.foto_key,
		created_at: row.created_at,
		updated_at: row.updated_at,
	};
}

export function parseStatusAktif(v: string | undefined): number | undefined {
	if (v === undefined) return undefined;
	if (v === "true" || v === "1") return 1;
	if (v === "false" || v === "0") return 0;
	return undefined;
}

export function fotoKeyFor(id: number): string {
	return `pegawai/${id}.jpg`;
}
