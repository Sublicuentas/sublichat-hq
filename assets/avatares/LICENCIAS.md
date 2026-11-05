# Avatares 3D · origen y licencia (R172 · SubliStudio 3D · Fase 3B)

Todo lo de esta carpeta es **gratis y con uso comercial permitido**. Nadie tuvo que pagar, instalar programas ni descargar nada a mano: el kit se arma con `tools/avatares/construir-kit.mjs`.

| Archivo | Qué es | Origen | Licencia |
|---|---|---|---|
| `mujer.glb` (920 KB) | Base femenina con esqueleto (51 huesos) + 6 peinados, 5 partes de arriba, 3 de abajo, 4 calzados | Quaternius · **Ultimate Modular Women Pack** — https://quaternius.com/packs/ultimatemodularwomen.html | **CC0 1.0** (dominio público) |
| `hombre.glb` (784 KB) | Base masculina con esqueleto (49 huesos) + 6 peinados, 4 partes de arriba, 3 de abajo, 3 calzados, aretes y bigote | Quaternius · **Ultimate Modular Men Pack** — https://quaternius.com/packs/ultimatemodularcharacters.html | **CC0 1.0** (dominio público) |
| `/vendor/three-gltf-0.160.0.js` (68 KB) | Cargador glTF + descompresor meshopt de three.js 0.160.0 (empaquetado para usar la misma copia de three.js de la sala) | https://github.com/mrdoob/three.js (examples/jsm) | MIT |

## Cómo se obtuvieron
- Copia pública de los modelos originales (formato .glb, sin modificar): repositorio `trebeljahr/quaternius-showcase`, commit `c664c6f231d3dd522b38ba52fc39ec33028624e2` (20/10/2026), carpeta `public/glb/modular_women` y `public/glb/modular_men`. Su `LICENSES.md` registra ambos paquetes como CC0-1.0 con enlace a la página oficial de Quaternius.
- Fecha de integración: 05/11/2026.
- La página oficial de Quaternius y itch.io no son accesibles desde el entorno de trabajo, por eso se usó la copia en GitHub; los archivos son los mismos modelos del autor.
- La ruta que pedía el PDF ("Universal Base Characters") trae cuerpos en ropa interior y sin prendas en la versión gratis; los paquetes "Ultimate Modular" del mismo autor y misma licencia sí traen blazer, traje, blusa, falda, zapatos, etc. con el mismo esqueleto, por eso se eligieron.

## Qué piezas vienen de cada modelo original
**Mujer** (`modular_women/*.glb`)
- Peinados (cabeza + cabello): melena ← Suit · recogido ← Formal · lacio ← Soldier · corto ← SciFi · ondulado ← Worker (sin casco) · largo ← Witch (sin sombrero)
- Arriba: blazer ← Suit · blusa ← Casual · vestido ← Formal · camiseta ← Soldier · chaqueta ← SciFi
- Abajo: pantalón formal ← Suit · falda ← Formal · pantalón casual ← Casual
- Calzado: formal ← Suit · tacones ← Formal · casual ← Casual · botas ← Soldier

**Hombre** (`modular_men/*.glb`)
- Peinados: clásico ← Suit · moderno ← Beach · rizado ← Casual · largo medio ← Casual2 · con barba ← Adventurer · cresta ← Punk
- Arriba: traje ← Suit · suéter ← Casual · camiseta ← Casual2 · chaleco ← Punk
- Abajo: pantalón ← Suit · jeans ← Casual2 · shorts ← Casual
- Calzado: formal ← Suit · tenis ← Casual · casual ← Casual2
- Accesorios: aretes ← Beach · bigote ← Worker

Cambios hechos al armar el kit: se juntaron las piezas en un solo archivo por base enlazadas al mismo esqueleto, se quitaron cascos/sombreros, se renombraron los materiales por rol (piel, cabello, ojos, principal, secundario) para recolorear, y se comprimió (cuantización + meshopt). Lentes, aretes de mujer, reloj y logo son piezas pequeñas hechas en código y se cuelgan de los huesos.

## Huellas (sha256)
```
35fa493bfb679ead3c5cccca70b33131fa2a12d6db1d5c7b8a02c64921c1072a  mujer.glb
51dc92f50ecbe7f08b76ce9e1cbff036047050e7571634c8984b08a4b5138f10  hombre.glb
de96b194c3ee3b9eb9b8e8b9e85404d872f259513620207cb3407d6793dce308  vendor/three-gltf-0.160.0.js
```
