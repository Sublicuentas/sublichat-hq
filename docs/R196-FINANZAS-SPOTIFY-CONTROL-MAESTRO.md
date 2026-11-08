# R196 · FINANZAS (módulo nuevo) + Spotify Premium Familiar en Control Maestro

Proyectos: **Sublichat HQ (Vercel)** y **sublicuentas-tg-bot (Render, solo copia fiel de 1 librería)**.
APK y Panel de Socios: **sin cambios** (no hace falta actualizar la APK).

Yo no hice deploy ni commit. Usted sube los archivos a mano.

## Auditoría antes de programar

- Ya existía el **Finance OS** (R135–R139), con estas colecciones:
  - catálogo: `fin_productos`, `fin_variantes`, `fin_precios`;
  - compras y costo: `fin_proveedores`, `fin_lotes`;
  - costo por venta: `fin_consumos` (PEPS, combos repartidos);
  - otras: `fin_billeteras`, `fin_cxp`.
- FINANZAS se construyó **encima** de ese motor y no lo duplica.
- Las compras siguen entrando por `fin_compra_registrar`. Así se conservan:
  - `operationId`, que es antiduplicado;
  - la tasa guardada en el lote, que no cambia después;
  - Binance con promedio ponderado.
- Backups antes de tocar: `_spotify-familias`, `_finanzas-empresa`, `finanzas.js`, `_permisos`, `sublichat-app.js`, `ui-v2.js` e `index.html`.

## Lista A · Finanzas (Sublichat HQ)

| Archivo | Tipo | Qué hace |
|---|---|---|
| `api/_finanzas-panel.js` | nuevo | Vea el desglose debajo de la tabla. |
| `api/finanzas.js` | +13 líneas | Despacha las acciones `finp_*`. Pide el permiso propio «finanzas-panel» y lo revalida en el servidor. |
| `api/_finanzas-empresa.js` | 3 líneas | Monedas **EUR y PHP**, siempre con el cargo real en HNL. Categorías nuevas: IA, Videojuegos, Recargas, Antivirus, y cualquier categoría nueva sin programar. |
| `api/_permisos.js` | +3 líneas | Módulo «Finanzas». Por defecto lo tiene solo Sublicuentas; a los demás se lo activa usted en Permisos. |
| `finanzas-web.js` / `finanzas-web.css` | nuevos | Pantalla clara, sin sidebar ni neón (detalle debajo). |
| `sublichat-app.js` / `ui-v2.js` | 7 + 3 líneas | Pestaña **Finanzas** en la navegación horizontal, después de Sala de Juntas. |

**Contenido de `api/_finanzas-panel.js`:**
- **Panel:** KPIs con el % contra el mes anterior, ganancia por categoría, Top 5, tabla de rentabilidad y alertas. El umbral de margen es configurable; viene en 30 %.
- **Importación VIP:** vista previa, confirmación, deshacer e historial.
- **Lista VIP:** editar, reemplazar, dar de baja e historial.
- **Datos para el Excel de reportes.**

**Contenido de la pantalla (`finanzas-web.js` / `.css`):**
- Pestañas: Resumen · Proveedores · Compras · Ganancias · Reportes.
- **Productos** se abre en contexto, como botón y no como pestaña.

### Reglas que cumple
- **Sin costo = «Pendiente de costo»**, nunca L0. Esa venta queda fuera del margen y se muestra aparte.
- El KPI se llama «Ganancia después de costos registrados». No incluye gastos operativos.
- **Proveedor por NOMBRE** (Trap/Deku), nunca por precio. 2.50/2.70 son solo referencia.
- **Combos:** cada línea cuenta una sola vez, porque el costeo ya reparte el ingreso.
- Las fichas no se tocan: Finanzas no crea ventas, cobros, clientes, cuentas ni renovaciones.

### Importación «Sublichat_Netflix_VIP_Importacion.xlsx»
- **Qué lee:** solo las hojas **EXTRAS_VIP** y **LOTES_COMPRAS**, por nombre de columna. Ignora las columnas `_NO_IMPORTAR` y la hoja `EJEMPLOS_NO_IMPORTAR`.
- **Quién valida:** el navegador solo lee el archivo. **El servidor recalcula todo.**
- **Cómo encuentra cada acceso:**
  - **ID primero.** Si el ID no existe, la fila da error y **no** se busca por correo.
  - Si no hay ID, busca por correo exacto, con la cuenta madre como refuerzo.
  - Si quedan varias opciones, va a revisión manual con un selector.
- **Contadores de la vista previa:**
  - nuevos, actualizados, sin cambios;
  - ambiguos, sin coincidencia, duplicados;
  - costo inválido, fecha inválida, lote sin referencia, proveedor desconocido;
  - pagos únicos;
  - «0 ventas/cuentas/clientes».
- **Solo se bloquea la fila con problema.** El resto del archivo sigue.
- **Confirmar:**
  - pide marcar la casilla;
  - exige el mismo hash de la vista previa;
  - corre en una sola transacción (máximo 480 filas);
  - guarda auditoría y la foto «antes».
- **Deshacer:** solo la última importación. No deshace si algo se editó después.
- **Lote:** 20 extras = **UN pago**. Si el lote dice N y el archivo vincula otra cantidad, sale un aviso; no se ajusta solo.
- **Reimportar el mismo archivo** da «sin cambios» y no hay nada que confirmar (idempotente).
- **Errores:** se descargan en Excel.

### Colecciones nuevas
Solo se agregan colecciones; no hay migración destructiva:
- `fin_vip_extras/{idAccesoControlMaestro}`
- `fin_vip_lotes/{idLote}`
- `fin_import_jobs`
- `finanzas_config/finanzas_panel`

## Lista B · Spotify en Control Maestro (Sublichat HQ + bot)

| Archivo | Cambio |
|---|---|
| `api/_spotify-familias.js` | Posiciones fijas 1–5. Estados: Disponible / Invitación pendiente / Ocupado / Pendiente de retirada. Funciones nuevas: `cambiarCorreo` (conserva cliente, posición, vencimiento e historial), `vincularFicha`, `marcarMiembro`, `liberarEspacio` (pide confirmar el retiro) y `panelFamilias` (exactamente 5 filas; cliente y vence se leen de la ficha). La vinculación es idempotente. |
| `api/inventario.js` | +7 líneas: rutas `spotifyPanel`, `spotifyVincularEspacio`, `spotifyCambiarCorreo`, `spotifyVincularFicha`, `spotifyMarcar` y `spotifyLiberar`. |
| `control-maestro-spotify.js` / `.css` | nuevos: tarjetas de familia con 5 filas, búsqueda, filtros y menú ⋮. |
| `control-maestro.js` | **Solo 2 líneas**, ambas condicionadas a `accountPlatform==='spotify'`: el contenedor y el montaje. |
| **Bot** `lib_spotify_familias.js` | Copia fiel de `api/_spotify-familias.js`; solo la línea 1 es distinta. |

- **Costo de Spotify:** UNA compra por familia y mes en Compras (producto Spotify Familiar, cantidad 1, monto en HNL). No se registran 5 pagos.
- Asignar o cambiar un correo **no cambia cobros ni fechas** del cliente.
- **Mover entre familias es transaccional.**
- Las posiciones se asignan solas, sin migrar datos y de forma idempotente.

Diff de evidencia en `DIFFS/`:
- `A_FINANZAS.diff`
- `B_SPOTIFY_CONTROL_MAESTRO.diff`
- `C_INDEX_HTML.diff` (versiones de caché y 4 etiquetas nuevas)

En `control-maestro.js` solo cambian esas 2 líneas. Netflix y las demás plataformas quedan intactas, y la captura `control-maestro-netflix-intacto-1440.png` lo muestra.

## Pruebas
- **HQ:** 302 pruebas; pasan 299. Las 3 que fallan ya fallaban antes de R196:
  - `finanzas-libro-api`
  - `juegos-puntos`
  - r139 «Prueba H»

  Comprobé la r139 con el `_finanzas-empresa.js` anterior y falla igual.
- **Nuevas de R196, todas OK:**
  - `r196-spotify-control-maestro`: 7 pruebas sobre los casos 17.5 de la especificación.
  - `r196-finanzas-panel`: 8 pruebas sobre Pendiente de costo, combos, EUR/PHP, lote de 20 = 1 pago, reimportación idempotente, deshacer, filas bloqueadas, ID inexistente, cuenta madre, hash y permisos.
- **Bot:** 189/189.
- **Navegador:** `tests/visual/r196-finanzas-spotify.mjs` hace 11 comprobaciones con el código real del servidor y datos ficticios:
  - escritorio 1440 y móvil 390 sin scroll horizontal;
  - importación con la **plantilla real** rellenada con datos ficticios;
  - descarga del Excel de errores y del Excel de reportes, que trae 9 hojas;
  - Relojes no ve Finanzas;
  - Control Maestro › Spotify muestra 2 familias con 5 filas cada una;
  - en Netflix no aparece el bloque de Spotify.

## Pendientes (no los inventé)
1. **Lotes VIP y caja:** el pago del Excel queda registrado en Finanzas (`contabilizadoEnCaja:false`) y **no mueve bancos ni Binance**, para no duplicar un pago que quizá ya está en el libro. Si quiere que descuente Binance, me lo confirma.
2. **Tasa por fila:** si la fila trae su propia tasa y además tiene lote, se usa la del lote.
3. **Max Player:** no está comprado; queda «Pendiente de costo» hasta registrar la compra.
4. **Canva:** sigue como panel de 500 accesos; cada venta consume 1 acceso.
5. **Combos sin precio por línea:** se reparten en partes iguales (regla de R137). Si prefiere otra regla, dígame cuál.

## Cómo subir (Sublichat HQ)
1. Copie los archivos de `93_SUBLICHAT_HQ_R196/sublichat-hq/` respetando las carpetas.
2. Bot: reemplace `lib_spotify_familias.js`.
3. No hacen falta variables de entorno nuevas ni índices nuevos. Las consultas usan igualdad simple sobre `mesKey` y `plataforma`.
4. **Rollback:** restaure los archivos anteriores. Las colecciones nuevas pueden quedarse; no afectan nada.
