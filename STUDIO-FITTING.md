# Probador con vistas de estudio

Esta revisión sustituye la superposición de recortes por fotografías ilustrativas generadas de maniquíes ya vestidos. La selección elige automáticamente una escena completa: no estira imágenes de prendas ni pinta colores por encima del cuerpo.

## Cobertura

- Dama: nueve estados de torso (vacío, dos tops, dos blazers solos y cuatro combinaciones top/blazer), con cinco estados inferiores (vacío, dos pantalones y dos faldas).
- Caballero: tres estados de torso y tres inferiores.
- Total: 54 combinaciones preparadas. El bolso se muestra en una ficha separada para no fingir que la mano lo sostiene.
- Vaciar, retirar prendas, deshacer, rehacer, cambiar silueta y ampliar la escena siguen funcionando.
- Las escenas se cargan bajo demanda y se reutilizan durante la sesión.

## Alcance real

Son vistas ilustrativas preparadas para el catálogo actual. No es generación de IA en cada clic, un modelo 3D, una simulación de tejido ni una predicción de talla. Las prendas nuevas, imágenes o maniquíes personalizados necesitan sus escenas preparadas. Una combinación sin escena muestra un aviso; nunca vuelve al montaje de recortes ni presenta otra prenda como si fuera la elegida.

El backend y la configuración de Vercel no se modificaron. La entrada carga `studio-fitting.js` después del resto del frontend. Ese archivo sustituye `realBody` y conserva las acciones de selección existentes. `fitting-fix.js` mantiene la portada y las miniaturas.

## Recursos finales

- `public/studio-fitting.js`, `public/studio-fitting.css`, `public/index.html`.
- `public/assets/studio-female-{bare,graphite,smoke,cacao,pearl}.png`.
- `public/assets/studio-male-all.png`.
- `STUDIO-PROMPTS.json`: instrucciones usadas con la herramienta integrada de generación de imágenes; no se usó CLI ni una clave API.

Las cuadrículas son hojas internas de recursos. Cada celda se muestra íntegra, con su proporción original y sombras integradas. Para añadir otra prenda, preparar sus combinaciones a partir de fotos reales, incorporarlas al registro de escenas y revisar visualmente las vistas antes de habilitarlas.
