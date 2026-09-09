# Activar TV — instalación del navegador

El módulo de Sublichat está implementado para **Geisell, Relojes y Sublicuentas**
(también reconoce los accesos existentes `geissel`, `libni` y `naara`).
Permite escribir cualquier correo y clave sin registrar la cuenta en el CRM.
La selección de cuentas guardadas es opcional y utiliza sólo los datos que la
sesión de Sublichat ya tiene disponibles.

## Estado de esta entrega

Incluye la pantalla, la API autenticada, el servicio de navegador, la configuración
Docker y las pruebas de lógica. **Todavía no está desplegado ni conectado a un
navegador de producción.** No se ha realizado un inicio de sesión real ni una
activación de TV en las seis plataformas. Los adaptadores deben comprobarse con
una cuenta autorizada y un TV antes de habilitarlos para trabajo diario.

Las plataformas externas pueden cambiar formularios, pedir verificaciones o
rechazar un navegador de servidor. Un enlace correcto por sí solo no demuestra
compatibilidad. El servicio conserva la página real para que el operador pueda
completar pasos adicionales; no elude verificaciones.

## Componentes

| Componente | Ubicación | Función |
| --- | --- | --- |
| Pantalla de Sublichat | `activar-tv.js`, `activar-tv.css` | Iconos, correo/clave, selección opcional, código y página remota |
| Plataformas compartidas | `activar-tv-platforms.js` | Enlaces, alias y validación de códigos |
| API privada de Vercel | `api/activar-tv.js` | Comprueba el ID token Firebase y el usuario autorizado |
| Navegador persistente | `tv-browser/` | Mantiene una sesión aislada mientras se inicia sesión y se vincula el TV |

Sublichat sigue alojado donde está. El servicio de navegador debe ejecutarse en
un servidor permanente con Docker, HTTPS y soporte de sandbox Chromium. No debe
instalarse como una función temporal de Vercel. No necesita otro proyecto Firebase.

## Instalar en un servidor Docker

Use una máquina Linux con Docker Compose, capacidad para Chromium y puertos
80/443 disponibles. La configuración limita a tres sesiones simultáneas, usa
3 GiB como límite de memoria del contenedor y reserva 1 GiB para memoria compartida.
La máquina necesita margen adicional para el sistema y el proxy HTTPS.

1. Suba el proyecto conservando `activar-tv-platforms.js` junto a la carpeta
   `tv-browser`. El Dockerfile utiliza la raíz del proyecto como contexto.
2. Dentro de `tv-browser`, copie `.env.example` a `.env`.
3. Configure `TV_PUBLIC_HOST` con un subdominio de su propiedad cuyo registro DNS
   apunte al servidor. Escriba sólo el nombre del host, sin `https://`.
4. Genere una clave aleatoria y guárdela como `TV_BROWSER_SECRET` en `.env`.
   Puede generarla con `openssl rand -hex 32`. No suba `.env` a GitHub.
5. Para la prueba inicial, ponga `TV_ENABLED_PLATFORMS=netflix`. La lista vacía
   mantiene deshabilitado el inicio de sesiones. Después de comprobar cada
   plataforma, añada su identificador separado por comas.
6. Ejecute desde `tv-browser`:

```sh
docker compose up -d --build
```

El proxy Caddy obtiene HTTPS para el subdominio configurado. Mantenga una sola
réplica del servicio de navegador: las sesiones viven en memoria y no pueden
repartirse entre servidores. Un reinicio cierra las sesiones temporales.

El navegador corre como `pwuser`, con sandbox y con el perfil seccomp recomendado
por Playwright. Si el proveedor no permite ese sandbox, cambie de entorno o
ajuste el aislamiento del host; este proyecto no desactiva el sandbox para
resolver una incompatibilidad.

## Conectar Sublichat en Vercel

En el proyecto actual de Sublichat, agregue estas variables de entorno de servidor:

| Variable | Valor |
| --- | --- |
| `TV_BROWSER_URL` | `https://` seguido del subdominio configurado |
| `TV_BROWSER_SECRET` | Exactamente la misma clave aleatoria del servidor |

Conserve las variables Firebase y `AUTH_USERS_JSON` que ya utiliza Sublichat.
Vuelva a desplegar Sublichat después de guardar las variables.
La clave de conexión nunca se incluye en JavaScript público.

Entre en **Inicio → Activar TV**. Mientras falte la conexión, la pantalla muestra
“pendiente de conexión” y no simula inicios de sesión ni activaciones.

## Prueba real por plataforma

1. Ingrese como Geisell, Relojes o Sublicuentas.
2. Elija la plataforma habilitada. Escriba un correo que **no esté guardado** en
   Sublichat y su clave. Pulse **Iniciar sesión**.
3. Complete cualquier verificación en la página de la plataforma. Para escribir
   en un campo remoto, tóquelo y use el cuadro “Para escribir en la página…”.
   `Ampliar` permite ver la página a tamaño completo con desplazamiento.
4. Compruebe que la cuenta es la correcta. Cuando el sitio no muestra el correo
   completo, el módulo exige confirmación expresa del operador y la identifica
   como “Cuenta confirmada por usted”, no como verificación automática.
5. Pulse **Continuar al código del TV**, copie el código del televisor y active.
6. Confirme que el TV efectivamente inició sesión. El módulo sólo muestra
   “TV activado” cuando detecta una confirmación explícita del sitio. Si un nuevo
   diseño no se reconoce, revise la página y ajuste el adaptador antes de habilitarlo.
7. Pruebe una clave equivocada, un código vencido y el cambio a otra cuenta.
   El código debe bloquearse si la plataforma vuelve a pedir login.
8. Repita con dos operadores simultáneos: cada uno debe ver exclusivamente su sesión.

Identificadores disponibles: `disney`, `netflix`, `hbo`, `prime`, `crunchyroll`,
`paramount`. Configuración completa después de validar las seis:

```dotenv
TV_ENABLED_PLATFORMS=disney,netflix,hbo,prime,crunchyroll,paramount
```

La configuración activa servicios sólo en ese servidor. No crea suscripciones,
cuentas nuevas ni modifica el inventario.

## Comportamiento y mantenimiento

- Una sesión por operador; cambiar de cuenta destruye la anterior. Correo y clave
  se pueden escribir manualmente y la clave conserva sus espacios y símbolos.
- Las credenciales manuales no se guardan en Sublichat, en el CRM, en logs ni en
  almacenamiento local del navegador. No se guarda `storageState` de Playwright.
- Las sesiones caducan tras 15 minutos sin acciones o 45 minutos como máximo.
  Consultar la imagen automáticamente no prolonga esa caducidad.
- Salir del módulo cierra su sesión. Al cerrar la pestaña se borran los datos
  locales; el servidor aplica la caducidad si no recibe la petición de cierre.
- El worker acepta sólo órdenes cerradas; no acepta URLs, JavaScript ni selectores
  enviados por el cliente. La API comprueba permisos antes de enviarlas.
- Para Prime se abre su entrada oficial y se genera el enlace de Amazon en cada
  sesión. No se reutiliza el enlace OpenID con parámetros de una sesión anterior.
- Los campos de contraseña se cubren en las capturas. Las imágenes se entregan
  sólo a la sesión autenticada con `Cache-Control: no-store`.
- `browser.js` contiene los adaptadores. Ajuste selectores y mensajes de éxito a
  la página real cuando cambien; nunca marque éxito sólo por una URL o un clic.

## Pruebas incluidas

Con Node 22 o posterior, desde `tv-browser`:

```sh
npm test
```

Las pruebas usan navegadores simulados: comprueban permisos, correo externo,
aislamiento, secuencia login/código, caducidad, reintentos y rechazo de falsos
positivos. No contactan las plataformas ni activan televisores.

Además, durante la preparación se verificó la pantalla con un DOM simulado para
los tres usuarios: seis logos, ingreso manual con inventario vacío, selección
opcional, cambio de cuenta, escape de HTML y servicio desconectado.

## Referencias de las dependencias

- [Playwright Docker](https://playwright.dev/docs/docker).
- [Sesiones independientes](https://playwright.dev/docs/api/class-browsercontext).
- [Perfil seccomp de Playwright](https://github.com/microsoft/playwright/blob/main/utils/docker/seccomp_profile.json).

`seccomp.json` procede de ese perfil oficial (blob
`fddc05fb520affb145404e6f6f647ca96af8087d`). Playwright usa licencia Apache-2.0;
se incluye su licencia en `PLAYWRIGHT-LICENSE`.
