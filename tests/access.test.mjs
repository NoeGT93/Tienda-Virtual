import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';

test('owner activation, permissions, invitations, recovery, session revocation and durable media', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lulos-access-'));
  const password = randomBytes(20).toString('hex'), setupToken = randomBytes(32).toString('hex');
  const port = 18880, origin = 'https://lulos.example.test';
  const env = { ...process.env, PORT: String(port), DATABASE_PATH: join(directory, 'test.sqlite'), PGLITE_PATH: join(directory, 'postgres'), NODE_ENV: 'production', PUBLIC_ORIGIN: origin, ADMIN_SETUP_TOKEN: setupToken };
  let child, errors = '';
  async function start() {
    child = spawn(process.execPath, ['server/server.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stderr.on('data', b => errors += b);
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw Error(errors); }), new Promise((_, reject) => setTimeout(() => reject(Error('startup timeout')), 15000).unref())]);
  }
  async function stop() { const ended = once(child, 'exit'); child.kill(); await ended; }
  function client() {
    let cookie = '', csrf = '';
    return async (path, method = 'GET', b) => {
      const response = await fetch(`http://127.0.0.1:${port}/api${path}`, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Origin: origin }, body: b === undefined ? undefined : JSON.stringify(b) });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const data = await response.json(); if (data.csrf) csrf = data.csrf;
      return { status: response.status, data, headers: response.headers };
    };
  }
  try {
    await start();
    const admin = client(), customer = client(), invited = client(), secondSession = client();
    let r = await admin('/bootstrap');
    assert.equal(r.status, 200); assert.equal(r.data.setupAllowed, true); assert.equal(r.data.setupTokenRequired, true);
    assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Lax;.*Secure/);
    assert.equal(r.data.products.find(p => p.id === 'blazer-arena').swatch, '#b7936a');
    assert.equal(r.data.products.find(p => p.id === 'top-oliva').filter, 'sepia(.45) saturate(.65) brightness(.7) contrast(3)');
    assert.equal((await admin('/setup', 'POST', { email: 'owner@example.test', name: 'Owner', password, setupToken: 'wrong' })).status, 403);
    assert.equal((await admin('/setup', 'POST', { email: 'owner@example.test', name: 'Owner', password, setupToken })).status, 201);
    r = await admin('/bootstrap'); const owner = r.data.user;
    assert.equal(r.data.setupAllowed, false);
    assert.equal((await admin('/setup', 'POST', { email: 'extra@example.test', name: 'Extra', password, setupToken })).status, 409);
    await customer('/bootstrap');
    assert.equal((await customer('/auth/register', 'POST', { name: 'Client', email: 'client@example.test', password, role: 'ADMIN' })).data.user.role, 'CUSTOMER');
    assert.equal((await customer('/admin/users')).status, 403);
    assert.equal((await customer('/admin/invitations', 'POST', { email: 'evil@example.test', name: 'Bad', role: 'ADMIN', currentPassword: password })).status, 403);
    assert.equal((await admin('/admin/users/' + owner.id, 'PUT', { role: 'CUSTOMER', enabled: false, currentPassword: password })).status, 409);
    assert.equal((await admin('/admin/invitations', 'POST', { email: 'staff@example.test', name: 'Staff', role: 'ADMIN', currentPassword: 'wrong' })).status, 403);
    r = await admin('/admin/invitations', 'POST', { email: 'staff@example.test', name: 'Staff', role: 'ADMIN', currentPassword: password });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    const invitation = r.data.url.split('/').pop();
    await invited('/bootstrap');
    assert.equal((await invited('/access/check', 'POST', { token: invitation })).status, 200);
    r = await invited('/access/activate', 'POST', { token: invitation, password });
    assert.equal(r.status, 200, JSON.stringify(r.data)); const staff = r.data.user;
    assert.equal(staff.role, 'ADMIN'); assert.equal((await invited('/admin/overview')).status, 200);
    assert.equal((await invited('/access/activate', 'POST', { token: invitation, password })).status, 400);
    await secondSession('/bootstrap'); await secondSession('/auth/login', 'POST', { email: staff.email, password });
    assert.equal((await invited('/auth/password', 'POST', { currentPassword: password, password: password + 'x' })).status, 200);
    assert.equal((await secondSession('/admin/overview')).status, 401);
    assert.equal((await admin('/admin/users/' + staff.id, 'PUT', { role: 'ADMIN', enabled: false, currentPassword: password })).status, 200);
    assert.equal((await invited('/admin/overview')).status, 401);
    await invited('/bootstrap');
    assert.equal((await invited('/auth/login', 'POST', { email: staff.email, password: password + 'x' })).status, 401);
    assert.equal((await admin('/admin/users/' + staff.id, 'PUT', { role: 'CUSTOMER', enabled: true, currentPassword: password })).status, 200);
    r = await admin('/admin/users/' + staff.id + '/reset', 'POST', { currentPassword: password });
    assert.equal(r.status, 201); const reset = r.data.url.split('/').pop();
    r = await invited('/access/activate', 'POST', { token: reset, password: password + 'y', role: 'ADMIN' });
    assert.equal(r.status, 200); assert.equal(r.data.user.role, 'CUSTOMER');
    assert.equal((await invited('/admin/overview')).status, 403);
    r = await admin('/admin/invitations', 'POST', { email: 'revoke@example.test', name: 'Revoked', role: 'CUSTOMER', currentPassword: password });
    const revokedToken = r.data.url.split('/').pop();
    r = await admin('/admin/users');
    assert.equal(JSON.stringify(r.data).includes(password), false);
    assert.equal(JSON.stringify(r.data).includes(invitation), false);
    const entry = r.data.invitations.find(i => i.email === 'revoke@example.test');
    await admin('/admin/invitations/' + entry.id, 'DELETE', {});
    assert.equal((await customer('/access/check', 'POST', { token: revokedToken })).status, 400);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWl8AAAAASUVORK5CYII=';
    r = await admin('/admin/uploads', 'POST', { type: 'image/png', data: png });
    assert.equal(r.status, 201); const media = r.data.url;
    assert.equal((await customer('/admin/uploads', 'POST', { type: 'image/png', data: png })).status, 403);
    await stop();
    const fixture = spawnSync(process.execPath, ['--input-type=module', '-e', "import {run,close} from './server/db.mjs'; await run('UPDATE access_tokens SET used=0,expires=1'); await close();"], { env, encoding: 'utf8' });
    assert.equal(fixture.status, 0, fixture.stderr);
    await start();
    assert.equal((await admin('/admin/overview')).status, 200);
    assert.equal((await customer('/access/check', 'POST', { token: revokedToken })).status, 400);
    const image = await fetch(`http://127.0.0.1:${port}${media}`);
    assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'), png);
  } finally {
    if (child?.exitCode === null) await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
