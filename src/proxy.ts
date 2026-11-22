import { NextResponse, type NextRequest } from "next/server";

/**
 * Contraseña del panel cuando está en internet (Railway). Usuario: cualquiera; clave: DASHBOARD_PASSWORD.
 * En local (sin DASHBOARD_PASSWORD) el panel abre sin clave, como siempre.
 */
export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }
  return new NextResponse("Necesitas la clave del panel", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="The Rich Club bot"' },
  });
}
