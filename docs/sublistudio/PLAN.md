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

## Fase 4 · Hecha (R170) — sala en vivo con LiveKit
- **Servidor** (`api/sala-juntas.js`): `token_tiempo_real` firma un JWT HS256 con Node `crypto` (sin dependencias nuevas; verificado con `TokenVerifier` del SDK oficial). Solo invitadas, solo reuniones programadas/en curso, desde 30 min antes hasta 60 min después del final previsto, máximo 2 h por token. Libni y Geisell esperan a que Naara entre; **cuando Naara entra, la sala se abre sola**. El secreto nunca sale del servidor ni se escribe en logs.
- **Moderación** (solo Naara): `expulsar` (API de LiveKit `RemoveParticipant`) y `cerrar_sala` / botón **Terminar** (`DeleteRoom`: corta la llamada para todas). Todo queda en `auditoria_eventos` (`entrar_sala`, `expulsar`, `cerrar_sala`).
- **Cliente** (`sala-vivo.js`, se descarga solo al entrar): audio con cancelación de eco/ruido; si el micrófono está bloqueado entra como oyente. Presencia (ausentes transparentes con "no ha entrado"), 🔇 en la etiqueta, hablante activo mueve la boca, **cámara automática** (corta a quien habla tras 1.5 s, mínimo 4 s entre cortes, vuelve a la general tras 6 s de silencio; elegir una vista manual la apaga, "Automática" la vuelve a activar). Compartir pantalla se ve **en la pantalla de la sala 3D** y pasa a vista presentación. Cámara opcional en recuadros. Chat y reacciones por canal de datos (no se guardan). Aviso de reconexión, "Quedan 5 minutos" y corte al tope de tiempo. Si la sacan, la reunión termina o entra desde otro dispositivo, vuelve a la antesala con el motivo.
- **Grabar** sigue apagado: necesita aprobación y tiene costo aparte (Egress).
- Pruebas: `tests/r170-sala-tiempo-real.test.mjs` (5) y `tests/visual/r170-sala-vivo.mjs` (3 recorridos con LiveKit simulado).
- **Antes de producción:** prueba real con 3 dispositivos (Naara, Libni, Geisell) en el entorno de prueba.

## Fase 5 · Hecha (R171) — interacción en la reunión (PDF "Avatares + Reuniones interactivas" v2.0)
- **Pantalla completa** (botón arriba o tecla F): usa la Fullscreen API; si el navegador no la permite (iPhone, algunos Android) entra en **modo expandido** que ocupa toda la pantalla. Se sale con "Salir del modo" o Escape. No corta el audio ni la conexión.
- **Mano levantada y turnos**: "Mano" pone a la persona en la cola (orden de hora), se ve ✋ en su etiqueta y el brazo arriba. Naara recibe aviso, ve la cola en Participantes y puede **Dar la palabra** (el personaje saluda), **Terminar turno** (la mano de esa persona baja sola y se sugiere la siguiente) o **Limpiar cola**. Cada quien puede retirar su mano. La cola no apaga micrófonos. El turno solo se acepta si lo pone Naara (atributos de LiveKit; el token permite a cada una cambiar solo sus propios atributos).
- **6 reacciones** (Aplausos, Me gusta, Corazón, Risa, Sorpresa, Fiesta), con nombre accesible, teclas 1–6, 2-3 s sobre el personaje, respeta "reducir movimiento". Límite anti-spam al enviar (1 cada 1.2 s, máx. 6 cada 10 s) y al recibir. No se guardan.
- **Modo presentación**: cuando otra comparte pantalla, la presentación ocupa ~78 % y las fundadoras quedan en una banda lateral (quién habla, micrófono, turno). "Volver a la sala" la deja en la pantalla 3D; "Ver presentación en grande" la vuelve a abrir.
- **Ver**: panel de vistas de cámara también en celular y pantalla completa.
- **Duración**: ya no se corta la llamada al tope; avisa 5 min antes y a la hora de fin (la anfitriona cierra con Terminar).
- **Android**: "Guardar personaje" queda fijo encima de la barra inferior (ya no se tapa); dentro de la sala se oculta la barra inferior del sistema para que no tape controles.
- Compartir imágenes/PDF/video **no** se hace (decisión del propietario: solo compartir pantalla por ahora, costo cero).

## Fase 3B · Hecha (R172) — avatares 3D reales, sin pagar ni instalar
- **Modelos**: Quaternius *Ultimate Modular Women/Men* (CC0 1.0, uso comercial permitido), integrados en el proyecto (`assets/avatares/*.glb`, 920 KB y 784 KB comprimidos). Origen, commit y huellas en `assets/avatares/LICENCIAS.md`. El paquete "Universal Base Characters" que sugería el PDF no trae ropa en su versión gratis; estos sí, del mismo autor y licencia.
- **Dos bases** con esqueleto (mujer 51 huesos, hombre 49). **Mujer**: 6 peinados, blazer/blusa/vestido/camiseta/chamarra, pantalón formal/falda/pantalón casual, formal/tacones/casual/botas. **Hombre**: 6 peinados (incluye con barba), traje/suéter/camiseta/chaleco, pantalón/jeans/shorts, formal/tenis/casual, aretes y bigote. Cada prenda es una malla distinta.
- Colores por rol (piel, cabello, ojos, prenda principal, camisa interior, abajo, calzado). Lentes, aretes de mujer, reloj y logo son piezas pequeñas colgadas de los huesos.
- **Posturas por huesos**: de pie (editor), sentada en la sala, mano levantada y saludo; cabeza se mueve al hablar.
- **Editor**: vistas Frente / 3/4 / Espalda, acercar/alejar (botones o rueda), restablecer cámara, giro 360°. Cambiar prenda es instantáneo; cambiar de base carga el otro modelo.
- **Persistencia**: mismo documento `sala_avatares/{usuario}` con `modelRef: glb:quaternius-modular:20261105-r172`. Los personajes guardados antes se **migran solos** (p. ej. cola→recogido, polo→camiseta, color de calzado se conserva). Las miniaturas del muñeco anterior ya no se muestran hasta volver a guardar.
- **Respaldo**: si el modelo no descarga, aparece el personaje anterior con aviso; no se borra nada.
- Pruebas: `tests/r172-avatares-glb.test.mjs` (4) y `tests/visual/r172-avatares-glb.mjs` (4 recorridos).

### Pendiente honesto de la Fase 3B
- **Expresiones faciales (6 gestos)**: estos modelos no traen "blendshapes" de cara. Hoy al hablar se mueve la cabeza; la boca no. Falta un modelo con gestos (VRM) o agregar huesos de mandíbula.
- **Polo con cuello**: no viene en el paquete; está "camiseta". **Suéter de mujer**: no viene.
- Estilo **low-poly facetado** (caras planas): es el estilo del autor; no es igual a las ilustraciones aprobadas.
- Tipos de cuerpo (delgada/media/curvilínea) no incluidos: una sola complexión por base.

## Fase 5 · Cierre (R173) — según el documento maestro "Ecosistema completo"
- **Presentar imágenes, PDF y video sin subir archivos**: botón "Presentar". El archivo se abre en el equipo de quien presenta, se dibuja en un lienzo y se transmite por LiveKit como pantalla compartida (PDF con pdf.js, página por página; video MP4/WebM con su audio; varias imágenes = páginas). Controles: Anterior/Siguiente (o flechas del teclado), Reproducir/Pausa, ±10 s, Dejar de presentar. No se guarda nada en servidores (costo cero, como se decidió).
- **Acta y acuerdos**: al pulsar Terminar, Naara pasa directo a escribir el acta (resumen, decisiones, acuerdos con responsable y fecha). Asistentes y duración salen del registro real de entradas (no se pueden inventar). Cada responsable marca su acuerdo como cumplido; Naara puede marcar cualquiera y editar el acta (control de versión). Historial muestra "Ver acta" y avisa de acuerdos pendientes.
- **Cámara libre** (arrastrar para girar, rueda o pellizco para acercar), **Ajustes** (elegir micrófono y salida de audio), **enlaces en el chat** (solo http/https, se abren aparte, sin HTML), **collar** en accesorios.
- Pruebas: `tests/r173-acta-acuerdos.test.mjs` (3) y `tests/visual/r173-presentar-acta.mjs` (8 recorridos).

## Fase 6 · Hecha (R174) — escenarios y editor común de estilos
- **5 escenarios**: Sala de Juntas Cálida Ejecutiva (la aprobada; con su estilo base se ve exactamente igual que antes), Sala de Socios, Subli Aula, Subli Live y Subli Cinema (`escenarios.js`, geometría ligera, sin descargas).
- **Editor común** (Sala de Juntas → "Escenarios y estilos"): 4 paredes/fondos, 4 asientos/sets, 5 paletas y 4 iluminaciones por escenario, vista previa 3D con los avatares, **Restablecer** al estilo base, **estilos guardados con nombre** ("Junta mensual", "Anuncio promo"…). Cualquier fundadora guarda los suyos; solo quien lo creó o Naara lo cambia/borra; **solo Naara marca el oficial**. Colección `sala_escenarios/{escenario}`.
- **Convocatoria** elige escenario y estilo; la antesala lo muestra y la reunión en vivo se arma con ese estilo (si no eligió, el oficial; si no hay, el base).
- Cambiar estilos no toca reuniones, avatares, actas ni grabaciones.

## Fase 7 · Hecha (R175) — grabación
- Botón **Grabar** (solo Naara): graba la sala 3D (incluye pantalla/presentación) con el audio de todas mezclado en su navegador. Al **Detener**, el video (.webm) se descarga en su equipo. **No se sube a ningún servidor** y no usa la grabación de LiveKit (que se cobra aparte).
- Todas ven **"● Grabando 0:00"** mientras dura (atributo de la anfitriona; un aviso falso de otra no cuenta). Se registra inicio/fin y duración en auditoría y el acta dice "Grabada".
- Límites: 120 minutos o ~1.8 GB por grabación. Funciona en Chrome/Edge de computadora; en iPhone no.

## R176 — sin borrado automático + 15 minutos
- La actualización cada 30 s ya no repinta si hay un formulario, un campo con foco o algo escrito sin guardar. Después de guardar sí se actualiza.
- Duración de reunión: 15, 30, 45, 60, 90 y 120 minutos.

## R177 — Correcciones avanzadas (PDF de correcciones)
- **Avatar:** pose de descanso (brazos separados del torso, codo flexionado, dedos relajados), sentado con manos juntas. Lentes rectangulares con micas, aretes colgantes, collar que cae en "U" sobre la ropa con dije, reloj en la muñeca con carátula visible, logo real de Sublicuentas sobre el pecho (versión clara u oscura según el color de la ropa; se ajusta a la superficie de cada prenda).
- **Editor:** vistas Frente, Lateral, 3/4, Espalda y giro 360° continuo. Campo **Nombre visible** (24 caracteres) con vista previa inmediata; se guarda con el personaje y se ve sobre el avatar y en la lista de participantes.
- **Voz:** quien habla tiene aro verde luminoso en la base, etiqueta con ondas animadas y boca que se mueve (sutil). Respeta "reducir movimiento".
- **Ambiente:** por escenario, secciones Iluminación (tipo + intensidad suave/normal/más brillante), Piso (madera/neutro/oscuro/claro), Paredes, Asientos, Paleta, Decoración (plantas, cuadros, lámparas de pie, mesas auxiliares, paneles informativos, utilería) y Logo/branding. Estilos sugeridos: Junta mensual, Reunión sobria, Anuncio, Presentación, Grabación limpia. Todo se guarda en los presets.
- **Convocatoria:** Tipo de sesión (Junta, Revisión, Clase, Presentación, Grabación de anuncio, Otra) que sugiere escenario y estilo. Participantes con rol y permisos. La reunión guarda tipo, escenario, preset/sugerido y una copia del estilo; "Repetir con este escenario" desde el historial.
- **Durante la reunión:** estados por asistente (En la sala, Hablando, Mano levantada, Micrófono apagado, No ha entrado). **Modo grabación** en Ajustes: plano frontal, luz más limpia, sin plantas/cuadros/utilería ni nombres.
- Pendiente de decidir: invitar a usuarios autorizados además de las 3 fundadoras (requiere permisos de Sala por usuario y asientos extra).

## Riesgos conocidos
- Escenarios hechos con geometría simple: la distribución, colores, luces y mobiliario siguen el PDF, pero no el detalle de ilustración (personas en la sala, ventanas, libreros completos).
- Grabar consume CPU en el equipo de Naara; si la máquina es lenta, la sala 3D baja de calidad sola.
- Presentar video depende del formato que el navegador sepa reproducir (MP4 H.264 o WebM).

## Cómo revertir (rollback)
- R177: volver a subir 53 deja todo como antes de las correcciones (los campos nuevos `nombre`, `tipo`, `sugerido`, `estiloUsado`, `piso`, `brillo`, `deco` se ignoran).
- Volver a subir el zip anterior encima: 49 (Fase 5) deja todo como antes de escenarios y grabación; 47 (avatares) deja todo como antes de la Fase 5. Los datos nuevos (`sala_escenarios`, campos `escenario`/`presetId` en reuniones, actas) quedan guardados y las versiones anteriores simplemente los ignoran.
- Apagar todo el módulo sin tocar código: variable `SALA_JUNTAS_ENABLED=0` en Vercel.
