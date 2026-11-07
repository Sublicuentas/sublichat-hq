# R189 · Fase 5 de 5 — Sala de Juntas en la APK (PDF «Sublichat 5 puntos», bloque 05, 07/11/2026)

Estado: **listo para staging, NO publicado**. Pruebas con datos ficticios. No se creó ninguna reunión real.

## Auditoría: lo que ya existía (no se duplicó)

| Pieza | Estado |
|---|---|
| Sala SubliStudio 3D en Sublichat Web (`sala-juntas.js`, `sala-vivo.js`) | Tiene diseño para celular y abre una reunión con `/?sala=<id>` usando el login normal. |
| Servidor `/api/sala-juntas` | Ya tenía todo: panel, RSVP, antesala, ingreso tardío que aprueba Naara, token temporal de LiveKit, expulsar, actas y acuerdos, avatares y grabación con confirmación. |
| Acceso | Por identidad real del token, nunca por nombre de texto. Naara convoca, edita, cancela y aprueba. Libni y Geisell son fundadoras. Los demás entran solo con el módulo en Permisos. Las sesiones revocadas y los usuarios retirados no entran (R180). |
| Bot de Telegram (`lib_sala_juntas.js`) | Ya avisaba al convocar, 24 h, 1 h y 10 min antes, y al inicio, a cada invitada con Telegram vinculado. Los fallos («fallido», «sin vínculo») quedan registrados y Naara los ve. |

## Lo que se hizo

1. **APK · Más → Sala de Juntas.** Solo se agregó esta tarjeta; el navbar y las demás tarjetas no cambian. Aparece para Sublicuentas, Relojes/Libni y Geisell; el servidor vuelve a validar el acceso.
   - Muestra las reuniones próximas y las concluidas, con su estado: programada / en curso / concluida / cancelada.
   - En cada reunión: agenda, participantes con su respuesta, acuerdos y pendientes. Naara ve también los avisos de Telegram enviados, pendientes y fallidos, con el motivo.
   - Se puede responder «Asistiré» / «No asistiré» desde la APK. Usa el mismo servidor y queda auditado con canal «android».
   - **«Entrar a la sala»:**
     - Primero pide una confirmación explícita y avisa que el micrófono y la cámara solo se encienden cuando la persona lo permite dentro de la sala.
     - Después abre **la misma sala web** en Chrome (`/?sala=<id>`).
2. **Por qué en Chrome y no dentro de la APK:**
   - Chrome trae completos el 3D (WebGL), el audio en tiempo real (WebRTC) y el permiso de micrófono.
   - El visor interno de la APK no se pudo probar aquí con micrófono y 3D en un teléfono real. Es justo el caso del PDF: «si falla, navegador externo autenticado».
   - Seguridad:
     - La APK no guarda tokens de LiveKit y no manda tokens en la URL.
     - En el navegador se entra con el login normal de Sublichat, y el servidor entrega el token temporal de audio.
3. **Servidor:** `api/sala-juntas.js` ahora guarda el canal de la respuesta (web / android). No hay otras colecciones ni otra base de datos.

**Del PDF que no aplica:** «archivos compartidos» todavía no existe en la Sala web, así que no se inventó. La grabación queda en el equipo de la anfitriona (R175).

## Qué se publica dónde

| Proyecto | Archivos | ¿APK nueva? |
|---|---|---|
| **Sublichat HQ (Vercel)** | `api/sala-juntas.js` | No |
| **sublicuentas-tg-bot (Render)** | Sin cambios: los avisos de 24 h, 1 h y 10 min ya están en producción. | No |
| **APK** (`SUBLICUENTAS_ANDROID_SOURCE_1_0.zip`, rama `android-v1-r13-limpio`) | `src/app/sala-juntas.js` (nuevo); `data.js`, `screens.js`, `main.js`, `styles.css` | **Sí**: la tarjeta en Más solo aparece con APK nueva |

El zip de la APK incluye R186, R187 y R188. Suba primero los zips anteriores de Sublichat HQ y del bot.

## Pruebas

| Proyecto | Resultado | Detalle |
|---|---|---|
| Sublichat HQ | **266 de 269** | Nueva `r189-sala-apk`. Las 3 que fallan ya fallaban antes. |
| APK | **416/416** | Nueva `r189-sala-juntas-apk`; r37/r39 actualizadas por la tarjeta nueva. `vite build` OK. |

**Pendiente real en Samsung:**

1. Más → Sala de Juntas debe listar las reuniones.
2. «Entrar» debe abrir Chrome. La primera vez, iniciar sesión en Sublichat.
3. Probar micrófono y audio en una reunión de prueba con dos teléfonos.

## Rollback

- **Sublichat HQ:** volver a subir `api/sala-juntas.js` anterior.
- **APK:** reinstalar la anterior.
