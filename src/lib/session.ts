import { ForbiddenException, UnauthorizedException } from "chanfana";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppContext } from "../types";
import type { UserRole } from "../types";
import { sha256Hex } from "./crypto";

export const SESSION_COOKIE = "session_id";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = {
	id: number;
	username: string;
	role: UserRole;
	created_at: string;
};

export type SessionInfo = {
	user: SessionUser;
	/** id baris pegawai milik user ini; null untuk admin tanpa baris pegawai */
	pegawaiId: number | null;
	tokenHash: string;
	expiresAt: number;
};

function cookieSecure(c: AppContext): boolean {
	try {
		return new URL(c.req.url).protocol === "https:";
	} catch {
		return false;
	}
}

export function setSessionCookie(c: AppContext, rawToken: string) {
	setCookie(c, SESSION_COOKIE, rawToken, {
		httpOnly: true,
		secure: cookieSecure(c),
		sameSite: "Lax",
		path: "/",
		maxAge: SESSION_TTL_MS / 1000,
	});
}

export function clearSessionCookie(c: AppContext) {
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function getSession(c: AppContext): Promise<SessionInfo | null> {
	const raw = getCookie(c, SESSION_COOKIE);
	if (!raw) return null;
	const tokenHash = await sha256Hex(raw);
	const row = await c.env.DB.prepare(
		`SELECT s.token_hash AS token_hash, s.expires_at AS expires_at,
			u.id AS id, u.username AS username, u.role AS role, u.created_at AS created_at,
			(SELECT p.id FROM pegawai p WHERE p.user_id = u.id) AS pegawai_id
		 FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = ?`,
	)
		.bind(tokenHash)
		.first<{
			token_hash: string;
			expires_at: number;
			id: number;
			username: string;
			role: UserRole;
			created_at: string;
			pegawai_id: number | null;
		}>();
	if (!row) return null;
	if (row.expires_at <= Date.now()) {
		await c.env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
		return null;
	}
	return {
		user: { id: row.id, username: row.username, role: row.role, created_at: row.created_at },
		pegawaiId: row.pegawai_id,
		tokenHash: row.token_hash,
		expiresAt: row.expires_at,
	};
}

export async function requireAuth(c: AppContext, role?: UserRole | UserRole[]): Promise<SessionInfo> {
	const sess = await getSession(c);
	if (!sess) throw new UnauthorizedException();
	if (role) {
		const allowed = Array.isArray(role) ? role : [role];
		if (!allowed.includes(sess.user.role)) throw new ForbiddenException();
	}
	return sess;
}

/**
 * Filter kepemilikan ala ScopesByPegawai: admin bebas (null = tanpa filter),
 * user biasa wajib pegawai_id miliknya. User tanpa baris pegawai -> 403.
 */
export function ownerFilter(sess: SessionInfo): number | null {
	if (sess.user.role === "admin") return null;
	if (sess.pegawaiId === null) throw new ForbiddenException("akun belum tertaut pegawai");
	return sess.pegawaiId;
}
