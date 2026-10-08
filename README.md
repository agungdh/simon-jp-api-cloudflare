# SIMON-JP API — Backend Manajemen Pegawai

Cloudflare Worker + Hono + Chanfana (OpenAPI 3.1) + D1 + R2.

## Setup lokal

1. `npm install`
2. `npx wrangler d1 migrations apply simonjp --local`
3. `npx wrangler dev` → Swagger di `http://localhost:8787/`

## Setup remote (deploy)

`wrangler.jsonc` masih pakai `database_id: "local-simonjp"` (placeholder lokal).

1. `wrangler login`
2. `npx wrangler d1 create simonjp` → isi `database_id` di `wrangler.jsonc`, lalu `npx wrangler types`
3. `npx wrangler r2 bucket create simonjp`
4. `npx wrangler d1 migrations apply simonjp --remote`
5. `npx wrangler deploy`

## Auth

Opaque token + session cookie HttpOnly (`session_id`, 7 hari, `SameSite=Lax`).
Password: PBKDF2-SHA256 100k iterasi. User pertama yang register otomatis jadi `admin`.

| Method | Path | Akses |
|--------|------|-------|
| POST | `/api/auth/register` | admin (kecuali user pertama) |
| POST | `/api/auth/login` | publik |
| POST | `/api/auth/logout` | login |
| GET | `/api/auth/me` | login |

## Pegawai

`id INTEGER AUTOINCREMENT`, `nip UNIQUE`, foto opsional di R2 (`pegawai/{id}.jpg`).
List pakai **cursor pagination** (`id < cursor ORDER BY id DESC`) untuk infinite scroll:
`GET /api/pegawai?limit=20&cursor=45&search=...&unit_kerja=...&jabatan=...&status_aktif=true|false`

| Method | Path | Akses |
|--------|------|-------|
| GET | `/api/pegawai` | admin, user |
| POST | `/api/pegawai` | admin |
| GET | `/api/pegawai/:id` | admin, user |
| PUT | `/api/pegawai/:id` | admin |
| DELETE | `/api/pegawai/:id` | admin |
| PUT | `/api/pegawai/:id/foto` | admin (multipart `foto` / raw `image/jpeg,png,webp`, ≤5MB) |
| GET | `/api/pegawai/:id/foto` | admin, user |
| DELETE | `/api/pegawai/:id/foto` | admin |

Catatan FE: deploy FE satu origin dengan API (Worker + assets / domain yang sama)
agar cookie `SameSite=Lax` terkirim tanpa CORS khusus.
