let loaded;
export default async function api(req, res) {
  try {
    loaded ||= import("../server/server.mjs");
    const { handler } = await loaded;
    return await handler(req, res);
  } catch {
    loaded = undefined;
    console.error(
      "API startup failed. Check PostgreSQL connection and PUBLIC_ORIGIN.",
    );
    res.writeHead(503, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        error:
          "La tienda está en mantenimiento. Intenta nuevamente en unos minutos.",
      }),
    );
  }
}
