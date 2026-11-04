# Rediseño Sublichat HQ (estilo Fillow) · R162

Solo la web de Sublichat HQ. **No cambia** APK, bot, base de datos ni endpoints existentes (solo se agrega `/api/permisos`).

## Fase 0 · Revisión de lo actual

| Punto | Hoy | Riesgo para el rediseño |
|---|---|---|
| Estructura | `index.html` (1,3 MB, 38 `<style>` y 31 `<script>` de parches) + `sublichat-app.js` (1,3 MB) | Reglas CSS con `!important` e IDs (`body.ready .wrap:has(#screen-inicio.active)`). El diseño nuevo usa selectores más fuertes y solo bajo `html.ui-v2`. |
| Menú | `subliRBAC.buildNav()` arma la barra inferior; en PC un script la mueve a `#sidebarWrap` | El diseño nuevo no mueve nada: oculta esa base y dibuja la suya leyendo `SublichatRBAC.pantallas()`. |
| Permisos | Reglas fijas por usuario en la web y en cada API | Ahora Sublicuentas los define (ver abajo). |
| Activar TV | No está en esta web | No se agrega. Una prueba lo verifica. |
| Datos | Clientes desde Firestore y `/api/importar control_datos` | Sin cambios. Las capturas usan datos ficticios. |
| Logo y robot | `assets/sublicuentas-logo-claro.png` (1183×264), robot 1,18 MB | Versiones livianas nuevas: `sublicuentas-logo-claro-ui.webp` (17 KB), `sublirobot-96.webp` (6 KB), `sublirobot-240.webp` (18 KB). |

## Módulos por usuario (los define Sublicuentas)

- Pantalla **Supervisión → Usuarios y permisos** (solo Sublicuentas).
- Sublicuentas siempre tiene todo. A los demás (Relojes, Geisell, Magdiel y cualquier usuario nuevo de `AUTH_USERS_JSON`) se les activa o desactiva cada módulo.
- Sin cambios guardados, cada usuario ve **exactamente** lo de hoy.
- Se guarda en Firestore `config/sublichat_permisos` (solo las diferencias). Cada cambio queda en `auditoria_eventos` (`tipo: permisos_modulos`).
- El servidor lo respeta (403 si está desactivado, acceso si se activa) en: Control Maestro, Portal Cliente, Catálogo, Sorteos, Panel de Socios, Mesas de trabajo, Bodega, Finanzas, Códigos, Actividad.
- **APK**: no oculta todavía los módulos desactivados (calcula su menú sola), pero el servidor le responde 403. Ocultarlos en la APK queda para una versión de APK.

## Diseño nuevo (Fase 1)

- Encender: abrir `https://sublichat.capuchino.lat/?ui=v2` (queda guardado en ese navegador).
- Apagar: menú del usuario → **Diseño anterior**, o `?ui=v1`.
- Apagado por defecto para todos: si no se usa `?ui=v2`, la web se ve igual que hoy.
- Menú lateral 248 px con el logo y 4 grupos (Principal, Operación, Supervisión, Extras), encabezado 72 px (buscador → Clientes, campana → Tickets, usuario con el robot).
- Bajo 1200 px: menú en cajón. Bajo 768 px: barra inferior Inicio · Clientes · Renovar · Más.
- Colores y medidas del brief (`--subli-*`), letra Inter, fondo blanco y `#F5F6FA`, sin degradados.

## Archivos (Sublichat HQ · Vercel)

| Archivo | Cambio |
|---|---|
| `api/_permisos.js` | Nuevo: catálogo de módulos, reglas de hoy, lectura y aplicación de lo que define Sublicuentas |
| `api/permisos.js` | Nuevo: `mis_permisos`, `listar`, `guardar` |
| `api/importar.js`, `inventario.js`, `codigos.js`, `finanzas.js`, `sorteos.js`, `portal-cliente.js`, `catalogo-relojes.js`, `revendedores-admin.js`, `auditoria.js` | Consultan los permisos |
| `sublichat-app.js` | Menú desde el servidor + pantalla Usuarios y permisos + `window.SublichatRBAC` |
| `permisos-admin.js` | Nuevo: pantalla de permisos |
| `ui-v2.css`, `ui-v2.js` | Nuevos: diseño nuevo detrás de la bandera |
| `index.html` | Carga los 3 archivos nuevos; versión `20261104-r162` |
| `assets/sublicuentas-logo-claro-ui.webp`, `assets/sublirobot-96.webp`, `assets/sublirobot-240.webp` | Nuevos |
| `tests/r162-permisos.test.mjs`, `tests/visual/arnes.mjs`, `tests/visual/r162-menu.mjs` | Pruebas |

## Rollback

1. **Diseño**: no hay que hacer nada; está apagado salvo `?ui=v2`. Para quitarlo del todo: borrar las 3 líneas `ui-v2` de `index.html`.
2. **Permisos de un usuario**: en la pantalla, "Volver a lo de siempre" y guardar.
3. **Permisos de todos**: borrar el documento `config/sublichat_permisos` en Firestore → todos vuelven a las reglas de hoy (la web y las APIs lo leen cada 20 s).
4. **Código completo**: volver a subir los archivos de la entrega anterior (zip 23). `api/permisos.js` y `api/_permisos.js` pueden quedarse: sin el documento no cambian nada.

## Fase 2 (siguiente)

Inicio → Clientes → Renovaciones → Control Maestro, uno por entrega, con capturas antes/después. Reglas que se mantienen: Control Maestro no corta perfiles a 3; en la ficha "Agregar otra cuenta a este cliente"; "Renovar a fecha", "No renovó" y comprobante único; credenciales ocultas.

## Pruebas (04/11/2026, local)

- `npm test`: 205 OK · 3 fallan igual que antes (dos piden credenciales Firebase; "Prueba H" tiene fecha fija de octubre).
- `tests/r162-permisos.test.mjs`: 5/5.
- `node tests/visual/r162-menu.mjs`: 6/6 (Sublicuentas, Relojes, Geisell, con y sin cambios, diseño nuevo y anterior, "Diseño anterior" vuelve).
- Capturas 360/390/768/1024/1366/1920 antes y después: Inicio, Clientes, Renovaciones, Control Maestro y Usuarios y permisos.
