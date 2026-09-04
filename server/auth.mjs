import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { one, run } from "./db.mjs";
export const token = () => randomBytes(32).toString("hex");
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function passwordHash(value) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
}
export function verifyPassword(value, stored) {
  if (typeof value !== 'string' || value.length > 128 || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored || '')) return false;
  const [salt, digest] = stored.split(":");
  return timingSafeEqual(
    scryptSync(value, salt, 64),
    Buffer.from(digest, "hex"),
  );
}
export async function session(req, res) {
  const raw = (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("lulos_session="))
    ?.slice(14);
  let s = raw
    ? await one(
        "SELECT * FROM sessions WHERE id=? AND expires>?",
        hash(raw),
        Date.now(),
      )
    : null;
  if (!s) {
    const key = token();
    s = {
      id: hash(key),
      user_id: null,
      csrf: token(),
      expires: Date.now() + 86400000,
    };
    await run(
      "INSERT INTO sessions VALUES(?,?,?,?)",
      s.id,
      null,
      s.csrf,
      s.expires,
    );
    res.setHeader(
      "Set-Cookie",
      `lulos_session=${key}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : ""}`,
    );
  }
  return s;
}
export async function rotate(s, userId, res) {
  await run("DELETE FROM sessions WHERE id=?", s.id);
  const key = token(),
    csrf = token();
  await run(
    "INSERT INTO sessions VALUES(?,?,?,?)",
    hash(key),
    userId,
    csrf,
    Date.now() + 86400000,
  );
  res.setHeader(
    "Set-Cookie",
    `lulos_session=${key}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : ""}`,
  );
  return csrf;
}
export const publicUser = async (id) =>
  id
    ? await one("SELECT id,name,email,phone,role FROM users WHERE id=? AND disabled=0", id)
    : null;
