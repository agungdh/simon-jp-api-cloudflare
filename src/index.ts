import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { AuthLogin } from "./endpoints/authLogin";
import { AuthLogout } from "./endpoints/authLogout";
import { AuthMe } from "./endpoints/authMe";
import { AuthRegister } from "./endpoints/authRegister";
import { Dashboard } from "./endpoints/dashboard";
import {
	BelajarMandiriEp,
	BidangEp,
	CoachingEp,
	DiklatEp,
	JenisEp,
	LcEp,
	MateriPpmEp,
	MentoringEp,
	PangkatEp,
	PpmEp,
	SeminarEp,
	WebinarEp,
	WorkshopEp,
} from "./endpoints/modules";
import {
	PegawaiCreate,
	PegawaiDelete,
	PegawaiFetch,
	PegawaiList,
	PegawaiUpdate,
} from "./endpoints/pegawai";
import { PegawaiFotoConfirm } from "./endpoints/pegawaiFotoConfirm";
import { PegawaiFotoPresign } from "./endpoints/pegawaiFotoPresign";
import { UploadPresign } from "./endpoints/uploadPresign";
import { downloadArsip } from "./routes/download";
import { fotoDelete, fotoGet } from "./routes/foto";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Auth
openapi.post("/api/auth/register", AuthRegister);
openapi.post("/api/auth/login", AuthLogin);
openapi.post("/api/auth/logout", AuthLogout);
openapi.get("/api/auth/me", AuthMe);

// Dashboard
openapi.get("/api/dashboard", Dashboard);

// Pegawai
openapi.get("/api/pegawai", PegawaiList);
openapi.post("/api/pegawai", PegawaiCreate);
openapi.get("/api/pegawai/:id", PegawaiFetch);
openapi.put("/api/pegawai/:id", PegawaiUpdate);
openapi.delete("/api/pegawai/:id", PegawaiDelete);
openapi.post("/api/pegawai/:id/foto/presign", PegawaiFotoPresign);
openapi.post("/api/pegawai/:id/foto/confirm", PegawaiFotoConfirm);
app.get("/api/pegawai/:id/foto", (c) => fotoGet(c));
app.delete("/api/pegawai/:id/foto", (c) => fotoDelete(c));

// Master
function crud(prefix: string, ep: Record<"List" | "Create" | "Fetch" | "Update" | "Delete", unknown>) {
	openapi.get(prefix, ep.List as never);
	openapi.post(prefix, ep.Create as never);
	openapi.get(`${prefix}/:id`, ep.Fetch as never);
	openapi.put(`${prefix}/:id`, ep.Update as never);
	openapi.delete(`${prefix}/:id`, ep.Delete as never);
}

crud("/api/bidang", BidangEp);
crud("/api/pangkat-golongan", PangkatEp);
crud("/api/jenis-pelatihan", JenisEp);

// Aktivitas
crud("/api/diklat", DiklatEp);
crud("/api/ppm", PpmEp);
crud("/api/seminar", SeminarEp);
crud("/api/webinar", WebinarEp);
crud("/api/lc", LcEp);
crud("/api/belajar-mandiri", BelajarMandiriEp);
crud("/api/mentoring", MentoringEp);
crud("/api/coaching", CoachingEp);
crud("/api/workshop", WorkshopEp);
crud("/api/materi-ppm", MateriPpmEp);

// Upload arsip + download (arsip binary via route Hono biasa)
openapi.post("/api/upload/presign", UploadPresign);
app.get("/api/download/:module/:id", (c) => downloadArsip(c));

type ApiErrorShape = { code: number; message: string };

// Format error seragam {error:{code,message}} — tanpa envelope `success`.
app.onError(async (err, c) => {
	if (err instanceof ApiException) {
		return c.json(
			{ error: toShape(err.code, err.isVisible ? err.message || err.default_message : "Internal Error") },
			err.status as never,
		);
	}
	const getResponse = (err as unknown as { getResponse?: unknown }).getResponse;
	if (typeof getResponse === "function") {
		try {
			const res = (err as unknown as { getResponse(): Response }).getResponse();
			const body = (await res.json()) as { errors?: ApiErrorShape[] };
			const first = body?.errors?.[0];
			if (first) return c.json({ error: { code: first.code, message: first.message } }, res.status as never);
		} catch {
			// abaikan, jatuh ke 500 generik di bawah
		}
	}
	console.error(err);
	return c.json({ error: { code: 7000, message: "Internal Error" } }, 500);
});

function toShape(code: number, message: string): ApiErrorShape {
	return { code, message };
}

// Export the Hono app
export default app;
