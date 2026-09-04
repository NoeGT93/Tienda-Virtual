# Lulos Fashion Xela — interfaz HTML y servidor local

Esta versión conserva HTML, CSS y JavaScript en el navegador y añade un servidor Node.js con SQLite. No está publicada. No debe abrirse `public/index.html` con doble clic: autenticación, catálogo, inventario y pedidos necesitan el servidor.

## Arranque

Requiere Node.js 24 o posterior. No necesita instalar paquetes externos.

```powershell
cd ruta/a/lulos-production
node server/server.mjs
```

Abre `http://127.0.0.1:8787`. También puedes usar `INICIAR.ps1` desde esta carpeta. La base de datos se crea en `data/lulos.sqlite` y las imágenes cargadas quedan en `data/uploads/`.

## Administrador

En el primer arranque local, abre **Administración** y crea tu administrador con el formulario de configuración inicial. Esta opción desaparece cuando ya existe un administrador y está desactivada en modo público de producción. También puedes usar el comando en otra terminal, desde la misma carpeta:

```powershell
node server/admin.mjs tu-correo@ejemplo.com
```

Introduce una contraseña de al menos 12 caracteres. La entrada se oculta. Este comando crea un administrador o restablece explícitamente la contraseña del administrador indicado. Después inicia sesión desde **Mi cuenta** y abre **Administración**. No se incluyen usuarios ni contraseñas predeterminadas.

## Antes de aceptar pedidos

1. Reemplaza los productos e imágenes ilustrativos por el catálogo real.
2. Crea las tallas y registra existencias desde Inventario. El catálogo semilla comienza con stock cero.
3. Ajusta prendas por producto y maniquí desde Probador. Puedes subir PNG/WebP transparentes y modificar posición, dimensiones, rotación y capa.
4. Configura banco/titular/cuenta en las instrucciones de transferencia, dirección, teléfono y tarifa de envío en Tienda y envíos.
5. Habilita contra entrega únicamente si tu negocio lo ofrece.
6. Activa **Aceptar pedidos** cuando toda la información sea correcta. Se entrega desactivado.

La interfaz administrativa permite registrar pagos recibidos y números de guía. Estos registros no efectúan transferencias bancarias ni compran etiquetas de transporte.

## Implementado

- Catálogo respaldado por base de datos, altas y edición de productos, desactivación, tallas, SKU y carga de imágenes.
- Maniquí femenino y masculino independientes, sin estiramiento de la misma imagen. El masculino lleva camiseta y shorts base.
- Probador por capas, exclusión vestido/top/pantalón, compatibilidad por colección y ajustes guardados por producto/maniquí, historial local de deshacer/rehacer.
- Registro e inicio de sesión, contraseñas scrypt, cookies HttpOnly, sesiones persistentes, CSRF y protección de API administrativa por rol.
- Perfil y direcciones en servidor, favoritos y looks asociados al usuario, enlaces compartibles.
- Bolsa local con variantes; cotización y pedido calculados en servidor, stock transaccional, idempotencia y códigos de descuento.
- Compra como invitado o con cuenta. Pedidos de invitado visibles para la sesión que los creó.
- Historial de estados, registro manual de pagos, transportista y número de guía; cancelación con devolución de stock.
- Promociones con porcentaje, compra mínima, vencimiento y límite de usos.
- Reseñas restringidas a productos de pedidos entregados; eventos del probador almacenados en servidor.

## Límites pendientes antes de una tienda pública

Esto es una implementación local funcional, no una certificación de que todos los requisitos del documento original estén listos para producción pública.

- El catálogo, fotografías, prendas y posiciones iniciales siguen siendo ilustrativos. Los assets de ropa heredados usan una hoja sobre fondo blanco y un filtro de eliminación de blanco al renderizar; para un ajuste comercial limpio se necesitan imágenes transparentes calibradas. El editor permite cargarlas. La IA no logró producir una hoja de prendas con transparencia real en esta sesión.
- No se integra cobro con tarjeta, webhooks de una pasarela, logística externa, correo transaccional, verificación de email ni recuperación de contraseña por correo.
- Inventario de un solo almacén; entrega con tarifa general y umbral de gratuidad. No hay tarifas por municipio, impuestos/facturación, devoluciones completas, reembolsos bancarios automatizados (sí se puede registrar una devolución ya realizada) ni programa de fidelización.
- Las tallas existentes se conservan por trazabilidad. Para dejar una talla sin venta, ajusta su stock a cero; no hay editor de cambio de nombre de SKU vendido.
- Se incluyen dos maniquíes; el administrador puede añadir más. Los ajustes son por producto/maniquí, todavía no por variante individual ni vista posterior.
- Los datos personales requieren tu aviso de privacidad, política de retención, procesos de atención y configuración comercial antes de operar públicamente.
- El historial de comparación y la bolsa permanecen en el dispositivo. No hay sincronización de bolsa ni vista A/B completa de dos maniquíes.

## Despliegue posterior

Repositorio: https://github.com/NoeGT93/Tienda-Virtual. No se ha desplegado en Vercel.

Este servidor necesita un proceso Node y almacenamiento persistente para SQLite y las imágenes. **No debe subirse a Vercel suponiendo que `data/` persistirá en funciones efímeras.** Para Vercel se requiere adaptar la persistencia a una base de datos y almacenamiento externos; otra opción es alojar este servidor en un servicio con volumen persistente y HTTPS. La interfaz sigue siendo HTML en cualquiera de los casos.

En un servidor público configura `NODE_ENV=production` y `PUBLIC_ORIGIN=https://tu-dominio`, termina TLS en un proxy, conserva copias de seguridad y aplica las actualizaciones de Node. `.env.example` documenta las variables; el comando básico no carga `.env` automáticamente. Usa `node --env-file=.env server/server.mjs` si configuras ese archivo.

## Pruebas

```powershell
node --test tests/api.test.mjs
```

Las pruebas crean una base temporal independiente: acceso por roles, CSRF, validación de stock, precio autoritativo, pedido idempotente, aislamiento entre sesiones, cancelación sin duplicar stock, configuración de assets y descuentos. No modifican la base de uso local.

## Archivos

- `public/`: interfaz HTML, estilos, scripts e imágenes.
- `server/`: servidor HTTP, autenticación, esquema SQLite, semilla y comando de administrador.
- `tests/`: pruebas de integración.
- `data/`: datos privados generados al iniciar; excluidos del ZIP y de Git.

La carpeta `public/` conserva componentes de la demo anterior y añade `live.js` para conectar las pantallas al servidor. Los datos comerciales no dependen de los precios ni del estado administrativo de localStorage. La API vuelve a validar cada operación.


