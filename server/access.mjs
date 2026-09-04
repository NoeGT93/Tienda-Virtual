import { randomUUID } from 'node:crypto';
import { all, one, run, transaction } from './db.mjs';
import { hash, token, passwordHash, verifyPassword, publicUser, rotate } from './auth.mjs';

const now = () => new Date().toISOString();
export function passwordValue(value, check) {
  check(typeof value === 'string' && value.length >= 12 && value.length <= 128,
    'La contraseña debe tener entre 12 y 128 caracteres.');
  return value;
}
async function audit(actor, target, action) {
  await run('INSERT INTO access_audit VALUES(?,?,?,?,?)', randomUUID(), actor, target, action, now());
}
export async function accessOverview() {
  return {
    users: await all('SELECT id,name,email,phone,role,disabled,created FROM users ORDER BY created DESC'),
    invitations: await all('SELECT id,email,name,role,kind,expires,created FROM access_tokens WHERE used=0 AND expires>? ORDER BY created DESC', Date.now()),
    audit: await all('SELECT a.*,u.name actor_name FROM access_audit a LEFT JOIN users u ON a.actor=u.id ORDER BY a.created DESC LIMIT 100'),
  };
}
export async function accessRoutes(c) {
  const { path, method, b, s, user, res, json, check, str, email, auth, admin, limit, ip, origin } = c;
  const send = (data, status = 200) => { json(res, data, status); return true; };
  const verifyActor = async () => {
    await limit('access-admin:' + user.id, 15, 900000);
    const actor = await one('SELECT * FROM users WHERE id=? AND disabled=0', user.id);
    check(actor && verifyPassword(b.currentPassword, actor.password), 'Confirma tu contraseña actual.', 403);
  };
  const findToken = async () => {
    check(typeof b.token === 'string' && /^[a-f0-9]{64}$/.test(b.token), 'Enlace no válido o caducado.', 400);
    const entry = await one('SELECT * FROM access_tokens WHERE token_hash=? AND used=0 AND expires>?', hash(b.token), Date.now());
    check(entry, 'Enlace no válido o caducado.', 400);
    if (entry.kind === 'reset') check(await one('SELECT id FROM users WHERE id=? AND disabled=0', entry.user_id), 'Enlace no válido o caducado.', 400);
    return entry;
  };
  if (path === '/api/auth/password' && method === 'POST') {
    auth();
    const password = passwordValue(b.password, check);
    await verifyActor();
    await transaction(async () => {
      await run('UPDATE users SET password=? WHERE id=?', passwordHash(password), user.id);
      await run('DELETE FROM sessions WHERE user_id=?', user.id);
      await run('UPDATE access_tokens SET used=1 WHERE user_id=?', user.id);
      await audit(user.id, user.email, 'Contraseña actualizada');
    });
    return send({ csrf: await rotate(s, user.id, res), user: await publicUser(user.id) });
  }
  if (path === '/api/access/check' && method === 'POST') {
    await limit('activation:' + ip, 20, 900000);
    const entry = await findToken();
    return send({ name: entry.name, email: entry.email, kind: entry.kind, expires: Number(entry.expires) });
  }
  if (path === '/api/access/activate' && method === 'POST') {
    await limit('activation:' + ip, 20, 900000);
    const password = passwordValue(b.password, check);
    const id = await transaction(async () => {
      const entry = await findToken();
      let id = entry.user_id;
      if (entry.kind === 'invite') {
        check(!(await one('SELECT id FROM users WHERE email=?', entry.email)), 'La cuenta ya existe. Solicita un enlace de recuperación.', 409);
        id = randomUUID();
        await run('INSERT INTO users(id,email,name,password,role,created) VALUES(?,?,?,?,?,?)', id, entry.email, entry.name, passwordHash(password), entry.role, now());
      } else {
        await run('UPDATE users SET password=? WHERE id=? AND disabled=0', passwordHash(password), id);
        await run('DELETE FROM sessions WHERE user_id=?', id);
      }
      await run('UPDATE access_tokens SET used=1 WHERE email=?', entry.email);
      await audit(id, entry.email, entry.kind === 'invite' ? 'Invitación aceptada' : 'Contraseña restablecida');
      return id;
    });
    return send({ user: await publicUser(id), csrf: await rotate(s, id, res) });
  }
  if (!path.startsWith('/api/admin/')) return false;
  if (!/^\/api\/admin\/(users|invitations)(\/|$)/.test(path)) return false;
  admin();
  const [, , , entity, id, action] = path.split('/');
  if (entity === 'users' && !id && method === 'GET') return send(await accessOverview());
  if (entity === 'users' && id && !action && method === 'PUT') {
    check(['ADMIN', 'CUSTOMER'].includes(b.role) && typeof b.enabled === 'boolean');
    await verifyActor();
    await transaction(async () => {
      const target = await one('SELECT * FROM users WHERE id=?', id);
      check(target, 'Usuario no encontrado.', 404);
      check(id !== user.id || (b.role === 'ADMIN' && b.enabled), 'No puedes retirar tu propio acceso de administrador.', 409);
      if (target.role === 'ADMIN' && !target.disabled && (b.role !== 'ADMIN' || !b.enabled)) {
        const count = await one("SELECT count(*) count FROM users WHERE role='ADMIN' AND disabled=0");
        check(Number(count.count) > 1, 'Debe quedar al menos un administrador activo.', 409);
      }
      await run('UPDATE users SET role=?,disabled=? WHERE id=?', b.role, b.enabled ? 0 : 1, id);
      if (target.role !== b.role || target.disabled !== (b.enabled ? 0 : 1)) {
        await run('DELETE FROM sessions WHERE user_id=?', id);
        await run('UPDATE access_tokens SET used=1 WHERE user_id=? OR email=?', id, target.email);
      }
      await audit(user.id, target.email, `Acceso: ${b.role === 'ADMIN' ? 'administrador' : 'cliente'} · ${b.enabled ? 'activo' : 'suspendido'}`);
    });
    return send({ ok: true });
  }
  if ((entity === 'invitations' && !id && method === 'POST') || (entity === 'users' && id && action === 'reset' && method === 'POST')) {
    await verifyActor();
    const raw = token(), expiry = Date.now() + 86400000;
    await transaction(async () => {
      const target = id ? await one('SELECT * FROM users WHERE id=? AND disabled=0', id) : null;
      if (id) check(target, 'Usuario no encontrado o suspendido.', 404);
      const mail = target?.email || email(b.email), name = target?.name || str(b.name), role = target?.role || b.role;
      check(['ADMIN', 'CUSTOMER'].includes(role));
      if (!target) check(!(await one('SELECT id FROM users WHERE email=?', mail)), 'El correo ya tiene una cuenta. Gestiona su acceso en la lista de usuarios.', 409);
      await run('UPDATE access_tokens SET used=1 WHERE email=?', mail);
      await run('INSERT INTO access_tokens VALUES(?,?,?,?,?,?,?,?,?,?,?)', randomUUID(), hash(raw), mail, name, role, target ? 'reset' : 'invite', target?.id || null, expiry, 0, user.id, now());
      await audit(user.id, mail, target ? 'Enlace de recuperación creado' : 'Invitación creada');
    });
    return send({ url: `${origin}/#activar/${raw}`, expires: expiry }, 201);
  }
  if (entity === 'invitations' && id && method === 'DELETE') {
    await run('UPDATE access_tokens SET used=1 WHERE id=?', id);
    await audit(user.id, id, 'Enlace revocado');
    return send({ ok: true });
  }
  return send({ error: 'Ruta no encontrada.' }, 404);
}
