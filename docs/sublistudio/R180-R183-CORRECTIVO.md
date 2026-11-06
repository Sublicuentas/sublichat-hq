# SubliStudio 3D · Paquete correctivo R180–R183 (PDF «4 cambios obligatorios», 06 nov 2026)

Estado: **listo para staging, NO publicado**. Nada de esto se probó en producción. Las pruebas usan Firestore en
memoria, LiveKit simulado y usuarios ficticios (`daniela`, `jimena`, `prueba`).

## Etapa 0 · Auditoría (lo que se encontró en el código)

| Punto | Hallazgo |
|---|---|
| ¿De dónde salen los usuarios? | `AUTH_USERS_JSON` (Vercel) → `api/login.js` crea el token de Firebase con UID `record.uid` o `asesor-<usuario>`. No hay otra tabla de usuarios. |
| Magdiel en la Sala | En el código de la Sala **no hay ningún "magdiel" fijo**. Aparecía solo en mis datos de prueba (R179). Corregido: las pruebas ya no usan ese nombre. En producción solo saldría si sigue en `AUTH_USERS_JSON` **y** alguien le activa el módulo. |
| "magdiel" en el CRM | El texto `magdiel` está fijo en Tickets, Importar, Finanzas, Auditoría, `index.html` y `sublichat-app.js`, **pero ahí es una CLAVE DE ROL** ("auditoría"), que hoy usa **Geisell** (`canonUser`: geisell → 'magdiel'). Borrarlo por nombre rompería la Auditoría de Geisell. **No se tocó** (regla: no alterar el CRM). |
| UID real de Magdiel | No lo puedo ver: está en `AUTH_USERS_JSON` de Vercel. El retiro lo toma de ahí automáticamente (`uid` del registro o `asesor-magdiel`). |
| Telegram | El bot (Render) solo conocía los chats de las 3 fundadoras por variables `TELEGRAM_CHAT_ID_*`. No había forma de vincular a nadie más. |

## Etapa 1 · Retiro de usuario (R180) — una sola fuente: `config/sublichat_permisos.retirados`

Permisos → tarjeta del usuario → **Retirar usuario** → escribir el usuario exacto → confirmar. Solo Sublicuentas.

| Capa | Qué pasa |
|---|---|
| Login | `api/login.js` responde 403 «fue dado de baja» aunque la clave sea correcta y siga en `AUTH_USERS_JSON`. |
| Firebase | `revokeRefreshTokens(uid)` + `updateUser(uid, {disabled:true})`. Las APIs de Permisos y Sala usan `verifyIdToken(token, true)` → rechazo inmediato. |
| Módulos / menú | `_permisos.efectivos()` y `pantallasVisibles()` → todo apagado; `decidir()` (Finanzas) → niega. El navegador del retirado cierra sesión al refrescar permisos. |
| Listas | Sale de Permisos (pasa a «Usuarios retirados», con Reactivar), del selector de la convocatoria y de los miembros de la Sala. |
| Sala de Juntas | Sale de convocatorias **futuras** (programadas, borradores, en curso), invitación = `retirado`, avisos de Telegram anulados, solicitudes canceladas, vínculo de Telegram borrado; si está dentro de una sala en vivo, LiveKit lo saca. |
| Historial | **No se borra**: ventas, clientes, pagos, contabilidad, auditoría, reuniones pasadas y actas. Opción: borrar su personaje 3D (dato personal). |
| Auditoría | `retirar_usuario` (con UID) y `retirar_usuario_sala` (con el detalle) en `auditoria_eventos`. Idempotente. |

**Límite honesto:** las APIs del CRM que no consultan permisos (clientes, ventas…) siguen aceptando un token ya emitido
hasta que vence (máx. 1 hora). Como el refresh está revocado y la cuenta deshabilitada, no puede renovar ni volver a
entrar. Bloquearlas al segundo exigiría tocar cada API del CRM (fuera del alcance permitido).

**Pendiente de Sublicuentas:** para Magdiel, retírelo desde Permisos (si aún aparece) y quítelo de `AUTH_USERS_JSON`.

## Etapa 2 · Ingreso tardío (R181)

- Si la sala está abierta **y ya pasó la hora de inicio**, todo invitado (no la anfitriona) queda en **sala de espera**:
  el servidor no entrega token de LiveKit → no oye, no ve, no tiene chat ni avatar.
- «Solicitar ingreso» crea una solicitud ligada a reunión + usuario + `requestId`, vence en **2 minutos**, no se duplica al recargar.
- Solo **Sublicuentas/Naara** aprueba o rechaza (`resolver_solicitud`, validado en servidor; cualquier otra cuenta → 403).
  Aviso instantáneo en la sala (panel «Solicitud de acceso») y por Telegram si está vinculado.
- Aprobado: token de 60 min máx., para ese usuario y esa sala; vale para reconectar **en la misma sesión** de la sala.
- Rechazado / vencido: mensaje claro; pedir de nuevo = nueva solicitud. Expulsado: no puede pedir de nuevo en esa sesión.
- Quien esperó en la antesala **antes** de la hora entra directo cuando Naara abre.

## Etapa 3 · Telegram para todos (R182) — mismo bot de Render, sin bot nuevo

1. Sublichat → Sala de Juntas → **Vincular Telegram** → enlace `t.me/<bot>?start=sj_<token>` (un solo uso, 15 min).
2. En el bot: Iniciar → el bot guarda `sala_telegram/<usuario>` y manda un **mensaje de prueba**; solo si Telegram responde OK queda **LISTO**.
3. Convocatoria: todos los invitados reciben convocatoria, recordatorios, cambios y cancelación.
   Quien no está vinculado queda `sin_vinculo` → la reunión muestra **«envío incompleto»** y a quién le falta; nunca «enviado».
4. Al vincularse, el bot reactiva sus avisos; Naara también tiene **Reintentar envío**.
5. Bloqueó al bot → `fallido` + Telegram «bloqueado» visible. Retirado → ningún envío.
6. «Enviado» = la API de Telegram aceptó el mensaje; no significa «leído».

**Variable nueva en Vercel (no secreta):** `TELEGRAM_BOT_USERNAME` = usuario del bot de Sublicuentas (sin @).
Las fundadoras siguen usando sus `TELEGRAM_CHAT_ID_*` de siempre (salen como «LISTO · configurado»).

## Etapa 4 · Avatares (R183)

- Boca por **nivel real de voz** de LiveKit (`audioLevel`), suavizado por tiempo (ataque 45 ms, caída 120 ms, umbral de silencio).
  Micrófono apagado = 0 = sin boca. Cada avatar responde solo a su participante.
- Editor: acercamientos **Rostro / Torso / Cuerpo**, además de Frente, Lateral, 3/4, Espalda y 360°.
- Ya estaba (R177): pose relajada, dedos flexionados, prendas modulares (blazer, blusa, camisa, falda…), colores por prenda,
  logo oficial en el pecho, lentes, aretes, collar, reloj anclados a huesos.

**Límites honestos:** el modelo es el kit gratuito Quaternius (CC0, estilo low-poly). No llega al nivel de las ilustraciones
de referencia del PDF; eso requiere modelos GLB/VRM nuevos (artista 3D o un pack de pago). No hay animación de caminar
(el kit no trae clips); el video muestra 360°, acercamientos y sentado hablando.

## Rollback

- Sublichat HQ: volver a subir el zip 57 (R179). Los campos nuevos (`retirados`, `sala_solicitudes`, `sala_telegram`,
  `sala_tg_tokens`, estado `sin_vinculo`) quedan en Firestore sin efecto. Si algún usuario quedó retirado y se quiere
  revertir: Permisos → Reactivar (antes del rollback) o borrar `retirados.<usuario>` en `config/sublichat_permisos`.
- Bot: volver a subir `lib_sala_juntas.js` e `index_06_handlers.js` anteriores. Los avisos `sin_vinculo` simplemente no se envían.
- Ninguna migración destructiva. Apagado general: `SALA_JUNTAS_ENABLED=0` (Vercel y Render).
