import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export type UserRole = "admin" | "user";

export const Role = z.enum(["admin", "user"]).openapi({ example: "admin" });

// ---- Pegawai ----
export const Pegawai = z.object({
	id: z.number().int().openapi({ example: 1 }),
	nip: z.string().min(1).openapi({ example: "198501012010011001" }),
	nama: z.string().min(1).openapi({ example: "Budi Santoso" }),
	jabatan: z.string().nullish().openapi({ example: "Staff Pelaksana" }),
	unit_kerja: z.string().nullish().openapi({ example: "Bagian Umum" }),
	status_aktif: z.boolean().openapi({ example: true }),
	foto_key: z.string().nullish().openapi({ example: "pegawai/1.jpg" }),
	created_at: z.string().openapi({ example: "2026-10-08T00:00:00.000Z" }),
	updated_at: z.string().openapi({ example: "2026-10-08T00:00:00.000Z" }),
});

export const PegawaiCreateInput = z.object({
	nip: z.string().min(1).max(64).openapi({ example: "198501012010011001" }),
	nama: z.string().min(1).max(200).openapi({ example: "Budi Santoso" }),
	jabatan: z.string().max(200).nullish().openapi({ example: "Staff Pelaksana" }),
	unit_kerja: z.string().max(200).nullish().openapi({ example: "Bagian Umum" }),
	status_aktif: z.boolean().default(true).openapi({ example: true }),
});

export const PegawaiUpdateInput = z.object({
	nip: z.string().min(1).max(64).optional().openapi({ example: "198501012010011001" }),
	nama: z.string().min(1).max(200).optional().openapi({ example: "Budi Santoso" }),
	jabatan: z.string().max(200).nullable().optional().openapi({ example: "Staff Pelaksana" }),
	unit_kerja: z.string().max(200).nullable().optional().openapi({ example: "Bagian Umum" }),
	status_aktif: z.boolean().optional().openapi({ example: true }),
});

export const PegawaiListQuery = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(20).describe("Jumlah data per halaman"),
	cursor: z.coerce
		.number()
		.int()
		.positive()
		.optional()
		.describe("ID terakhir dari halaman sebelumnya (untuk infinite scroll)"),
	search: z.string().max(200).optional().describe("Cari nama / NIP"),
	unit_kerja: z.string().max(200).optional().describe("Filter unit kerja (exact)"),
	jabatan: z.string().max(200).optional().describe("Filter jabatan (exact)"),
	status_aktif: z
		.enum(["true", "false", "1", "0"])
		.optional()
		.describe("Filter status aktif"),
});

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
