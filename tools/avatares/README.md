# Kit de avatares (solo desarrollo)

Arma `assets/avatares/mujer.glb` y `hombre.glb` a partir de los modelos CC0 de Quaternius (ver `assets/avatares/LICENCIAS.md`).
No se ejecuta en Vercel ni hace falta correrlo para publicar: los .glb ya van listos en el zip.

```
npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer@0.21.0
git clone --depth 1 https://github.com/trebeljahr/quaternius-showcase /tmp/qs
node tools/avatares/construir-kit.mjs /tmp/qs/public/glb assets/avatares
```
Para agregar una prenda o peinado: añadir la línea en `CATALOGO` de `construir-kit.mjs`, en `CATALOGO` de `avatar-glb.js`,
en `AVATAR_GENERO` de `api/_sala-juntas.js` y su etiqueta en `sala-juntas.js` (la prueba `tests/r172-avatares-glb.test.mjs` revisa que coincidan).
