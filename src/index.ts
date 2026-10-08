import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { AuthLogin } from "./endpoints/authLogin";
import { AuthLogout } from "./endpoints/authLogout";
import { AuthMe } from "./endpoints/authMe";
import { AuthRegister } from "./endpoints/authRegister";
import { PegawaiCreate } from "./endpoints/pegawaiCreate";
import { PegawaiDelete } from "./endpoints/pegawaiDelete";
import { PegawaiFetch } from "./endpoints/pegawaiFetch";
import { PegawaiList } from "./endpoints/pegawaiList";
import { PegawaiUpdate } from "./endpoints/pegawaiUpdate";
import { fotoDelete, fotoGet, fotoPut } from "./routes/foto";

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

// Pegawai CRUD (cursor pagination, foto opsional terpisah)
openapi.get("/api/pegawai", PegawaiList);
openapi.post("/api/pegawai", PegawaiCreate);
openapi.get("/api/pegawai/:id", PegawaiFetch);
openapi.put("/api/pegawai/:id", PegawaiUpdate);
openapi.delete("/api/pegawai/:id", PegawaiDelete);

// Foto: binary/multipart, tidak cocok untuk schema OpenAPI JSON -> route Hono biasa
app.put("/api/pegawai/:id/foto", (c) => fotoPut(c));
app.get("/api/pegawai/:id/foto", (c) => fotoGet(c));
app.delete("/api/pegawai/:id/foto", (c) => fotoDelete(c));

// Format ApiException (401/403/404/...) juga untuk route Hono biasa (foto).
// Tanpa ini, throw di route biasa jadi 500 polos.
app.onError((err, c) => {
	if (err instanceof ApiException) {
		return c.json({ success: false, errors: err.buildResponse(), result: {} }, err.status as never);
	}
	// Error dari route OpenAPI dibungkus Chanfana jadi Hono HTTPException
	const res = (err as unknown as { getResponse?: unknown }).getResponse;
	if (typeof res === "function") {
		return (err as { getResponse(): Response }).getResponse();
	}
	console.error(err);
	return c.json({ success: false, errors: [{ code: 7000, message: "Internal Error" }], result: {} }, 500);
});

// Export the Hono app
export default app;
