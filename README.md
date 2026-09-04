# Lulos Fashion Xela

Tienda con interfaz HTML, CSS y JavaScript, API Node.js y administración autenticada. Mantiene la portada y las vistas de estudio del probador.

## Administración

Abre `/#admin`. Tras activar al propietario, inicia sesión con su correo y contraseña. No hay credenciales predeterminadas.

Módulos: productos y fotografías, existencias por talla, pedidos, pagos registrados manualmente, envíos, clientes, promociones, maniquíes, configuración del probador, actividad y usuarios/accesos.

En **Usuarios y accesos** puedes invitar administradores o clientes, cambiar permisos, suspender cuentas, revocar enlaces y generar enlaces de recuperación. Las invitaciones no envían correos: copia el enlace y compártelo directamente con su destinatario. Caduca en 24 horas y solo admite un uso. Los cambios de acceso quedan registrados. En **Mi cuenta** puedes cambiar tu contraseña; se cierran las demás sesiones.

## Vercel

- Framework: Other. Directorio raíz: `./`. `vercel.json` configura `public` y las funciones API.
- Node.js 24 o posterior. Instalación: `npm ci`.
- PostgreSQL mediante `DATABASE_URL`, `STORAGE_DATABASE_URL`, `POSTGRES_URL` o `STORAGE_POSTGRES_URL`, en ese orden. La integración Neon existente usa `STORAGE_DATABASE_URL`.
- Origen público: `PUBLIC_ORIGIN=https://tu-dominio`. Si se omite, se usa `VERCEL_PROJECT_PRODUCTION_URL` cuando están habilitadas las variables de sistema de Vercel.
- Activa el primer administrador añadiendo **ADMIN_SETUP_TOKEN** como secreto de Production: utiliza un valor aleatorio de al menos 32 caracteres, vuelve a desplegar y abre `/#admin`. Introduce ese código y elige tu nombre, correo y contraseña personal de 12 a 128 caracteres. Después de crear la cuenta puedes eliminar la variable y volver a desplegar. La activación inicial queda cerrada en la base de datos.
- No subas archivos `.env`, bases de datos locales, contraseñas ni enlaces de activación a GitHub.

La API crea las tablas de forma idempotente sin borrar registros existentes. Los productos ilustrativos nuevos comienzan sin existencias y los pedidos desactivados. Registra el inventario real y completa **Tienda y envíos** antes de activar ventas. Las fotografías PNG/JPG/WebP, de hasta 2 MB cada una, se guardan en PostgreSQL y se sirven mediante `/uploads/`; no requieren otro almacenamiento. Para un catálogo de gran volumen conviene migrar estas imágenes a almacenamiento de objetos y mantener los identificadores de producto.

## Desarrollo local

Instala Node.js 24+, ejecuta `npm ci` y `npm start`; abre `http://127.0.0.1:8787`. También puedes usar `INICIAR.ps1`. Sin conexión PostgreSQL se utiliza SQLite en `data/lulos.sqlite`. Copia `.env.example` a `.env` si necesitas otra configuración. En localhost, el primer administrador se puede crear directamente en `/#admin`.

Recuperación del propietario desde un entorno de confianza con conexión a la base de datos: `npm run admin -- correo@ejemplo.com`. La herramienta pide una nueva contraseña con entrada oculta y revoca las sesiones anteriores. No cambia las contraseñas de Vercel, GitHub ni Neon.

## Verificación

`npm test` prueba activación protegida, roles, invitaciones, recuperación, suspensión, revocación de sesiones, persistencia de imágenes, stock, integridad del total y cancelación de pedidos. Para ejecutar las mismas pruebas con PostgreSQL local, define `DB_DRIVER=pglite` antes de `npm test`.

El probador utiliza composiciones de estudio preparadas para el catálogo compatible; no calcula el ajuste físico de tallas ni genera automáticamente imágenes de prendas nuevas. Los pagos por transferencia o contra entrega se registran en administración; no existe cobro automático con tarjeta ni envío automático de mensajes.
