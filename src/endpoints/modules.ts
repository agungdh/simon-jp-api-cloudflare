import { z } from "zod";
import { crudEndpoints, type CrudConfig } from "../lib/crud";
import {
	ActivityBase,
	ActivityBaseInput,
	ActivityListQuery,
	Bidang,
	BidangInput,
	Diklat,
	DiklatInput,
	JenisPelatihan,
	JenisPelatihanInput,
	MateriPpm,
	MateriPpmInput,
	PangkatGolongan,
	PangkatGolonganInput,
	Ppm,
	PpmInput,
} from "../types";

export const MasterListQuery = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20),
	cursor: z.coerce.number().int().positive().optional(),
	search: z.string().max(200).optional(),
});

function master(tag: string, table: string, singular: string, row: z.ZodTypeAny, input: z.ZodTypeAny, columns: string[], search: string[]) {
	return crudEndpoints({
		tag,
		table,
		singular,
		rowSchema: row,
		createSchema: input,
		updateSchema: (input as unknown as { partial(): z.ZodTypeAny }).partial(),
		listQuery: MasterListQuery,
		columns,
		dateColumn: null,
		searchColumns: search,
		joinPegawai: false,
		ownerColumn: null,
		fileModule: null,
		writeRole: "admin",
	});
}

function activity(
	tag: string,
	table: string,
	singular: string,
	row: z.ZodTypeAny,
	input: z.ZodTypeAny,
	columns: string[],
	dateColumn: string,
	search: string[],
	fileModule: string | null,
) {
	return crudEndpoints({
		tag,
		table,
		singular,
		rowSchema: row,
		createSchema: input,
		updateSchema: (input as unknown as { partial(): z.ZodTypeAny }).partial(),
		listQuery: ActivityListQuery,
		columns,
		dateColumn,
		searchColumns: search,
		joinPegawai: true,
		ownerColumn: "pegawai_id",
		fileModule,
	});
}

const BASE_COLUMNS = ["pegawai_id", "materi_pengembangan", "tanggal_pelaksanaan", "jumlah_jam", "filename"];
const BASE_SEARCH = ["materi_pengembangan"];

export const BidangEp = master("Bidang", "bidangs", "bidang", Bidang, BidangInput, ["bidang"], ["bidang"]);
export const PangkatEp = master("Pangkat", "pangkat_golongans", "pangkat/golongan", PangkatGolongan, PangkatGolonganInput, ["jenjang", "pangkat", "golongan", "ruang"], ["pangkat", "golongan", "jenjang"]);
export const JenisEp = master("Jenis Pelatihan", "jenis_pelatihans", "jenis pelatihan", JenisPelatihan, JenisPelatihanInput, ["jenis_pelatihan"], ["jenis_pelatihan"]);

export const MateriPpmEp = crudEndpoints({
	tag: "Materi PPM",
	table: "materi_ppms",
	singular: "materi ppm",
	rowSchema: MateriPpm,
	createSchema: MateriPpmInput,
	updateSchema: MateriPpmInput.partial(),
	listQuery: ActivityListQuery,
	columns: ["nomor_surat", "nama_pemateri", "materi_pengembangan", "tanggal_pelaksanaan", "link_materi", "link_dokumentasi"],
	dateColumn: "tanggal_pelaksanaan",
	searchColumns: ["materi_pengembangan", "nomor_surat", "nama_pemateri"],
	joinPegawai: false,
	ownerColumn: null,
	fileModule: null,
	writeRole: "admin",
});

const SEVEN = (tag: string, table: string, singular: string, module: string) =>
	activity(tag, table, singular, ActivityBase, ActivityBaseInput, BASE_COLUMNS, "tanggal_pelaksanaan", BASE_SEARCH, module);

export const SeminarEp = SEVEN("Seminar", "seminars", "seminar", "seminar");
export const WebinarEp = SEVEN("Webinar", "webinars", "webinar", "webinar");
export const LcEp = SEVEN("LC", "lcs", "LC", "lc");
export const BelajarMandiriEp = SEVEN("Belajar Mandiri", "belajar_mandiris", "belajar mandiri", "belajar-mandiri");
export const MentoringEp = SEVEN("Mentoring", "mentorings", "mentoring", "mentoring");
export const CoachingEp = SEVEN("Coaching", "coachings", "coaching", "coaching");
export const WorkshopEp = SEVEN("Workshop", "workshops", "workshop", "workshop");

export const DiklatEp = activity("Diklat", "diklats", "diklat", Diklat, DiklatInput,
	["pegawai_id", "jenis_pelatihan_id", "nomor_surat", "materi_pengembangan", "dari_tanggal_pelaksanaan", "sampai_tanggal_pelaksanaan", "jumlah_jam_pelatihan", "filename"],
	"dari_tanggal_pelaksanaan", ["materi_pengembangan", "nomor_surat"], "diklat");

export const PpmEp = activity("PPM", "ppms", "ppm", Ppm, PpmInput,
	["pegawai_id", "nomor_surat", "materi_pengembangan", "tanggal_pelaksanaan", "jumlah_jam_pelatihan"],
	"tanggal_pelaksanaan", ["materi_pengembangan", "nomor_surat"], null);
