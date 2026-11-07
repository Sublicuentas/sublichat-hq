# Sublichat HQ · R184 — PDF «Sublichat_4_arreglos» (06 nov 2026)

Estado: **listo para staging, NO publicado**. Pruebas con Firebase y `/api` simulados, usuarios y datos FICTICIOS.
No se tocaron datos, APK, bot, Firebase, roles, reglas ni endpoints de negocio.

## 1 · Interfaz nueva para todos

| Qué | Cómo |
|---|---|
| Activación | `<html class="ui-v2">` fijo en `index.html`; `ui-v2.js` ya no revisa bandera. Todos los roles y anchos. |
| Sin vuelta atrás | Se quitó «Diseño anterior» del menú de usuario. `?ui=v1` y `localStorage.sublichat_ui_v2=0` ya no hacen nada (la bandera vieja se limpia). `SublichatUI.usarAnterior()` existe pero no hace nada, para no romper llamadas viejas. |
| Permisos | Igual que antes: el menú nuevo sigue leyendo los mismos permisos (`can()` / pantallas visibles). Probado con admin (naara), supervisión (geisell) y limitado (relojes). |
| Caché / PWA | No hay PWA activa: `service-worker.js` solo se desregistra y el HTML sale `no-store`. Se subió la versión `?v=20261106-r184` de `ui-v2.css`, `ui-v2.js`, `ui-v2-inicio.js` y `sublichat-app.js` → el navegador baja lo nuevo al primer refresco. |

## 2 · Perfil sin «Tema de color»

- Se quitó la tarjeta «Tema de color», su galería y su CSS. Tema corporativo único (`ejecutivo`, fondo blanco).
- El botón viejo claro/oscuro queda oculto y fijo en claro.
- Preferencias guardadas (`perfil.tema`, `subli_theme`) **no se borran**: solo se ignoran.
- Nombre, foto, teléfono y demás campos del Perfil siguen guardando igual (prueba r184 paso 2).

## 3 · Botones del menú superior

- Alto 46 px · relleno 0 14px 0 8px · separación 8 px · sin `space-between`.
- Inter 13–14 px / 600. Activo rojo; hover 180 ms; foco con contorno visible (teclado).
- Ícono en cuadrito suave por familia: azul Clientes · ámbar Renovaciones · violeta Control Maestro · turquesa Portal · verde Operación.
- Responsive: 1920/1440/1024/768 px sin desborde; en 390 px usa el menú hamburguesa de siempre.

## 4 · Velocidad de Inicio y Control Maestro

Cambios (sin caché nueva, sin cambiar qué datos se leen ni quién puede leerlos):
- Clientes e inventario se piden **en paralelo** (antes uno detrás de otro).
- Inicio y Control Maestro **pintan apenas llegan clientes + inventario**; Finanzas termina después y solo esas pantallas
  muestran «Cargando movimientos de Finanzas…» (nunca un L0 falso).
- Las dos lecturas de Finanzas van en paralelo.
- Supervisión (Sublicuentas/Naara/Geisell): páginas de 500 en `control_datos` en vez de 200 (menos idas y vueltas). El
  límite de 2 MB por respuesta se mantiene.
- Inicio muestra **esqueleto** mientras carga, y una tarjeta con «Reintentar» si falla. Nunca ceros falsos.

Medición (5 corridas, Chromium, 1500 clientes, 600 inventario, 4000 movimientos FICTICIOS, latencia simulada: Firestore
600 ms, API 450 ms). Los números reales dependen de la red de cada quien; lo que vale es la diferencia.

| Escenario | Antes P50 / P75 | Después P50 / P75 | Mejora |
|---|---|---|---|
| Inicio con datos · naara (admin, supervisión) | 7 484 / 7 485 ms | **3 028 / 3 041 ms** | −60 % |
| Inicio con datos · relojes (limitado) | 3 063 / 3 065 ms | 3 042 / 3 082 ms | igual (ya pintaba desde el listener en vivo) |
| Control Maestro abierto apenas entra · naara | 6 491 / 6 515 ms | **3 442 / 3 466 ms** | −47 % |
| Control Maestro desde Inicio ya cargado · naara | 386 / 396 ms | 420 / 451 ms | igual (ya estaba en memoria) |

KPIs idénticos antes y después: **1,124 | 376 | 188 | L106,050** → no se pierde ni se duplica ningún dato.

## Archivos (Sublichat HQ · Vercel)

| Archivo | Cambio |
|---|---|
| `index.html` | `class="ui-v2"` fijo, versiones r184, sin CSS de `.theme-swatch` |
| `ui-v2.js` | siempre activo; sin «Diseño anterior»; Perfil sin galería de tema |
| `ui-v2.css` | botones del menú (tamaños, estados, acentos), esqueleto; sin CSS de apariencia |
| `ui-v2-inicio.js` | esqueleto, error con Reintentar |
| `sublichat-app.js` | tema único; sin tarjeta de tema; carga en paralelo y pintado temprano; avisos de Finanzas cargando |
| `api/importar.js` | `control_datos` acepta `pageSize` 50–500 (antes fijo 200). Solo lectura. |
| `tests/…` | r162 y r166 actualizados (ya no hay diseño anterior; R179 sumó Sala de Juntas = 10 botones); nuevas `r184-ui-unica.mjs`, `medir-carga.mjs`, `capturas-ui.mjs` |

**Retirado:** opción «Diseño anterior», tarjeta y galería «Tema de color», CSS `theme-swatch`/`tsw`/`v2-apariencia`, bandera `?ui=v1`.
**Se queda a propósito:** el DOM viejo (menú lateral y pantallas) — el diseño nuevo lo usa por dentro; está oculto con CSS.
Borrarlo sería rehacer la arquitectura (fuera del alcance del PDF).

## Riesgos

1. Usuarios que preferían el diseño anterior o un color propio ya no pueden elegirlo (es lo pedido).
2. `api/importar.js` es el único cambio en servidor: páginas más grandes (≤500, ≤2 MB). Si alguna respuesta topa 2 MB, el
   servidor ya corta la página como antes.
3. La latencia real es desconocida; la medición es simulada. Recomendado: medir en staging con DevTools (Inicio y Control Maestro).
4. Dos usuarios a la vez: no se agregó ninguna caché compartida; cada navegador lee lo suyo con sus permisos.

## Rollback

Re-subir `sublichat-app.js` e `index.html` del zip **58** (R180–R183), `ui-v2.js`/`ui-v2.css`/`ui-v2-inicio.js` del zip **37**
(R167) y `api/importar.js` anterior. Lo más simple: volver a subir el zip 58 y luego el 37 solo para los tres `ui-v2*`. No hay migraciones ni datos nuevos: el rollback es inmediato.
