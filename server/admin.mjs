import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import { run, one, close, transaction } from "./db.mjs";
import { passwordHash } from "./auth.mjs";
const email = (process.argv[2] || "").toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: npm run admin -- correo@ejemplo.com");
  process.exit(1);
}
process.stdout.write(
  "Contraseña de administrador (mínimo 12 caracteres; entrada oculta): ",
);
const muted = new Writable({
  write(chunk, encoding, cb) {
    cb();
  },
});
const rl = createInterface({
  input: process.stdin,
  output: muted,
  terminal: true,
});
rl.question("", async (password) => {
  rl.close();
  if (password.length < 12 || password.length > 128) {
    console.error("\nContraseña no válida.");
    process.exitCode = 1;
    return;
  }
  await transaction(async () => {
  const existing = await one("SELECT id FROM users WHERE email=?", email);
  if (existing)
    await run(
      "UPDATE users SET password=?,role='ADMIN',disabled=0 WHERE id=?",
      passwordHash(password),
      existing.id,
    );
  else
    await run(
      "INSERT INTO users(id,email,name,password,role,created) VALUES(?,?,?,?,?,?)",
      randomUUID(),
      email,
      "Administrador",
      passwordHash(password),
      "ADMIN",
      new Date().toISOString(),
    );
  if (existing) await run('DELETE FROM sessions WHERE user_id=?', existing.id);
  await run('UPDATE access_tokens SET used=1 WHERE email=?', email);
  await run("INSERT INTO app_meta(key,value) VALUES('setup_complete',?) ON CONFLICT(key) DO NOTHING", new Date().toISOString());
  });
  await close();
  console.log("\nAdministrador configurado.");
});
