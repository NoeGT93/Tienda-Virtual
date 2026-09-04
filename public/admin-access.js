'use strict';
(() => {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'admin-access.css'; document.head.append(css);
  const modules = [
    ['admin', 'Resumen'], ['admin/productos', 'Productos'], ['admin/inventario', 'Inventario'],
    ['admin/pedidos', 'Pedidos'], ['admin/clientes', 'Clientes'], ['admin/promociones', 'Promociones'],
    ['admin/maniquies', 'Maniquíes'], ['admin/probador', 'Probador'], ['admin/envios', 'Tienda y envíos'],
    ['admin/analytics', 'Actividad'], ['admin/accesos', 'Usuarios y accesos'],
  ];
  const passwordField = (label = 'Contraseña', name = 'password', fresh = false) => `<label class="field">${label}<input type="password" name="${name}" required ${fresh ? 'minlength="12"' : ''} maxlength="128" autocomplete="${fresh ? 'new-password' : 'current-password'}"></label>`;
  const message = '<p class="access-error" role="alert" hidden></p>';
  const accountBase = accountPage, adminBase = liveAdmin, layoutBase = sideLayout;
  sideLayout = (kind, key, content) => kind !== 'admin' ? layoutBase(kind, key, content) : `<div class="admin-layout"><nav class="side-nav admin-navigation" aria-label="Administración"><div class="admin-nav-title">TU TIENDA</div>${modules.map(([href, label]) => `<a href="#${href}" ${key === href ? 'class="active" aria-current="page"' : ''}>${label}<span aria-hidden="true">↗</span></a>`).join('')}<div class="admin-identity"><strong>${esc(boot.user.name)}</strong><span>Administrador</span><a href="#cuenta">Mi cuenta</a><button data-live-action="logout">Cerrar sesión</button></div></nav><div class="admin-content">${content}</div></div>`;
  loginPage = () => {
    const admin = location.hash.startsWith('#admin');
    return heading(admin ? 'Accede a tu administración.' : 'Tu espacio en Lulos', admin ? 'Todo lo que necesitas para gestionar tu tienda.' : 'Tus favoritos, pedidos y combinaciones, en un solo lugar.') + `<div class="access-layout"><section class="access-intro"><span class="eyebrow">LULOS / ${admin ? 'ADMINISTRACIÓN' : 'MI CUENTA'}</span><h2>${admin ? 'Una tienda.<br>Todo en orden.' : 'Tu estilo.<br>Siempre contigo.'}</h2><p>${admin ? 'Organiza el catálogo, controla las existencias y acompaña cada pedido desde aquí.' : 'Guarda tus looks y consulta el estado de tus pedidos.'}</p><a href="#tienda">Volver a la colección ↗</a></section><div><form class="panel access-form" data-access="login"><h2>Bienvenido de nuevo</h2>${field('Correo electrónico', 'email', '', 'email')}${passwordField()}${message}${sendButton(admin ? 'Entrar a administración' : 'Iniciar sesión')}<p class="hint">¿Olvidaste tu contraseña? Solicita a la tienda un enlace de recuperación.</p></form>${admin ? `<div class="access-note">Necesitas una cuenta con permiso de administrador.${boot.setupPending ? ' El propietario debe completar la activación inicial.' : ''}</div>` : `<details class="panel"><summary>¿Es tu primera visita? Crear cuenta</summary><form class="access-form" data-access="register">${field('Nombre', 'name')}${field('Correo electrónico', 'email', '', 'email')}${passwordField('Contraseña · mínimo 12 caracteres', 'password', true)}${message}${sendButton('Crear mi cuenta')}</form></details>`}</div></div>`;
  };
  function setupPage() {
    return heading('Activa tu administración.', 'Crea la cuenta del propietario. Este formulario se cierra después del primer acceso.') + `<div class="access-layout"><section class="access-intro"><span class="eyebrow">LULOS / PRIMER ACCESO</span><h2>Tu tienda.<br>En tus manos.</h2><p>Elige tu correo y una contraseña personal. Después podrás invitar a otros administradores.</p><a href="#tienda">Ver la tienda ↗</a></section><form class="panel access-form" data-access="setup"><h2>Cuenta del propietario</h2>${boot.setupTokenRequired ? passwordField('Código de activación', 'setupToken') : ''}${field('Nombre', 'name')}${field('Correo electrónico', 'email', '', 'email')}${passwordField('Contraseña · mínimo 12 caracteres', 'password', true)}${passwordField('Repite la contraseña', 'confirmPassword', true)}${message}${sendButton('Crear mi administrador')}</form></div>`;
  }
  function usersPage() {
    const a = adminState.access;
    return `<div class="panel"><div class="section-title"><div><span class="eyebrow">PERMISOS Y SEGURIDAD</span><h2>Usuarios y accesos</h2></div><button class="outline-link" data-access-action="invite">Invitar usuario ↗</button></div><p class="hint">Los administradores gestionan toda la tienda. Los clientes acceden únicamente a su cuenta y sus pedidos.</p>${table(['Usuario', 'Permiso', 'Estado', 'Acciones'], a.users.map(u => `<tr><td><strong>${esc(u.name)}</strong><br><span class="hint">${esc(u.email)}</span>${u.id === boot.user.id ? '<br><small>Tu cuenta</small>' : ''}</td><td>${u.role === 'ADMIN' ? 'Administrador' : 'Cliente'}</td><td><span class="access-status ${u.disabled ? 'muted' : ''}">${u.disabled ? 'Suspendido' : 'Activo'}</span></td><td><button data-access-action="edit" data-id="${u.id}">Gestionar</button>${!u.disabled ? `<button data-access-action="reset" data-id="${u.id}">Recuperación</button>` : ''}</td></tr>`))}</div><div class="panel"><h2>Enlaces pendientes</h2><p class="hint">Cada enlace caduca en 24 horas y solo puede usarse una vez.</p>${a.invitations.length ? table(['Correo', 'Tipo', 'Vence', 'Acción'], a.invitations.map(i => `<tr><td>${esc(i.email)}</td><td>${i.kind === 'invite' ? 'Invitación' : 'Recuperación'}</td><td>${new Date(Number(i.expires)).toLocaleString('es-GT')}</td><td><button data-access-action="revoke" data-id="${i.id}">Revocar</button></td></tr>`)) : '<p>No hay enlaces pendientes.</p>'}</div><div class="panel"><h2>Historial de accesos</h2>${a.audit.length ? table(['Acción', 'Cuenta', 'Responsable', 'Fecha'], a.audit.map(i => `<tr><td>${esc(i.action)}</td><td>${esc(i.target)}</td><td>${esc(i.actor_name || 'Sistema')}</td><td>${new Date(i.created).toLocaleString('es-GT')}</td></tr>`)) : '<p>Las invitaciones y los cambios de permisos quedarán registrados aquí.</p>'}</div>`;
  }
  adminPage = key => {
    if (boot.setupAllowed) return setupPage();
    if (!boot.user) return loginPage();
    if (boot.user.role !== 'ADMIN') return heading('Acceso restringido') + `<div class="panel"><h2>Tu cuenta es de cliente</h2><p>Inicia sesión con el correo del administrador o solicita una invitación al propietario.</p><button class="outline-link" data-live-action="logout">Cambiar de cuenta</button></div>`;
    if (key === 'admin/accesos') return heading('Administración', 'Gestiona las personas que tienen acceso a Lulos.', '<a class="outline-link" href="#tienda">Ver tienda ↗</a>') + sideLayout('admin', key, usersPage());
    return adminBase(key);
  };
  accountPage = key => {
    const content = accountBase(key);
    if (key !== 'cuenta' || !boot.user) return content;
    return content + `<section class="panel account-security"><h2>Seguridad de tu cuenta</h2><form class="access-form" data-access="password">${passwordField('Contraseña actual', 'currentPassword')}${passwordField('Nueva contraseña · mínimo 12 caracteres', 'password', true)}${passwordField('Repite la nueva contraseña', 'confirmPassword', true)}${message}${sendButton('Actualizar contraseña')}</form>${boot.user.role === 'ADMIN' ? '<a class="outline-link" href="#admin">Ir a administración ↗</a>' : ''}</section>`;
  };
  const routeBase = route;
  route = async () => {
    if (!liveReady) return;
    document.body.classList.toggle('admin-view', location.hash.startsWith('#admin'));
    if (!location.hash.startsWith('#activar/')) return routeBase();
    const raw = location.hash.slice('#activar/'.length);
    studio.hidden = true; screen.hidden = false;
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    screen.innerHTML = heading('Prepara tu acceso.') + '<p role="status">Comprobando enlace…</p>';
    try {
      const entry = await request('/access/check', 'POST', { token: raw });
      if (location.hash !== '#activar/' + raw) return;
      screen.innerHTML = heading(entry.kind === 'invite' ? 'Bienvenido a Lulos.' : 'Recupera tu acceso.') + `<form class="panel access-form activation-form" data-access="activate"><h2>${esc(entry.name)}</h2><p>${esc(entry.email)}</p>${passwordField('Elige una contraseña · mínimo 12 caracteres', 'password', true)}${passwordField('Repite la contraseña', 'confirmPassword', true)}${message}${sendButton('Guardar y entrar')}</form>`;
    } catch (error) { screen.innerHTML = heading('Este enlace no está disponible.') + `<div class="panel"><p>${esc(error.message)}</p><p>Solicita al administrador un nuevo enlace.</p><a href="#cuenta">Volver al acceso</a></div>`; }
  };
  document.addEventListener('submit', async event => {
    const f = event.target.closest('form[data-access]'); if (!f) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const b = Object.fromEntries(new FormData(f)), kind = f.dataset.access, error = f.querySelector('.access-error'), button = f.querySelector('.primary');
    error.hidden = true; button.disabled = true;
    try {
      if (b.confirmPassword !== undefined && b.password !== b.confirmPassword) throw Error('Las contraseñas no coinciden.');
      delete b.confirmPassword;
      let result;
      if (['login', 'register', 'password'].includes(kind)) result = await request('/auth/' + kind, 'POST', b);
      if (kind === 'setup') result = await request('/setup', 'POST', b);
      if (kind === 'activate') result = await request('/access/activate', 'POST', { ...b, token: location.hash.slice('#activar/'.length) });
      if (kind === 'invite') result = await request('/admin/invitations', 'POST', b);
      if (kind === 'reset') result = await request('/admin/users/' + f.dataset.id + '/reset', 'POST', b);
      if (kind === 'user') result = await request('/admin/users/' + f.dataset.id, 'PUT', { ...b, enabled: b.enabled === 'yes' });
      await refresh();
      if (['setup', 'activate', 'login'].includes(kind)) {
        const destination = boot.user.role === 'ADMIN' ? '#admin' : '#cuenta';
        history.replaceState(null, '', destination);
      }
      await route();
      if (result?.url) {
        liveDialog(`<h2>Enlace de acceso creado</h2><p>Comparte este enlace directamente con la persona invitada. No se ha enviado ningún correo.</p><label class="field">Enlace válido por 24 horas<input id="access-link" value="${esc(result.url)}" readonly></label><button class="primary" data-access-action="copy">Copiar enlace</button><p class="hint">Al cerrar esta ventana solo podrás crear un enlace nuevo o revocar el anterior.</p>`);
      } else toast(kind === 'password' ? 'Contraseña actualizada. Las demás sesiones se han cerrado.' : 'Cambios guardados.');
    } catch (e) { error.textContent = e.message; error.hidden = false; error.scrollIntoView({ block: 'nearest' }); }
    finally { button.disabled = false; }
  }, true);
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-access-action]'); if (!button) return;
    event.preventDefault(); const action = button.dataset.accessAction, id = button.dataset.id;
    const u = adminState?.access.users.find(u => u.id === id);
    if (action === 'invite') liveDialog(`<h2>Invitar a Lulos</h2><form class="access-form" data-access="invite">${field('Nombre', 'name')}${field('Correo electrónico', 'email', '', 'email')}${options('Permiso', 'role', [['CUSTOMER', 'Cliente'], ['ADMIN', 'Administrador']], 'CUSTOMER')}${passwordField('Tu contraseña actual', 'currentPassword')}${message}${sendButton('Crear enlace de invitación')}</form>`);
    if (action === 'edit') liveDialog(`<h2>Gestionar acceso</h2><p>${esc(u.name)} · ${esc(u.email)}</p><form class="access-form" data-access="user" data-id="${id}">${options('Permiso', 'role', [['CUSTOMER', 'Cliente'], ['ADMIN', 'Administrador']], u.role)}${options('Estado', 'enabled', [['yes', 'Activo'], ['no', 'Suspendido']], u.disabled ? 'no' : 'yes')}${passwordField('Tu contraseña actual', 'currentPassword')}${message}${sendButton('Guardar acceso')}</form>`);
    if (action === 'reset') liveDialog(`<h2>Recuperar acceso</h2><p>Crear un enlace para ${esc(u.email)}. La persona elegirá su nueva contraseña.</p><form class="access-form" data-access="reset" data-id="${id}">${passwordField('Tu contraseña actual', 'currentPassword')}${message}${sendButton('Crear enlace de recuperación')}</form>`);
    try {
      if (action === 'revoke') { await request('/admin/invitations/' + id, 'DELETE', {}); await route(); toast('Enlace revocado.'); }
      if (action === 'copy') { const input = document.querySelector('#access-link'); try { await navigator.clipboard.writeText(input.value); toast('Enlace copiado.'); } catch { input.select(); toast('Selecciona y copia el enlace.'); } }
    } catch (error) { toast(error.message); }
  });
})();
