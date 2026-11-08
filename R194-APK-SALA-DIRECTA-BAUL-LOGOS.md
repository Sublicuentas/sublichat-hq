# R194 · APK: Sala de Juntas abre directo + Baúl con logos y relieve 3D

Proyecto: **APK**. Sublichat HQ y el bot no cambian. Estado: **NO publicado**.

## 1. Sala de Juntas: se quitó la pantalla preliminar

- **Causa:** la APK tenía su propia pantalla previa (de R189–R193) y desde ahí se entraba a SubliStudio 3D. Por eso se veían dos pantallas.
- **Ahora:** Más › Sala de Juntas abre **directo** la interfaz completa de SubliStudio 3D, la misma de la Web: reuniones, convocatorias, antesala, sala 3D, avatar, escenarios, actas, grabaciones y permisos.
- **Sin código duplicado:** se borró la pantalla propia de la APK (`src/app/sala-juntas.js` quedó solo como cargador de la sala real).
- «‹ Más» cierra la sala (suelta micrófono, LiveKit y 3D) y vuelve a Más.
- Si no carga, sale el error con «Reintentar».

## 2. Baúl de APKs: logos y relieve

- **Logos:** el Baúl ahora usa el **mismo catálogo de logos de toda la APK** (`screens2.platformLogoFile`). Ya no lleva una lista aparte.
  - Lion TV y Nanotech no tienen logo propio en el sistema. Usan el logo IPTV, el mismo que ya tienen en el CRM, Control Maestro y la página de acceso.
  - Si Sublicuentas tiene los logos oficiales, se colocan en `public/assets/plataformas/` y se cambia una línea.
- **Relieve 3D:** se aplicó el mismo relieve de Más a plataformas, dispositivos, opciones y botones: borde, sombra discreta, profundidad y efecto al tocar. El logo va sobre una base con relieve y se respeta «reducir movimiento».
- Se corrigió el texto «2 opciónes» → «2 opciones».
- **Sin cambios:** plataforma → dispositivo → aplicación, enlaces, códigos Downloader, mensaje para el cliente, «Copiar instrucciones» y «Enviar al cliente».

## Pruebas

- APK **426/426** y `vite build` OK.
- Pruebas nuevas:
  - La sala abre directo una sola vez, sin pantalla previa, sin Chrome y sin segundo login.
  - «‹ Más» libera la sala y vuelve.
  - Si la sala no carga, sale «Reintentar».
  - Las seis plataformas tienen logo y ninguna sale con una letra.
  - Las tarjetas tienen el relieve.
- La prueba vieja de la pantalla previa de la Sala (R189) se retiró porque esa pantalla ya no existe.

## Rollback

Recompilar con la fuente del zip 86 (R193).
