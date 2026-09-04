# Administración y accesos — validación

Fecha: 4 de septiembre de 2026.

- Suite SQLite: acceso del propietario, CSRF/cookies, roles, invitaciones de un uso, recuperación, suspensión y revocación de sesiones; persistencia tras reiniciar; fotografías servidas desde la base de datos.
- Misma suite ejecutada con PostgreSQL local (PGlite).
- Suite de comercio: autorización, stock no negativo, precios del servidor, pedidos y cancelación.
- Navegador local: primer acceso, inicio de sesión, panel y generación de invitación comprobados con cuentas de prueba aisladas.
- No se incluye ninguna cuenta de prueba, contraseña, sesión ni base de datos en los archivos de entrega.

El despliegue requiere PostgreSQL. La creación del propietario en producción requiere configurar ADMIN_SETUP_TOKEN y elegir su contraseña desde /#admin. Consulte README.md.
