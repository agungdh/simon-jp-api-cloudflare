const enc = new TextEncoder();

export function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
	const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) throw new Error("invalid hex");
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

export function base64UrlEncode(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
	return bytesToHex(digest);
}

/** Opaque session token: 32 random bytes, base64url. Simpan hash-nya di DB. */
export function generateOpaqueToken(): string {
	const buf = new Uint8Array(32);
	crypto.getRandomValues(buf);
	return base64UrlEncode(buf);
}

export function generateSaltHex(): string {
	const buf = new Uint8Array(16);
	crypto.getRandomValues(buf);
	return bytesToHex(buf);
}

const PBKDF2_ITERATIONS = 100_000;

/** PBKDF2-SHA256, 100k iterasi, output 32 byte hex. Native SubtleCrypto, aman untuk Workers Free (CPU kecil). */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		key,
		256,
	);
	return bytesToHex(bits);
}

export async function verifyPassword(
	password: string,
	saltHex: string,
	expectedHashHex: string,
): Promise<boolean> {
	const got = await hashPassword(password, saltHex);
	if (got.length !== expectedHashHex.length) return false;
	let diff = 0;
	for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
	return diff === 0;
}
