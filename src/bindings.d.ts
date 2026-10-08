// Secret tambahan (tidak tampil di `wrangler types`).
// Isi via `wrangler secret put ...` (remote) atau `.dev.vars` (lokal, lihat .dev.vars.example).
interface Env {
	/** R2 API token: Access Key ID (https://dash.cloudflare.com → R2 → API Tokens) */
	R2_ACCESS_KEY_ID: string;
	/** R2 API token: Secret Access Key */
	R2_SECRET_ACCESS_KEY: string;
	/** Account ID Cloudflare (untuk endpoint https://<ACCOUNT>.r2.cloudflarestorage.com) */
	R2_ACCOUNT_ID: string;
}
