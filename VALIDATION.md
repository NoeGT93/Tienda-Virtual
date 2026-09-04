# Validación local

## API

`node --test tests/api.test.mjs` finalizó correctamente. La prueba recorre registro, login, API protegida por rol, CSRF, stock no negativo, precio calculado por servidor, idempotencia, aislamiento de pedidos entre sesiones, cancelación sin duplicar stock, guardado de ajustes del probador y cálculo de promociones.

## Navegador

Se verificó con Microsoft Edge mediante Playwright el flujo:

administrador → ingreso de existencias → configuración de tienda → selección de talla → bolsa → cotización → pedido persistido.

Se recorrieron 19 rutas, con sesión administrativa iniciada, en 360, 390, 430, 768, 1024, 1280, 1440 y 1920 píxeles. No se detectaron errores JavaScript ni desbordamiento horizontal de página. Las tablas administrativas conservan desplazamiento interno en móvil.

Se inspeccionó visualmente el maniquí masculino vestido y se corrigieron el fondo rectangular de los assets heredados, la transparencia accidental entre capas y la posición de pantalón y chaqueta. La eliminación de blanco se realiza al renderizar los assets heredados mediante un filtro SVG; los PNG transparentes propios se presentan sin ese filtro.

## No validado

No se hicieron pagos bancarios, envíos físicos ni despliegue público. No es una auditoría de seguridad independiente, una prueba de carga, una auditoría completa WCAG ni una validación de tallas físicas. Las imágenes y posiciones de muestra no sustituyen un catálogo de prendas calibradas.
