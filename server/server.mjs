import http from "node:http";
import { randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { all, one, run, transaction } from "./db.mjs";
import { accessRoutes, accessOverview, passwordValue } from './access.mjs';
import {
  session,
  rotate,
  publicUser,
  passwordHash,
  verifyPassword,
  token,
} from "./auth.mjs";
const root = resolve("public"),
  uploadRoot = resolve("data/uploads");
if (!process.env.VERCEL) await mkdir(uploadRoot, { recursive: true });
const port = Number(process.env.PORT || 8787),
  host = process.env.HOST || "127.0.0.1";
const production =
  process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const configuredOrigin = process.env.PUBLIC_ORIGIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
if (production && !configuredOrigin.startsWith("https://"))
  throw Error("PUBLIC_ORIGIN must be HTTPS in production");
const origin = configuredOrigin || `http://${host}:${port}`;
const allowedOrigins = new Set([origin, ...(process.env.VERCEL_ENV === 'preview' ? [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map(domain => `https://${domain}`) : [])]);
const now = () => new Date().toISOString();
const uuid = () => randomUUID();
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const check = (value, message = "Datos no válidos", status = 400) => {
  if (!value) throw new ApiError(status, message);
};
const str = (v, max = 200) => {
  check(typeof v === "string" && v.trim().length > 0 && v.length <= max);
  return v.trim();
};
const optional = (v, max = 200) => (v ? str(v, max) : "");
const integer = (v, min = 0, max = 100000000) => {
  check(Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max);
  return Number(v);
};
const email = (v) => {
  v = str(v).toLowerCase();
  check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Correo no válido");
  return v;
};
const assetUrl = (v) => {
  v = str(v, 200);
  check(
    /^\/(assets|uploads)\/[a-zA-Z0-9_.-]+\.(png|webp|jpg|jpeg)$/i.test(v),
    "Imagen no válida",
  );
  return v;
};
function json(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  if (req.body !== undefined) {
    const data =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    check(
      Buffer.byteLength(data) <= 4 * 1024 * 1024,
      "Archivo demasiado grande",
      413,
    );
    try {
      return JSON.parse(data);
    } catch {
      throw new ApiError(400, "JSON no válido");
    }
  }
  let data = "",
    size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    check(size <= 4 * 1024 * 1024, "Archivo demasiado grande", 413);
    data += chunk;
  }
  try {
    return JSON.parse(data || "{}");
  } catch {
    throw new ApiError(400, "JSON no válido");
  }
}
async function catalog(admin = false) {
  return await Promise.all(
    (
      await all(
        `SELECT * FROM products ${admin ? "" : "WHERE active=1"} ORDER BY created,id`,
      )
    ).map(async (p) => ({
      ...p,
      price: p.price / 100,
      oldPrice: p.old_price ? p.old_price / 100 : null,
      variants: await all("SELECT * FROM variants WHERE product_id=?", p.id),
      sizes: (
        await all(
          "SELECT size FROM variants WHERE product_id=? AND stock>0",
          p.id,
        )
      ).map((v) => v.size),
      filter: p.filter || "none",
      swatch: p.swatch || "#c5ba9f",
      badge: p.active ? p.badge || "" : "INACTIVO",
    })),
  );
}
async function limit(key, max, ms) {
  const stamp = Date.now();
  const row = await one(
    "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires<=? THEN 1 ELSE rate_limits.count+1 END,expires=CASE WHEN rate_limits.expires<=? THEN excluded.expires ELSE rate_limits.expires END RETURNING count",
    key,
    stamp + ms,
    stamp,
    stamp,
  );
  check(row.count <= max, "Demasiados intentos. Intenta más tarde.", 429);
}
function clientIp(req) {
  return process.env.VERCEL
    ? String(
        req.headers["x-vercel-forwarded-for"] ||
          req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress,
      )
        .split(",")[0]
        .trim()
    : req.socket.remoteAddress;
}
function setupConfigured(req) {
  return production
    ? Boolean(process.env.ADMIN_SETUP_TOKEN?.length >= 32)
    : ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress,
      );
}
function validSetupToken(value) {
  if (typeof value !== "string") return false;
  const digest = (s) => createHash("sha256").update(s).digest();
  return timingSafeEqual(
    digest(value),
    digest(process.env.ADMIN_SETUP_TOKEN || ""),
  );
}
async function orders(user, sessionId, admin = false) {
  return await Promise.all(
    (
      await all(
        `SELECT * FROM orders ${admin ? "" : "WHERE user_id=? OR (user_id IS NULL AND guest_session=?)"} ORDER BY created DESC`,
        ...(admin ? [] : [user?.id || "", sessionId]),
      )
    ).map(async (o) => ({
      ...o,
      items: await all("SELECT * FROM order_items WHERE order_id=?", o.id),
      payment: await one("SELECT * FROM payments WHERE order_id=?", o.id),
      shipment: await one("SELECT * FROM shipments WHERE order_id=?", o.id),
      history: await all(
        "SELECT status,note,created FROM order_history WHERE order_id=? ORDER BY created",
        o.id,
      ),
    })),
  );
}
async function quote(input) {
  check(
    Array.isArray(input.items) &&
      input.items.length > 0 &&
      input.items.length <= 40,
    "Tu bolsa está vacía",
  );
  const merged = new Map();
  for (const row of input.items) {
    const id = str(row.variantId);
    const qty = integer(row.quantity, 1, 10);
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const items = await Promise.all(
    [...merged].map(async ([id, quantity]) => {
      check(quantity <= 10, "Máximo 10 unidades por variante");
      const v = await one(
        "SELECT v.*,p.name,p.price,p.active FROM variants v JOIN products p ON v.product_id=p.id WHERE v.id=?",
        id,
      );
      check(v && v.active, "Una prenda ya no está disponible", 409);
      check(
        v.stock >= quantity,
        `Stock insuficiente: ${v.name}, ${v.size}`,
        409,
      );
      return { ...v, quantity };
    }),
  );
  const settings = await one("SELECT * FROM settings WHERE id=1");
  const subtotal = items.reduce((sum, r) => sum + r.price * r.quantity, 0);
  let promotion = null,
    discount = 0;
  if (input.code) {
    promotion = await one(
      "SELECT * FROM promotions WHERE code=? AND active=1",
      str(input.code).toUpperCase(),
    );
    check(
      promotion &&
        promotion.expires >= now().slice(0, 10) &&
        promotion.uses < promotion.max_uses &&
        subtotal >= promotion.minimum,
      "Código no disponible",
    );
    discount = Math.floor((subtotal * promotion.percent) / 100);
  }
  check(["delivery", "pickup"].includes(input.delivery), "Entrega no válida");
  const shipping =
    input.delivery === "pickup" ||
    (settings.free_over > 0 && subtotal >= settings.free_over)
      ? 0
      : settings.shipping;
  return {
    items,
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
    promotion,
  };
}
export async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.public.blob.vercel-storage.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  if (production)
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  try {
    const url = new URL(req.url, origin),
      path = url.pathname,
      method = req.method;
    if (!path.startsWith("/api/")) {
      check(method === "GET" || method === "HEAD", "Método no válido", 405);
      if (path.startsWith("/uploads/")) {
        const file = await one("SELECT * FROM media WHERE path=?", path);
        if (file?.data) {
          res.writeHead(200, { 'Content-Type': file.mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
          res.end(method === 'HEAD' ? undefined : Buffer.from(file.data, 'base64'));
          return;
        }
        if (file?.url && /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(file.url)) {
          res.writeHead(302, { Location: file.url, 'Cache-Control': 'public, max-age=86400' });
          res.end();
          return;
        }
        check(!process.env.VERCEL, 'No encontrado', 404);
      }
      const isUpload = path.startsWith("/uploads/"),
        base = isUpload ? uploadRoot : root;
      const suffix = isUpload
        ? path.slice(9)
        : path === "/"
          ? "index.html"
          : decodeURIComponent(path).replace(/^\//, "");
      const file = resolve(base, suffix);
      check(file.startsWith(base + sep), "No encontrado", 404);
      let bytes;
      try {
        bytes = await readFile(file);
      } catch {
        throw new ApiError(404, "No encontrado");
      }
      const type = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
      }[extname(file)];
      check(type, "No encontrado", 404);
      res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": type.startsWith("image/")
          ? "public, max-age=86400"
          : "no-cache",
      });
      res.end(method === "HEAD" ? undefined : bytes);
      return;
    }
    await limit(`all:${clientIp(req)}`, 600, 60000);
    const s = await session(req, res),
      user = await publicUser(s.user_id);
    if (!["GET", "HEAD"].includes(method)) {
      check(
        !req.headers.origin || allowedOrigins.has(req.headers.origin),
        "Origen no permitido",
        403,
      );
      check(
        req.headers["x-csrf-token"] === s.csrf,
        "Sesión caducada. Recarga la página.",
        403,
      );
      check(
        req.headers["content-type"]?.startsWith("application/json"),
        "Content-Type no válido",
        415,
      );
    }
    const b = ["GET", "HEAD"].includes(method) ? {} : await body(req);
    check(b && typeof b === 'object' && !Array.isArray(b), 'Datos no válidos');
    const auth = () => check(user, "Inicia sesión para continuar.", 401);
    const admin = () => {
      auth();
      check(user.role === "ADMIN", "Acceso restringido.", 403);
    };
    if (await accessRoutes({ path, method, b, s, user, res, json, check, str, email, auth, admin, limit, ip: clientIp(req), origin })) return;
    if (path === "/api/bootstrap" && method === "GET") {
      return json(res, {
        csrf: s.csrf,
        user,
        setupTokenRequired: production,
        setupAllowed:
          setupConfigured(req) &&
          !(await one("SELECT key FROM app_meta WHERE key='setup_complete'")) &&
          !(await one("SELECT id FROM users WHERE role='ADMIN'")),
        setupPending: !(await one("SELECT id FROM users WHERE role='ADMIN'")),
        products: await catalog(),
        mannequins: await all(
          "SELECT * FROM mannequins WHERE active=1 ORDER BY sort",
        ),
        assets: await all("SELECT * FROM garment_assets"),
        settings: await one("SELECT * FROM settings WHERE id=1"),
        orders: await orders(user, s.id),
        favorites: user
          ? (
              await all(
                "SELECT product_id FROM favorites WHERE user_id=?",
                user.id,
              )
            ).map((r) => r.product_id)
          : [],
        outfits: user
          ? (
              await all(
                "SELECT * FROM outfits WHERE user_id=? ORDER BY created DESC",
                user.id,
              )
            ).map((r) => ({ ...r, items: JSON.parse(r.items) }))
          : [],
        addresses: user
          ? await all("SELECT * FROM addresses WHERE user_id=?", user.id)
          : [],
      });
    }
    if (path === "/api/setup" && method === "POST") {
      check(setupConfigured(req), "Configuración no disponible", 403);
      await limit("setup:" + clientIp(req), 5, 900000);
      if (production)
        check(
          validSetupToken(b.setupToken),
          "Clave de configuración incorrecta",
          403,
        );
      const mail = email(b.email),
        name = str(b.name),
        password = passwordValue(b.password, check);
      check(password.length >= 12, "Usa al menos 12 caracteres");
      const id = await transaction(async () => {
        check(
          !(await one("SELECT key FROM app_meta WHERE key='setup_complete'")) &&
          !(await one("SELECT id FROM users WHERE role='ADMIN'")),
          "Ya existe un administrador",
          409,
        );
        check(
          !(await one("SELECT id FROM users WHERE email=?", mail)),
          "Correo ya registrado",
          409,
        );
        const id = uuid();
        await run(
          "INSERT INTO users(id,email,name,password,role,created) VALUES(?,?,?,?,?,?)",
          id,
          mail,
          name,
          passwordHash(password),
          "ADMIN",
          now(),
        );
        await run("INSERT INTO app_meta(key,value) VALUES('setup_complete',?)", now());
        return id;
      });
      return json(
        res,
        { user: await publicUser(id), csrf: await rotate(s, id, res) },
        201,
      );
    }
    if (path === "/api/auth/register" && method === "POST") {
      await limit(`auth:${clientIp(req)}`, 10, 900000);
      const mail = email(b.email),
        name = str(b.name),
        password = passwordValue(b.password, check);
      check(
        password.length >= 12,
        "La contraseña debe tener al menos 12 caracteres",
      );
      check(
        !(await one("SELECT id FROM users WHERE email=?", mail)),
        "No se pudo crear la cuenta. Revisa tus datos.",
        409,
      );
      const id = uuid();
      await run(
        "INSERT INTO users(id,email,name,password,role,created) VALUES(?,?,?,?,?,?)",
        id,
        mail,
        name,
        passwordHash(password),
        "CUSTOMER",
        now(),
      );
      return json(
        res,
        { user: await publicUser(id), csrf: await rotate(s, id, res) },
        201,
      );
    }
    if (path === "/api/auth/login" && method === "POST") {
      await limit(`auth:${clientIp(req)}`, 10, 900000);
      const u = await one("SELECT * FROM users WHERE email=?", email(b.email));
      check(
        u && !u.disabled && verifyPassword(b.password, u.password),
        "Correo o contraseña incorrectos.",
        401,
      );
      return json(res, {
        user: await publicUser(u.id),
        csrf: await rotate(s, u.id, res),
      });
    }
    if (path === "/api/auth/logout" && method === "POST")
      return json(res, { csrf: await rotate(s, null, res) });
    if (path === "/api/profile" && method === "PUT") {
      auth();
      await run(
        "UPDATE users SET name=?,phone=? WHERE id=?",
        str(b.name),
        optional(b.phone, 30),
        user.id,
      );
      return json(res, { ok: true });
    }
    if (path === "/api/addresses" && method === "POST") {
      auth();
      const id = uuid();
      await run(
        "INSERT INTO addresses VALUES(?,?,?,?,?,?)",
        id,
        user.id,
        str(b.street),
        str(b.city),
        str(b.region),
        optional(b.reference),
      );
      return json(res, { id }, 201);
    }
    if (path.startsWith("/api/addresses/") && method === "DELETE") {
      auth();
      await run(
        "DELETE FROM addresses WHERE id=? AND user_id=?",
        path.split("/").pop(),
        user.id,
      );
      return json(res, { ok: true });
    }
    if (path === "/api/favorites" && method === "POST") {
      auth();
      const id = str(b.productId);
      check(
        await one("SELECT id FROM products WHERE id=?", id),
        "Prenda no encontrada",
        404,
      );
      if (b.selected)
        await run("INSERT OR IGNORE INTO favorites VALUES(?,?)", user.id, id);
      else
        await run(
          "DELETE FROM favorites WHERE user_id=? AND product_id=?",
          user.id,
          id,
        );
      return json(res, { ok: true });
    }
    if (path === "/api/outfits" && method === "POST") {
      auth();
      check(Array.isArray(b.items) && b.items.length <= 12, "Look no válido");
      for (const id of b.items)
        check(
          await one("SELECT id FROM products WHERE id=? AND active=1", str(id)),
          "Prenda no disponible",
        );
      check(
        await one("SELECT id FROM mannequins WHERE id=?", str(b.mannequinId)),
        "Maniquí no disponible",
      );
      const id = uuid();
      await run(
        "INSERT INTO outfits VALUES(?,?,?,?,?,?,?)",
        id,
        user.id,
        str(b.name),
        b.mannequinId,
        JSON.stringify(b.items),
        b.shared ? token() : null,
        now(),
      );
      return json(res, { id }, 201);
    }
    if (path.startsWith("/api/outfits/") && method === "DELETE") {
      auth();
      await run(
        "DELETE FROM outfits WHERE id=? AND user_id=?",
        path.split("/").pop(),
        user.id,
      );
      return json(res, { ok: true });
    }
    if (path.startsWith("/api/looks/") && method === "GET") {
      const o = await one(
        "SELECT name,mannequin_id,items FROM outfits WHERE share_id=?",
        path.split("/").pop(),
      );
      check(o, "Look no disponible", 404);
      return json(res, { ...o, items: JSON.parse(o.items) });
    }
    if (path === "/api/quote" && method === "POST") {
      const q = await quote(b);
      return json(res, {
        subtotal: q.subtotal,
        discount: q.discount,
        shipping: q.shipping,
        total: q.total,
      });
    }
    if (path === "/api/orders" && method === "POST") {
      const settings = await one("SELECT * FROM settings WHERE id=1");
      check(
        settings.checkout_enabled,
        "La tienda todavía no acepta pedidos.",
        409,
      );
      check(
        (b.payment === "transfer" && settings.bank_instructions) ||
          (b.payment === "cod" && settings.cod),
        "Método de pago no disponible",
      );
      const key = str(b.idempotency, 100);
      const existing = await one(
        "SELECT id,user_id,guest_session FROM orders WHERE idempotency=?",
        key,
      );
      if (existing) {
        check(
          existing.guest_session === s.id ||
            (user && existing.user_id === user.id),
          "Solicitud duplicada",
          409,
        );
        return json(res, { id: existing.id });
      }
      const name = str(b.name),
        mail = email(b.email),
        phone = str(b.phone, 30),
        address = JSON.stringify({
          street: str(b.street),
          city: str(b.city),
          region: str(b.region),
          reference: optional(b.reference),
        });
      const id = await transaction(async () => {
        const existing = await one(
          "SELECT id,user_id,guest_session FROM orders WHERE idempotency=?",
          key,
        );
        if (existing) {
          check(
            existing.guest_session === s.id ||
              (user && existing.user_id === user.id),
            "Solicitud duplicada",
            409,
          );
          return existing.id;
        }
        const q = await quote(b),
          id = uuid();
        await run(
          "INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          user?.id || null,
          s.id,
          key,
          name,
          mail,
          phone,
          address,
          b.delivery,
          b.payment,
          "PENDING",
          q.subtotal,
          q.discount,
          q.shipping,
          q.total,
          q.promotion?.id || null,
          now(),
        );
        for (const row of q.items) {
          check(
            (
              await run(
                "UPDATE variants SET stock=stock-? WHERE id=? AND stock>=?",
                row.quantity,
                row.id,
                row.quantity,
              )
            ).changes,
            "El stock cambió durante la compra",
            409,
          );
          await run(
            "INSERT INTO order_items VALUES(?,?,?,?,?,?,?)",
            uuid(),
            id,
            row.id,
            row.name,
            row.size,
            row.price,
            row.quantity,
          );
          await run(
            "INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)",
            uuid(),
            row.id,
            -row.quantity,
            "Pedido " + id,
            user?.id || null,
            now(),
          );
        }
        if (q.promotion)
          await run(
            "UPDATE promotions SET uses=uses+1 WHERE id=?",
            q.promotion.id,
          );
        await run(
          "INSERT INTO payments(order_id,status) VALUES(?,?)",
          id,
          "PENDING",
        );
        await run(
          "INSERT INTO order_history VALUES(?,?,?,?,?,?)",
          uuid(),
          id,
          "PENDING",
          "Pedido recibido",
          user?.id || null,
          now(),
        );
        return id;
      });
      return json(res, { id }, 201);
    }
    if (path === "/api/events" && method === "POST") {
      check(
        [
          "garment_tried",
          "garment_removed",
          "outfit_saved",
          "outfit_added_to_cart",
          "checkout_started",
        ].includes(b.type),
      );
      await run(
        "INSERT INTO events VALUES(?,?,?,?,?)",
        uuid(),
        s.id,
        b.type,
        optional(b.productId),
        now(),
      );
      return json(res, { ok: true });
    }
    if (path === "/api/reviews" && method === "POST") {
      auth();
      const productId = str(b.productId);
      check(
        await one(
          "SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN variants v ON v.id=oi.variant_id WHERE o.user_id=? AND o.status='DELIVERED' AND v.product_id=?",
          user.id,
          productId,
        ),
        "Solo puedes reseñar prendas de pedidos entregados",
        403,
      );
      await run(
        "INSERT INTO reviews VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET rating=excluded.rating,body=excluded.body",
        uuid(),
        user.id,
        productId,
        integer(b.rating, 1, 5),
        str(b.body, 1500),
        now(),
      );
      return json(res, { ok: true });
    }
    if (path === "/api/reviews" && method === "GET")
      return json(
        res,
        await all(
          "SELECT r.rating,r.body,r.created,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE product_id=?",
          url.searchParams.get("productId") || "",
        ),
      );
    if (path.startsWith("/api/admin/")) {
      admin();
      const entity = path.split("/")[3],
        id = path.split("/")[4];
      if (entity === "overview" && method === "GET")
        return json(res, {
          products: await catalog(true),
          orders: await orders(user, s.id, true),
          customers: await all(
            "SELECT id,name,email,phone,created FROM users WHERE role='CUSTOMER'",
          ),
          movements: await all(
            "SELECT m.*,v.size,p.name FROM inventory_movements m JOIN variants v ON v.id=m.variant_id JOIN products p ON p.id=v.product_id ORDER BY m.created DESC LIMIT 200",
          ),
          promotions: await all("SELECT * FROM promotions"),
          mannequins: await all("SELECT * FROM mannequins ORDER BY sort"),
          assets: await all("SELECT * FROM garment_assets"),
          events: await all(
            "SELECT type,count(*) count FROM events GROUP BY type",
          ),
          settings: await one("SELECT * FROM settings WHERE id=1"),
          access: await accessOverview(),
        });
      if (entity === "uploads" && method === "POST") {
        const type = str(b.type);
        check(
          ["image/png", "image/jpeg", "image/webp"].includes(type),
          "Formato no permitido",
        );
        check(
          typeof b.data === "string" && b.data.length <= 4194304,
          "Archivo demasiado grande",
        );
        const bytes = Buffer.from(b.data, "base64");
        check(
          bytes.length > 12 && bytes.length <= 2 * 1024 * 1024,
          "Archivo demasiado grande",
        );
        check(
          (type === "image/png" &&
            bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
            (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) ||
            (type === "image/webp" &&
              bytes.toString("ascii", 0, 4) === "RIFF" &&
              bytes.toString("ascii", 8, 12) === "WEBP"),
          "Imagen no válida",
        );
        const name = `${uuid()}.${type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp"}`;
        await limit('uploads:' + user.id, 40, 3600000);
        await run('INSERT INTO media(path,url,created,data,mime) VALUES(?,?,?,?,?)', '/uploads/' + name, '', now(), bytes.toString('base64'), type);
        return json(res, { url: `/uploads/${name}` }, 201);
      }
      if (entity === "products" && ["POST", "PUT"].includes(method)) {
        const pid = id || uuid();
        check(
          [
            "TOP",
            "BOTTOM",
            "DRESS",
            "OUTERWEAR",
            "SHOES",
            "BAG",
            "ACCESSORY_HEAD",
            "ACCESSORY",
          ].includes(b.category),
        );
        check(["Damas", "Caballeros", "Unisex"].includes(b.gender));
        const name = str(b.name),
          description = str(b.description, 3000),
          color = str(b.color, 80),
          price = integer(b.price),
          image = b.image ? assetUrl(b.image) : null;
        await transaction(async () => {
          if (id) {
            check(
              await one("SELECT id FROM products WHERE id=?", id),
              "No encontrado",
              404,
            );
            await run(
              "UPDATE products SET name=?,description=?,category=?,gender=?,color=?,price=?,image=?,active=? WHERE id=?",
              name,
              description,
              b.category,
              b.gender,
              color,
              price,
              image,
              b.active ? 1 : 0,
              pid,
            );
          } else
            await run(
              "INSERT INTO products(id,name,description,category,gender,color,price,image,cell,created) VALUES(?,?,?,?,?,?,?,?,?,?)",
              pid,
              name,
              description,
              b.category,
              b.gender,
              color,
              price,
              image,
              integer(b.cell || 1, 0, 5),
              now(),
            );
          check(Array.isArray(b.sizes) && b.sizes.length <= 20);
          for (const size of b.sizes) {
            const label = str(size, 20);
            if (
              !(await one(
                "SELECT id FROM variants WHERE product_id=? AND size=?",
                pid,
                label,
              ))
            )
              await run(
                "INSERT INTO variants VALUES(?,?,?,?,?)",
                uuid(),
                pid,
                label,
                `${pid}-${label}`,
                0,
              );
          }
          if (b.swatch !== undefined) {
            check(/^#[a-f0-9]{6}$/i.test(b.swatch), 'Muestra de color no válida');
            await run('UPDATE products SET swatch=? WHERE id=?', b.swatch, pid);
          }
        });
        return json(res, { id: pid });
      }
      if (entity === "products" && method === "DELETE") {
        await run("UPDATE products SET active=0 WHERE id=?", id);
        return json(res, { ok: true });
      }
      if (entity === "inventory" && method === "POST") {
        const variant = str(b.variantId),
          delta = integer(b.delta, -100000, 100000);
        check(delta !== 0);
        await transaction(async () => {
          check(
            (
              await run(
                "UPDATE variants SET stock=stock+? WHERE id=? AND stock+?>=0",
                delta,
                variant,
                delta,
              )
            ).changes,
            "No existe la variante o el stock quedaría negativo",
            409,
          );
          await run(
            "INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)",
            uuid(),
            variant,
            delta,
            str(b.reason),
            user.id,
            now(),
          );
        });
        return json(res, { ok: true });
      }
      if (entity === "mannequins" && ["POST", "PUT"].includes(method)) {
        const mid = id || uuid();
        const args = [
          str(b.name),
          str(b.gender, 30),
          assetUrl(b.image),
          b.active ? 1 : 0,
          integer(b.sort || 0),
          mid,
        ];
        if (id)
          await run(
            "UPDATE mannequins SET name=?,gender=?,image=?,active=?,sort=? WHERE id=?",
            ...args,
          );
        else
          await run(
            "INSERT INTO mannequins(name,gender,image,active,sort,id) VALUES(?,?,?,?,?,?)",
            ...args,
          );
        return json(res, { id: mid });
      }
      if (entity === "assets" && method === "POST") {
        const vals = ["x", "y", "width", "height", "rotation"].map((k) =>
          Number(b[k]),
        );
        check(
          vals.every(Number.isFinite) &&
            vals[0] >= -100 &&
            vals[0] <= 100 &&
            vals[1] >= -100 &&
            vals[1] <= 100 &&
            vals[2] > 0 &&
            vals[2] <= 150 &&
            vals[3] > 0 &&
            vals[3] <= 150 &&
            Math.abs(vals[4]) <= 180,
          "Posición no válida",
        );
        await run(
          "INSERT INTO garment_assets VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(product_id,mannequin_id) DO UPDATE SET x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,rotation=excluded.rotation,z=excluded.z,image=excluded.image",
          str(b.productId),
          str(b.mannequinId),
          ...vals,
          integer(b.z, 0, 100),
          b.image ? assetUrl(b.image) : null,
        );
        return json(res, { ok: true });
      }
      if (entity === "promotions" && ["POST", "PUT"].includes(method)) {
        const pid = id || uuid(),
          code = str(b.code, 40).toUpperCase();
        check(/^\d{4}-\d{2}-\d{2}$/.test(b.expires), "Fecha no válida");
        const args = [
          code,
          integer(b.percent, 1, 100),
          integer(b.minimum),
          integer(b.maxUses, 1),
          b.expires,
          b.active ? 1 : 0,
          pid,
        ];
        if (id)
          await run(
            "UPDATE promotions SET code=?,percent=?,minimum=?,max_uses=?,expires=?,active=? WHERE id=?",
            ...args,
          );
        else
          await run(
            "INSERT INTO promotions(code,percent,minimum,max_uses,expires,active,id) VALUES(?,?,?,?,?,?,?)",
            ...args,
          );
        return json(res, { id: pid });
      }
      if (entity === "promotions" && method === "DELETE") {
        await run("UPDATE promotions SET active=0 WHERE id=?", id);
        return json(res, { ok: true });
      }
      if (entity === "settings" && method === "PUT") {
        await run(
          "UPDATE settings SET shipping=?,free_over=?,bank_instructions=?,cod=?,store_name=?,address=?,phone=?,checkout_enabled=? WHERE id=1",
          integer(b.shipping),
          integer(b.freeOver),
          optional(b.bankInstructions, 2000),
          b.cod ? 1 : 0,
          str(b.storeName),
          optional(b.address),
          optional(b.phone, 30),
          b.checkoutEnabled ? 1 : 0,
        );
        return json(res, { ok: true });
      }
      if (entity === "orders" && method === "PUT") {
        await transaction(async () => {
          const o = await one("SELECT * FROM orders WHERE id=?", id);
          check(o, "Pedido no encontrado", 404);
          const transitions = {
            PENDING: ["CONFIRMED", "CANCELLED"],
            CONFIRMED: ["PREPARING", "CANCELLED"],
            PREPARING: ["SHIPPED", "READY", "CANCELLED"],
            READY: ["DELIVERED", "CANCELLED"],
            SHIPPED: ["DELIVERED"],
            DELIVERED: [],
            CANCELLED: [],
          };
          check(
            !(b.paid && b.refunded),
            "No puedes registrar pago y devolución a la vez",
          );
          if (b.refunded) {
            check(
              (await one("SELECT status FROM payments WHERE order_id=?", id))
                ?.status === "PAID",
              "Solo se puede devolver un pago confirmado",
              409,
            );
            await run(
              "UPDATE payments SET status=?,reference=?,recorded_by=? WHERE order_id=?",
              "REFUNDED",
              str(b.reference),
              user.id,
              id,
            );
          }
          if (b.status && b.status !== o.status) {
            check(
              transitions[o.status]?.includes(b.status),
              "Transición de estado no permitida",
              409,
            );
            if (b.status === "CANCELLED") {
              check(
                (await one("SELECT status FROM payments WHERE order_id=?", id))
                  ?.status !== "PAID",
                "Registra primero la devolución del pago",
                409,
              );
              for (const item of await all(
                "SELECT * FROM order_items WHERE order_id=?",
                id,
              )) {
                await run(
                  "UPDATE variants SET stock=stock+? WHERE id=?",
                  item.quantity,
                  item.variant_id,
                );
                await run(
                  "INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)",
                  uuid(),
                  item.variant_id,
                  item.quantity,
                  `Cancelación ${id}`,
                  user.id,
                  now(),
                );
              }
            }
            await run("UPDATE orders SET status=? WHERE id=?", b.status, id);
            await run(
              "INSERT INTO order_history VALUES(?,?,?,?,?,?)",
              uuid(),
              id,
              b.status,
              optional(b.note),
              user.id,
              now(),
            );
          }
          if (b.paid) {
            check(o.status !== "CANCELLED", "Pedido cancelado", 409);
            await run(
              "UPDATE payments SET status='PAID',reference=?,recorded_by=? WHERE order_id=?",
              str(b.reference),
              user.id,
              id,
            );
          }
          if (b.tracking)
            await run(
              "INSERT INTO shipments VALUES(?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET carrier=excluded.carrier,tracking=excluded.tracking,updated=excluded.updated",
              id,
              str(b.carrier),
              str(b.tracking),
              now(),
            );
        });
        return json(res, { ok: true });
      }
    }
    throw new ApiError(404, "Ruta no encontrada");
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error("Request failed:", error.message);
    json(
      res,
      {
        error:
          status === 500 ? "No se pudo completar la operación." : error.message,
      },
      status,
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  http
    .createServer(handler)
    .listen(port, host, () => console.log("Lulos local: " + origin));
}
