# R193 · Corrección urgente: Sala de Juntas 3D dentro de la APK + Finanzas por producto (PDF 07/11/2026)

Estado: **listo para staging, NO publicado.** Se probó con datos y claves ficticias. No se tocaron montos, movimientos, pedidos ni credenciales reales. El bot de Telegram no cambia. La barra de la APK sigue igual: Inicio · Clientes · Cobros · Tickets · Más.

## Causa raíz (P0)

**Sala 3D**
- La APK no tenía sala propia: abría la sala web en Chrome.
- La sala web ya estaba completa (escena 3D, LiveKit, chat, mano, reacciones, presentación, antesala con aprobación). Lo que faltaba era poder usarla dentro de la APK con la sesión de la APK.
- La grabación de R175 era **local**: el video quedaba en el equipo de Naara. Dentro de la APK no puede funcionar.

**Finanzas**
- En R192 «Ingresos por plataforma» agrupaba por la **etiqueta guardada** en cada cobro (`netflix`, `Netflix Premium`, `⭐ Netflix Premium VIP`, `Disney Premium`, `disneyp`…).
- Después la APK traducía cada etiqueta a un nombre bonito. Por eso salían filas con el mismo nombre y montos distintos.
- **No eran cobros duplicados**: el total siempre fue el mismo. «Pago combinado» y «Sin plataforma» se mostraban como si fueran plataformas.

## Archivos

| Proyecto | Archivo | Cambio |
|---|---|---|
| **Sublichat HQ (Vercel)** | `api/_productos-canonicos.js` (nuevo) | Catálogo canónico. Netflix Premium (`netflix`) y Netflix VIP (`vipnetflix`) son productos **distintos**. «Netflix Premium VIP» en texto es **ambiguo**: va a revisión, nunca se asigna solo. |
| | `api/_finanzas-mes.js` | Atribución de cada pago a productos, en centavos. Un pago cuenta **una vez**. Si el pago trae asignaciones, se reparte en sus líneas reales. Si no hay desglose → «Pendiente de clasificar». Se conserva la etiqueta original como evidencia. |
| | `api/finanzas.js` | `finanzas_mes` usa ese motor. Nuevo `finanzas_conciliacion_mes` (antes/después, solo lectura). Nuevo `finanzas_alias_confirmar` (una persona confirma un alias con evidencia obligatoria; auditado y reversible, no toca montos). Un alias ambiguo se resuelve con la ficha del servicio cuando existe. |
| | `api/_sala-grabacion.js` (nuevo), `api/sala-juntas.js` | Grabación **completa en el servidor** (LiveKit Egress, explicada abajo). Acciones `grabacion_servidor` (iniciar / detener / estado), `grabaciones` y `grabacion_ver`. |
| | `sala-grabacion.html`, `sala-grabacion.js` (nuevos) | Plantilla de grabación: LiveKit la abre y en ella dibuja la **misma sala 3D** con avatares, quién habla, manos, reacciones, presentación y el audio real. |
| | `sala-juntas.js` | Adaptador `SalaJuntasConfig` para que la APK use su sesión. `SublichatSala.abrir / cerrar`. Grabar va al servidor. «Grabaciones de la reunión» en el acta (reproducir / descargar). |
| | `index.html` | Solo la versión `sala-juntas.js?v=…r193`. |
| | tests | `r193-sala-grabacion`, `r193-finanzas-productos` (nuevos). `r186` y `r192` ajustados a los nombres canónicos. |
| **APK** | `src/app/sala-juntas.js` | Pantalla según la maqueta: Mi avatar · Escenarios, reunión en curso con «**Entrar en la APK**», y Acciones según permisos. Todo abre una **vista interna** a pantalla completa con la sala real. Sin Chrome y sin segundo login. «‹ Volver» libera micrófono, LiveKit y 3D. |
| | `public/sala-juntas.js`, `sala-3d.js`, `sala-vivo.js`, `sala-presentar.js`, `sala-grabar.js`, `escenarios.js`, `avatar-glb.js`, `vendor/three-gltf…`, `assets/avatares/*`, `assets/sala/*`, logos | **Copia fiel** de la sala web (hay una prueba que compara byte a byte). |
| | `scripts/android-native.mjs` | Permisos `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` y `CAMERA` (la cámara es opcional). Android los pregunta cuando se activa el micrófono o la cámara. |
| | `src/app/finanzas-libro.js`, `excel-saiyajin.js`, `renovar-lote.js`, `styles.css` | Filas por producto; «Pendiente de clasificar» fuera del ranking pero dentro del total; revisión de alias; Excel con la **misma** respuesta del servidor; montos con 2 decimales (L763.10). |
| | tests | `r193-sala-interna`, `r193-finanzas-productos-apk` (nuevos). `r189` y `r192` ajustados (ya no hay Chrome). |

## Grabación completa: cómo funciona

1. Naara toca **Grabar**. Sale el aviso; al aceptarlo queda el consentimiento auditado con quiénes estaban presentes.
2. El servidor pide a LiveKit una grabación compuesta con nuestra plantilla, en MP4 720p. El archivo va a un **bucket privado**.
3. Todas las participantes ven «● Grabando», en la Web y en la APK. Al **Detener**, o cuando sale la anfitriona, el video pasa a «Procesando» y luego a «Lista».
4. En el acta de la reunión aparecen las grabaciones con su estado, duración, tamaño y quiénes estaban.
   - **Reproducir** se hace dentro de la APK o la Web, con un enlace firmado que **vence en 15 minutos**.
   - **Descargar** en la APK guarda el video en Documentos/Sublichat.
   - Solo las invitadas a esa reunión pueden ver las grabaciones, y cada vista o descarga queda auditada.
5. Si falta configurar la grabación, el botón dice exactamente qué falta. No hay botón de muestra.

### Lo que usted debe configurar (Vercel → Environment Variables; los valores no se mandan por el chat)

- `SALA_GRAB_BUCKET`: el nombre de un bucket **privado** de Google Cloud Storage solo para grabaciones.
- `SALA_GRAB_GCP_CREDENTIALS`: el JSON de una **cuenta de servicio dedicada**, con permiso «Storage Object Admin» **solo en ese bucket**. No use la cuenta de Firebase.
- `SALA_PUBLIC_BASE`: el dominio público de Sublichat con https, sin barra al final.
- Las variables de LiveKit que ya existen.
- En LiveKit Cloud, Egress debe estar habilitado.
  - **Costo:** se cobra por minuto grabado.
  - **Tope por grabación:** 120 minutos.

## Finanzas: reglas (F01–F12)

- **Mes:** solo el mes elegido, en hora de Honduras.
- **Una fila por producto:** Netflix Premium y Netflix VIP van separados.
- **Planes de una misma plataforma:** se suman en una fila (LionTV 2 dispositivos → LionTV).
- **Etiquetas ambiguas:**
  - «Netflix Premium VIP» se resuelve con la ficha del servicio (compraId). Si no hay ficha, queda **Pendiente de clasificar** hasta que una persona confirme el alias con evidencia.
  - «Pago combinado» sin desglose y «Sin plataforma» también quedan en **Pendiente de clasificar**: se ven en su detalle, nunca se inventa un reparto.
- **Invariante:** productos + pendiente = ingresos cobrados. Lo verifica el servidor y lo muestra la pantalla. Un pago de 10 plataformas cuenta una sola vez y se desglosa en 10 líneas.
- **Nada se borra ni se fusiona**: los movimientos y los montos quedan iguales.
- **Para la evidencia antes/después con sus datos reales:** Finanzas › `finanzas_conciliacion_mes` (solo lectura). Incluye el total por etiqueta (antes), el total por producto (después), si el total es igual, los alias que hay que revisar y los cobros sospechosos de duplicado. Estos últimos son solo una propuesta: no se anulan.

## Pruebas

| Proyecto | Resultado |
|---|---|
| APK | **427/427**. `vite build` OK (`dist/sala-juntas.js` y los modelos 3D van dentro del APK). |
| Sublichat HQ | 284 pasan y 3 fallan. Las 3 fallas ya existían antes de R193. |
| Bot | Sin cambios (180/180 en R192). |

- **J01/J02/J05/J10/J11:** entrar abre la vista interna, sin Chrome ni ACTION_VIEW. La sesión es la de la APK con `origen: android`. Al cerrar se libera todo. Solo la anfitriona programa.
- **J08/J09:**
  - Solo la anfitriona graba y se exige el aviso.
  - La solicitud a LiveKit lleva la plantilla, MP4 y el bucket. El token de grabación es solo de esa sala y dura 2 minutos.
  - La escena se entrega solo durante una grabación activa y sin datos sensibles.
  - La grabación pasa de procesando a lista; el enlace firmado dura 15 minutos y quien no está invitada recibe 403.
- **F01–F12:** probados con datos ficticios.
- **Capturas** (zip 87, renderizadas con el código real):
  - Agenda, antesala, **sala 3D funcionando dentro de la vista de la APK**, Mi avatar y escenarios.
  - Pantalla de inicio de la Sala en la APK.
  - Finanzas por producto con el pendiente abierto.

## Lo que NO se pudo comprobar aquí (pendiente en teléfono real, antes de publicar)

- J03/J04/J07: voz entre la APK y la Web en una reunión real, en Wi‑Fi y datos móviles, y el permiso de micrófono negado. Aquí no hay servidor LiveKit ni teléfono.
- J08/J09 de punta a punta: el video real necesita las 3 variables y Egress habilitado.
  - Riesgo conocido: el navegador de grabación de LiveKit dibuja la sala 3D sin tarjeta de video, así que puede ir lento. Si fallara, la grabación queda «Falló» con el motivo y se ajusta la plantilla. No se finge.
- Compartir pantalla del celular: Android WebView no lo permite (sale un mensaje claro). Presentar PDF o imágenes sí funciona.
- Botón físico «atrás» de Android: se usa «‹ Volver» dentro de la sala.
- La Web no tiene pantalla de ingresos por producto. Lo usan la APK y el Excel, ambos con la misma respuesta del servidor.

## Rollback

- **Sublichat HQ:** volver a subir los archivos del zip 81 (R192). Quitar `api/_productos-canonicos.js`, `api/_sala-grabacion.js` y `sala-grabacion.*`, que no rompen nada si se quedan.
- **APK:** recompilar con la fuente del zip 83.
- **Datos:** no hay migraciones. Las colecciones nuevas son `finanzas_alias_productos` y `sala_grabaciones`; si se vuelve atrás, quedan sin uso. Los videos están en su bucket privado.
