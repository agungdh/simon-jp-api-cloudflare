import { AwsClient } from "aws4fetch";

export const PRESIGN_EXPIRES_IN = 300; // 5 menit, sesuai best practice URL berumur pendek

export type PresignConfig = {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
};

/**
 * Generate presigned URL untuk PUT langsung ke R2 (S3-compatible, SigV4).
 * Murni komputasi lokal (tanpa request jaringan), aman untuk CPU limit Workers.
 * Content-Type ikut di-sign: upload dengan tipe lain ditolak R2 (403 SignatureDoesNotMatch).
 */
export async function presignedPutUrl(
	cfg: PresignConfig,
	key: string,
	contentType: string,
	expiresIn = PRESIGN_EXPIRES_IN,
): Promise<string> {
	const aws = new AwsClient({
		accessKeyId: cfg.accessKeyId,
		secretAccessKey: cfg.secretAccessKey,
		region: "auto",
		service: "s3",
	});
	const url = new URL(`https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`);
	url.searchParams.set("X-Amz-Expires", String(expiresIn));
	const signed = await aws.sign(url.toString(), {
		method: "PUT",
		headers: { "Content-Type": contentType },
		aws: { signQuery: true },
	});
	return signed.url;
}

export function readPresignConfig(env: Env): PresignConfig | null {
	const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
	if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
	return {
		accountId: R2_ACCOUNT_ID,
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
		bucket: "simonjp",
	};
}
