# SIMON-JP API — Backend Manajemen Pegawai & Pelatihan

Cloudflare Worker + Hono + Chanfana (OpenAPI 3.1) + D1 + R2.
Migrasi dari app Laravel (`ate_bpkp_laporan`, MariaDB) — skema D1 mengikuti tabel lama.

## Konvensi API

- Tanpa envelope `success`: sukses → payload langsung + HTTP code (200/201), error → `{error: {code, message}}`.
- Auth cookie `session_id` HttpOnly (`SameSite=Lax`, 7 hari). FE web satu origin dengan API.
- List pakai **cursor pagination** → `{data, nextCursor, hasMore}`.
- Password PBKDF2-SHA256 100k iterasi. User pertama register otomatis jadi `admin`.
- Otorisasi: `admin` bebas semua; `user` hanya data miliknya (difilter `pegawai_id` otomatis, ganti milik orang → 403).

## Setup lokal

1. `npm install`
2. `npx wrangler d1 migrations apply simonjp --local`
3. `cp .dev.vars.example .dev.vars` (isi kredensial R2 asli kalau mau coba presign beneran)
4. `npx wrangler dev` → Swagger di `http://localhost:8787/`

## Setup remote (deploy)

1. `wrangler login`
2. `npx wrangler d1 create simonjp` → isi `database_id` di `wrangler.jsonc`, lalu `npx wrangler types`
3. `npx wrangler r2 bucket create simonjp` + pasang CORS `PUT` untuk origin FE
4. `npx wrangler d1 migrations apply simonjp --remote`
5. `npx wrangler secret put R2_ACCESS_KEY_ID` (+ `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`)
6. `npx wrangler deploy` (atau manual via GH Action `Deploy`)

## Endpoint

| Area | Path | Akses |
|------|------|-------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | register: admin (kecuali bootstrap) |
| Dashboard | `GET /api/dashboard?tahun=&pegawai_id=` | login (user: miliknya) |
| Pegawai | CRUD `/api/pegawai`, `POST :id/foto/presign`, `POST :id/foto/confirm`, `GET/DELETE :id/foto` | tulis: admin |
| Master | CRUD `/api/bidang`, `/api/pangkat-golongan`, `/api/jenis-pelatihan` | tulis: admin |
| Aktivitas | CRUD `/api/diklat`, `/api/ppm`, `/api/seminar`, `/api/webinar`, `/api/lc`, `/api/belajar-mandiri`, `/api/mentoring`, `/api/coaching`, `/api/workshop`, `/api/materi-ppm` | user: miliknya |
| Arsip | `POST /api/upload/presign {module, record_id, contentType}`, `GET /api/download/:module/:id` | upload: login (miliknya); download: login |

Alur upload arsip: buat record dulu (tanpa `filename`) → `upload/presign` → `PUT` file ke URL → update record dengan `filename`. Key R2: `{module}/{recordId}`, foto: `pegawai/{id}.jpg`.

## Import dari MySQL dump

1. Dump → konversi ke SQLite (enum → TEXT+CHECK, `DATETIME` → TEXT ISO).
2. Preserve `id` (INSERT eksplisit) agar FK `pegawai_id` tetap valid, urutan: users → master → pegawai → aktivitas.
3. Password: `password_hash = PBKDF2-HMAC-SHA256(NIP, salt acak 16B, 100k, 32B)`, semua hex; role dari `pegawais.tipe`/`admins`.
4. File `storage/*` → `wrangler r2 object put simonjp/{module}/{id} --file ...` (atau AWS CLI).
5. Verifikasi: count per tabel, `PRAGMA foreign_key_check`, login coba pakai NIP.
