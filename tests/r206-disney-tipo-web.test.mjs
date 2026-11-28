// R206 · Bodega Web: botones Con ESPN / Sin ESPN en el detalle de una cuenta Disney y acción del servidor.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const R = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
test("detalle Disney con los dos tipos y servidor con permiso", () => {
  const app = R("sublichat-app.js"), api = R("api/inventario.js");
  assert.match(app, /data-inv-disney="disneyp"/); assert.match(app, /data-inv-disney="disneys"/);
  assert.match(app, /accion:"disneyTipo",docId:c\.id,tipo,autorizarExcepcion:true/);
  assert.match(api, /if \(accion === "disneyTipo"\)/); assert.match(api, /disneyTipo\.sincronizarVentas/);
  assert.match(R("index.html"), /sublichat-app\.js\?v=2026112[78]-r2\d\da/);
});
