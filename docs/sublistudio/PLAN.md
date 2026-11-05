# SubliStudio 3D · Sala de Juntas — PLAN (Fase 0)

Fuente: `SUBLISTUDIO_3D_SALA_JUNTAS_PDF_MAESTRO_PARA_CLAUDE.pdf` v2.0 (05/11/2026), 30 páginas.
Este documento es la entrega de la Fase 0 (auditoría + plan + costos). **No se programó nada todavía**, tal como pide la pág. 28.

## 1. Lo que ya existe y se reutiliza (auditado en el código)

| Pieza | Dónde está | Cómo se usa en la Sala |
|---|---|---|
| Web Sublichat (vanilla JS, sin React/build) | `index.html` + `sublichat-app.js` + `ui-v2.*` | La categoría "Sala de Juntas" se agrega a la barra superior (después de Catálogo). Las pantallas viven en un archivo aparte que solo se carga al entrar (`sala-juntas.js`). |
| Sesión / identidad | `/api/login` → Firebase custom token con claims `{usuario, role}`; `window.fetch` agrega el Bearer | Toda API de la sala valida el token y el `usuario` del claim. No hay segundo sistema de usuarios. |
| Permisos por módulo | `api/_permisos.js` (R162) | Se agrega el módulo `sala-juntas`. **Además** una ACL fija de 3 identidades (ver §3): aunque Sublicuentas active el módulo para otro usuario, la API lo rechaza. |
| Base de datos | Firestore (proyecto `sublicuentasbot`) vía `firebase-admin` | Colecciones nuevas con prefijo `sala_` (§4). No se toca ninguna colección existente. |
| Telegram | Bot existente (Render, polling) + `TELEGRAM_CHAT_ID_SUBLICUENTAS / _RELOJES / _GEISELL` ya usados por Tickets | Invitaciones y recordatorios salen por el MISMO bot. No se crea un segundo bot ni webhook. |
| Programador durable | `bot/index_24_durable_scheduler.js` (corridas con candado en Firestore) | Un job nuevo cada minuto revisa `sala_avisos` pendientes y los envía una sola vez. |
| Botones de Telegram | `bot.on("callback_query")` en `index_06_handlers.js` | Callback nuevo `sj:` para Confirmar / No asistiré, validando chat_id ↔ usuario. |
| Auditoría | colección `auditoria_eventos` | Cada crear/reprogramar/cancelar/RSVP/entrar/expulsar queda registrado. |
| Hosting | Sublichat en Vercel (migración a Render en curso, `server.mjs`) | Las APIs nuevas funcionan igual en los dos (mismo patrón `/api/<nombre>`). |

## 2. Fases (pág. 26) y lo que entrega cada una

| Fase | Contenido | Toca | Evidencia |
|---|---|---|---|
| **F0** (esta) | Auditoría, PLAN, ARCHITECTURE, COSTOS, `.env.example` | solo docs | este zip |
| **F1** Shell + UX | Botón "Sala de Juntas" en la barra; Panel principal, Crear convocatoria (solo Naara), Antesala; APIs `sala-juntas` (crear/editar/cancelar/listar/RSVP) con datos reales | HQ | capturas vs PDF págs. 4-9, pruebas de permisos (3 UIDs, Naara-only, acceso por URL negado) |
| **F2** Telegram + agenda | Invitación por fundadora, avisos 24 h / 1 h / 10 min / inicio, reprogramar = anular y recalcular, cancelar, botones Confirmar/No asistiré | HQ + bot (archivo nuevo + 1 job + 1 callback) | mensajes reales a las 3 cuentas, sin duplicados |
| **F3** Escena + avatares | Escenario C en Three.js (madera, plantas, luces cálidas, mesa ovalada, pantalla con logo); avatares VRM; editor "Mi personaje" guardado por usuario en Firestore | HQ (+ assets) | escena navegable, avatar persiste tras salir/otro navegador |
| **F4** Sala en tiempo real | LiveKit: audio de las 3, presencia, hablante activo, cámaras virtuales C1–C4, compartir pantalla, reconexión | HQ + cuenta LiveKit | sesión real con 3 dispositivos |
| **F5** Actas + optimización | Actas y acuerdos, historial, modo calidad baja/móvil, límites de costo | HQ | pruebas de red/móvil |
| **F6** Despliegue gradual | Piloto con las 3 fundadoras, monitoreo, rollback | — | aprobación |

**Regla de publicación (pág. 2):** nada sale a producción hasta que Naara, Libni y Geisell estén juntas en la misma sesión 3D con audio y avatares sincronizados.

## 3. Permisos (pág. 16)

ACL fija en servidor por identidad verificada (claim `usuario` del token), **no por rol**:

| Identidad | Usuarios que la representan hoy | Ver | Crear/reprogramar/cancelar | Moderar | RSVP / avatar / hablar |
|---|---|---|---|---|---|
| Naara (anfitriona) | `sublicuentas`, `naara` | Sí | Sí | Sí | Sí |
| Libni (fundadora) | `libni`, `relojes` | Sí | No | No | Sí |
| Geisell (fundadora) | `geisell`, `geissel` | Sí | No | No | Sí |

Cualquier otro usuario (aunque sea admin o tenga el módulo activado en Permisos) recibe 403 en las APIs, no ve el botón y no recibe token de LiveKit. Un enlace reenviado no sirve porque la sala exige sesión Sublichat válida y el token de LiveKit se emite en el servidor con TTL corto.

**Por confirmar con el dueño:** si Libni y Relojes son la misma persona/cuenta (en el código `libni` y `relojes` son alias del mismo rol). Si no lo son, se deja solo `libni`.

## 4. Datos (Firestore, colecciones nuevas)

Ver `ARCHITECTURE.md §3`. Ninguna migración ni cambio en colecciones existentes.

## 5. Lo que necesito del dueño antes de cada fase

| Antes de | Qué | Costo |
|---|---|---|
| F1 | Aprobar este plan | — |
| F2 | Confirmar que Naara, Libni y Geisell ya escribieron `/start` al bot (si no, Telegram no deja enviarles) | — |
| F3 | Avatares: elegir A) personajes VRM hechos en **VRoid Studio** (gratis; usted o yo armamos los 3) o B) comprar/encargar modelos. El editor "Mi personaje" cambia tono de piel, cabello, color, ropa y accesorios **dentro** del modelo elegido | A: L0 |
| F4 | Crear cuenta **LiveKit Cloud** (plan Build, gratis) y poner `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` en Vercel/Render (desde el panel, no por chat) | L0 (ver COSTOS) |

## 6. Riesgos y límites honestos

- **Audio en tiempo real** depende de un servicio externo (LiveKit). Sin esas variables, la sala muestra un aviso claro y no finge estar conectada.
- **Personajes 3D:** las ilustraciones del PDF son arte conceptual; no son modelos 3D. Un PNG no se presentará como personaje 3D (pág. 27).
- **Equipos lentos / celular:** modo calidad baja automático; si WebGL o el micrófono fallan, la antesala lo dice y permite entrar como oyente.
- **Telegram** no entrega si la persona no inició el bot o lo bloqueó: se registra `failed` y se muestra en el panel.
- La sala NO modifica CRM, Renovaciones, Control Maestro, Portal, Catálogo, Finanzas, APK ni permisos existentes.

## 7. Rollback

- Desactivar el módulo `sala-juntas` en Usuarios y permisos (o quitar la línea del menú) → el botón desaparece.
- Las APIs nuevas son archivos nuevos; borrarlos no afecta nada más.
- En el bot, el job y el callback nuevos se apagan con `SALA_JUNTAS_ENABLED=0`.
- Las colecciones `sala_*` se pueden dejar; no las lee ningún otro módulo.

## Estado al 05/11/2026 · Fase 1 entregada (R167)

Decisiones del dueño: Libni = cuentas `libni` y `relojes` · avatares con VRoid Studio (gratis) · plan aprobado.

Hecho (Sublichat HQ):
- Botón **Sala de Juntas** en la barra superior, después de Catálogo; solo lo ven Naara, Libni y Geisell.
- `api/sala-juntas.js` + `api/_sala-juntas.js`: panel, crear / guardar borrador / reprogramar / cancelar (solo Naara), confirmar asistencia (cada una la suya), antesala, abrir/cerrar sala (solo Naara). Toda la autorización se repite en el servidor.
- Avisos de Telegram quedan creados en `sala_avisos` (24 h, 1 h, 10 min, inicio; reprogramar anula y recalcula; cancelar avisa). **El envío lo hace la Fase 2.**
- Pantalla `sala-juntas.js`: Panel principal, Crear convocatoria, Antesala (prueba real de micrófono y audio), Calendario, Mis reuniones, Historial, Configuración.
- Pruebas: `tests/r167-sala-juntas.test.mjs` (7) y `tests/visual/r167-sala.mjs` (Naara programa, Libni confirma, celular, Magdiel bloqueado).

No hecho todavía (y la pantalla lo dice así, sin fingir): envío por Telegram (F2), personaje 3D y editor (F3), sala 3D con audio en tiempo real (F4), actas (F5).

## Fase 2 entregada (R168 · 05/11/2026) · Telegram

- Bot (sublicuentas-tg-bot): `lib_sala_juntas.js` envía cada 30 s los avisos de `sala_avisos` (invitación, 24 h, 1 h, 10 min, inicio, cancelación) al chat de cada cuenta (`TELEGRAM_CHAT_ID_SUBLICUENTAS` / `_RELOJES` / `_GEISELL`). Una sola vez aunque haya dos instancias (transacción). Reprogramada → los avisos de la versión vieja se anulan. Bot apagado a la hora → recordatorio "vencido" (no llega tarde). Bloqueado / sin /start → "fallido" sin reintentar sin fin.
- Botones Confirmar / No asistiré (`sj:r:<invitación>:a|n`): solo funcionan desde el chat de esa cuenta; actualizan solo esa invitación; se avisa a Naara; idempotente; auditado.
- Botón "Abrir convocatoria segura": `https://sublichat.capuchino.lat/?sala=<id>` (o `SUBLICHAT_WEB_URL`). Abre Sublichat con su login normal y la antesala de esa reunión. Sin tokens.
- Sublichat: Naara ve en cada reunión cuántos avisos salieron, cuántos faltan y cuáles no llegaron (y por qué).
- Apagar: `SALA_JUNTAS_ENABLED=0` en el servicio del bot.

## Fase 3 entregada (R169 · 05/11/2026) · Mi personaje + Escenario C

- `sala-3d.js` (módulo que se descarga solo al abrir Mi personaje o la sala; three.js 0.160.0 desde jsDelivr, licencia MIT).
- Personajes 3D construidos en código (no imágenes): mujer/hombre, 7 tonos de piel, 8 estilos y 7 colores de cabello, ojos, cejas, blazer/camisa/polo/blusa con colores, pantalón/falda, calzado, lentes, aretes, reloj, barba, logo. Giro 360° (arrastrar o flechas).
- Guardado por cuenta en Firestore `sala_avatares/{naara|libni|geisell}` con control de versión (si se cambió en otro dispositivo, avisa en vez de pisar) y miniatura (≤90 KB). Solo se aceptan opciones de la lista; nada de texto libre ni URLs.
- Escenario C navegable: madera, libreros, plantas, luces cálidas, mesa ovalada con flores, laptops, pantalla con el logo; Naara al centro, Libni izquierda, Geisell derecha + 3 sillas libres. Cámaras: general, plano de cada una, presentación, panorámica (transiciones suaves; con "reducir movimiento" cambian sin animación). Calidad baja automática si el equipo va lento; aviso si no hay WebGL.
- Antesala: muestra el personaje guardado; si no existe, "Crear mi personaje" y vuelve a la antesala al guardar. "Ver la sala 3D (vista previa)".
- **VRoid:** los modelos VRoid (.vrm) se hacen en la app VRoid Studio (escritorio). Cuando los exporten, se cargan con el mismo editor (campo `modelRef`) y three-vrm; esta entrega no los incluye.
- Pendiente Fase 4: audio en tiempo real (LiveKit), presencia, hablante activo automático, compartir pantalla.
