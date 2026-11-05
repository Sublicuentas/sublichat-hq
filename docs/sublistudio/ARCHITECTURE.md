# SubliStudio 3D · Sala de Juntas — ARCHITECTURE

## 1. Mapa de integración

```
Sublichat Web (shell actual: barra grafito + botones cápsula)
 └─ "Sala de Juntas" (botón nuevo, después de Catálogo; solo 3 identidades)
     └─ sala-juntas.js  (se descarga SOLO al entrar; no pesa en otras pantallas)
         ├─ Panel principal · Crear convocatoria · Antesala · Mi personaje · Historial
         └─ sala-3d.js   (se descarga SOLO al entrar a la sala)
              ├─ Three.js r16x + @pixiv/three-vrm (escena Escenario C + avatares VRM)
              └─ livekit-client (audio WebRTC + data channel para gestos/pose)

/api/sala-juntas   (HQ · Vercel/Render, mismo patrón que las demás APIs)
   acciones: panel · listar · crear · guardar_borrador · reprogramar · cancelar · rsvp · abrir_sala ·
             cerrar_sala · token_livekit · avatar_obtener · avatar_guardar · acta_guardar
   ├─ valida Bearer → claim `usuario` → identidad (ACL fija de 3)
   ├─ Firestore: sala_reuniones, sala_invitaciones, sala_avisos, sala_avatares, sala_actas, auditoria_eventos
   └─ firma tokens LiveKit en servidor (TTL 2 h, room opaca, sin permisos de admin para fundadoras)

Bot Telegram existente (Render)
   ├─ lib_sala_juntas.js (nuevo): job cada minuto en el programador durable → envía avisos pendientes
   └─ callback "sj:rsvp:<invId>:<si|no>" → valida chat_id de la cuenta → actualiza SOLO esa invitación
```

## 2. Flujos

**Programar (solo Naara):** formulario → `/api/sala-juntas {accion:'crear'}` → transacción: `sala_reuniones` (estado `programada`, `inicioTS` en UTC, `tz:'America/Tegucigalpa'`), 1 `sala_invitaciones` por fundadora (id `${reunionId}_${usuario}`, idempotente), `sala_avisos` para 24 h / 1 h / 10 min / inicio solo si son futuros (id `${reunionId}_${usuario}_${tipo}_${version}`) → auditoría.

**Reprogramar:** sube `version`; avisos de la versión anterior pasan a `anulado`; se generan los nuevos. **Cancelar:** estado `cancelada`, avisos futuros `anulado`, un aviso `cancelacion`.

**Avisos:** el job del bot toma avisos `pendiente` con `programadoTS <= ahora`, los marca `enviando` en transacción (evita dobles), envía al chat_id de esa cuenta y deja `enviado` / `fallido` (reintentos acotados a 3).

**RSVP:** web o botón Telegram → solo cambia la invitación del propio usuario (en Telegram, chat_id → usuario por las mismas variables que usa Tickets).

**Entrar:** Antesala valida reunión + invitación → carga avatar guardado → pide micrófono → prueba de audio → lista de participantes con estado real → cuando Naara abre la sala, `token_livekit` devuelve un token de un solo uso de 2 h. El enlace de Telegram abre Sublichat (login normal), nunca lleva token.

## 3. Datos (Firestore)

| Colección | Campos |
|---|---|
| `sala_reuniones/{id}` | titulo, agenda[], inicioTS (Timestamp), tz, duracionMin, estado (borrador·programada·en_curso·finalizada·cancelada), anfitrion, participantes[], recordatorios {h24,h1,m10}, salaAbierta, roomId (opaco), version, creadoPor/At, actualizadoAt |
| `sala_invitaciones/{reunionId_usuario}` | reunionId, usuario, estado (pendiente·aceptada·rechazada), respondidoAt, canal (web·telegram) |
| `sala_avisos/{id}` | reunionId, usuario, tipo (invitacion·h24·h1·m10·inicio·cancelacion), programadoTS, estado (pendiente·enviando·enviado·fallido·anulado), intentos, enviadoAt, error |
| `sala_avatares/{usuario}` | modelRef (VRM permitido), config {genero, piel, cabello, colorCabello, ropa, accesorios}, version, thumbnail (≤60 KB), actualizadoAt |
| `sala_actas/{reunionId}` | autor, resumen, acuerdos[{texto, responsable, vence, estado}], actualizadoAt |
| `auditoria_eventos` (existente) | tipo `sala_juntas`, accion, actorUsuario, objetivo, resultado |

Índices: `sala_avisos (estado, programadoTS)`, `sala_invitaciones (usuario, estado)`.

## 4. Escena 3D (Escenario C · Cálida Ejecutiva)

- Construida en Three.js con geometría y materiales propios (madera, mesa ovalada, sillas, plantas, repisas, luces cálidas, pantalla con el logo oficial). Sin assets de terceros sin licencia.
- Asientos: Naara al centro (cabecera), Libni izquierda, Geisell derecha, 3 asientos futuros configurables.
- Cámaras: C1 general · C2 hablante activo (umbral sostenido + retardo mínimo entre cortes) · C3 presentación · C4 panorámica · manual. Transiciones de 600–1000 ms.
- Rendimiento: carga diferida, calidad automática (sombras/pixelRatio según FPS), modo bajo en celular, aviso si no hay WebGL.

## 5. Dependencias (solo dentro del módulo, por CDN fijo con versión)

| Librería | Licencia | Uso |
|---|---|---|
| three | MIT | escena |
| @pixiv/three-vrm | MIT | avatares VRM |
| livekit-client | Apache-2.0 | audio y datos en tiempo real |

No se instala React/Next ni otro framework: Sublichat es vanilla JS y el módulo sigue ese patrón.

## 6. Seguridad

Autorización en cada acción del servidor · tokens de tiempo real firmados en servidor, TTL corto, room opaca · grabación solo con opt-in y aviso a todas (no grabación silenciosa) · sin audio ni credenciales en logs · secretos solo en variables de entorno (`.env.example` sin valores).
