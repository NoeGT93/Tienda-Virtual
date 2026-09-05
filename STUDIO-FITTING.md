# Probador dinámico de combinaciones

El probador usa prendas individuales y escenas completas preparadas. Al elegir una parte superior o inferior, conserva la otra pieza y muestra inmediatamente la combinación resultante sobre el mismo maniquí, con la misma pose y encuadre.

## Cobertura

- Dama: cinco partes superiores y tres inferiores, para 15 combinaciones.
- Caballero: cinco partes superiores y tres pantalones, para 15 combinaciones.
- El catálogo cambia junto con la colección seleccionada.
- El maniquí no cambia entre outfits: solo cambia la ropa elegida.
- Vaciar, retirar prendas, deshacer, rehacer, guardar el look y agregar las prendas a la bolsa siguen disponibles.

## Interacción

El panel «Crea tu look» permite cambiar cada pieza directamente. También se puede usar la percha de cualquier ficha del catálogo. Al seleccionar una prenda de otra colección, el probador cambia al maniquí fijo correspondiente y carga una pieza complementaria para presentar un look completo.

Las prendas permanecen como productos separados con su propio precio, talla y disponibilidad. Los conjuntos cerrados y el carrusel de looks predeterminados fueron retirados.

## Implementación visual

La interfaz no estira recortes sobre el cuerpo ni cambia el maniquí en cada selección. Cada combinación usa una celda de `mix-female-scenes.png` o `mix-male-scenes.png`, mientras que las fichas de producto usan `mix-female-garments.png` y `mix-male-garments.png`.

Son vistas ilustrativas preparadas para estas 30 combinaciones. No predicen talla, caída exacta ni ajuste corporal. Una colección nueva necesita su hoja de prendas y su matriz de combinaciones revisadas antes de publicarse.

## Recursos finales

- `public/mix-match.js` y `public/mix-match.css`.
- `server/mix-seed.json`.
- `public/assets/mix-female-garments.png`.
- `public/assets/mix-male-garments.png`.
- `public/assets/mix-female-scenes.png`.
- `public/assets/mix-male-scenes.png`.
- `STUDIO-PROMPTS.json`, con las instrucciones de generación de los recursos visuales.
