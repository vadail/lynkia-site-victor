// Paginas de compra de esta tienda servidas bajo este dominio (fichero generado al conectar el dominio; no editar).
// La ficha, el curso, el carrito, el pago, el pedido y el acceso se piden a la app y se sirven desde aqui, con el
// nombre y el icono de la tienda. Los cursos tienen ademas su direccion bonita en la raiz de la web (<dominio>/<curso>).
// Todo lo demas sigue con `context.next()`: la web del creador se sirve como siempre.
const APP = "https://lynkia.app";
const API = "https://api.lynkia.app";
const HANDLE = "victor";
const PREFIXES = ["/access", "/pedido", "/survey", "/live", "/app-assets", "/lib", "/terms", "/privacy"];
const VERSION = "2";
// Direcciones de la raiz que nunca son de un curso (las de la app y las propias de esta funcion).
const RESERVED = new Set(["c", "_lynkia", ...PREFIXES.map((p) => p.replace(/^\//, ""))]);

function esc(value) {
  return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function store() {
  try {
    const res = await fetch(`${API}/private-content/public/${HANDLE}/theme`, { cf: { cacheTtl: 300, cacheEverything: true } });
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

function icon(p) {
  if (p && p.favicon_url) return `<link rel="icon" href="${esc(p.favicon_url)}" />`;
  if (p && p.avatar_url) return `<link rel="icon" href="${esc(p.avatar_url)}" />`;
  const letter = ((p && p.name) || "?").trim().charAt(0).toUpperCase();
  const color = (p && p.theme && p.theme.accent) || (p && p.accent_color) || "#7c6bf5";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${color}'/><text x='32' y='44' font-size='32' font-family='Arial,sans-serif' font-weight='700' fill='white' text-anchor='middle'>${esc(letter)}</text></svg>`;
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`;
}

export function rebrand(html, p, href) {
  const name = esc((p && p.name) || "");
  html = html.replace(/<link[^>]+rel="manifest"[^>]*>/gi, "");
  html = html.replace(/<link[^>]+rel="icon"[^>]*>/gi, icon(p));
  html = html.replace(/<meta[^>]+name="apple-mobile-web-app-title"[^>]*>/gi, `<meta name="apple-mobile-web-app-title" content="${name}" />`);
  html = html.replace(/<meta[^>]+property="og:site_name"[^>]*>/gi, `<meta property="og:site_name" content="${name}" />`);
  html = html.replace(/<meta[^>]+property="og:url"[^>]*>/gi, `<meta property="og:url" content="${esc(href)}" />`);
  // Lo que aun habla de la plataforma (el titulo y la descripcion por defecto de la app): el nombre de la tienda.
  const platform = /Lynkia|Analiza tu contenido/;
  html = html.replace(/<title>([^<]*)<\/title>/i, (tag, text) => (platform.test(text) ? `<title>${name}</title>` : tag));
  html = html.replace(/(<meta[^>]+(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"[^>]*content=")([^"]*)(")/gi, (tag, a, text, b) => (platform.test(text) ? a + name + b : tag));
  // El logo de la plataforma al compartir: su foto, o ninguna imagen.
  html = html.replace(/<meta[^>]+(?:property|name)="(?:og:image|twitter:image)"[^>]*content="[^"]*lynkia-icon[^"]*"[^>]*>/gi, (tag) =>
    p && p.avatar_url ? tag.replace(/content="[^"]*"/, `content="${esc(p.avatar_url)}"`) : ""
  );
  // La app sabe de quien es esta tienda (la direccion bonita de un curso no lleva el handle): ver frontend/src/lib/storeHost.ts.
  html = html.replace("</head>", `<script>window.__LYNKIA_HANDLE__=${JSON.stringify(HANDLE)};</script></head>`);
  return html;
}

function proxied(path) {
  if (path === `/c/${HANDLE}` || path.startsWith(`/c/${HANDLE}/`)) return true;
  return PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// <dominio>/<curso>: una sola direccion, sin extension y que no sea de la app. Solo la API sabe si es un curso de este creador.
async function courseSlug(path) {
  const match = path.match(/^\/([a-z0-9][a-z0-9-]{0,79})\/?$/);
  if (!match || RESERVED.has(match[1])) return null;
  try {
    const res = await fetch(`${API}/private-content/public/${HANDLE}/resolve/${match[1]}`, { cf: { cacheTtl: 300, cacheEverything: true } });
    return res.ok ? match[1] : null;
  } catch (e) {
    return null;
  }
}

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  if (url.pathname === "/_lynkia/health") {
    return new Response(JSON.stringify({ version: VERSION, handle: HANDLE }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  let upstreamPath = null;
  if (proxied(url.pathname)) upstreamPath = url.pathname;
  else if (request.method === "GET" || request.method === "HEAD") {
    const slug = await courseSlug(url.pathname);
    if (slug) upstreamPath = `/c/${HANDLE}/${slug}`;
  }
  if (upstreamPath === null) return context.next();
  const headers = new Headers();
  for (const h of ["accept", "accept-language", "user-agent", "if-none-match", "if-modified-since"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  // La app (frontend/functions/c/) no redirige a la direccion bonita lo que pide esta funcion: seria un bucle.
  headers.set("x-lynkia-store", "1");
  const upstream = await fetch(APP + upstreamPath + url.search, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers,
    redirect: "manual",
  });
  if (upstream.status >= 300 && upstream.status < 400 && upstream.headers.get("location")) {
    const location = upstream.headers.get("location").replace(APP, "");
    return Response.redirect(new URL(location, url.origin).toString(), upstream.status);
  }
  const type = upstream.headers.get("content-type") || "";
  if (!type.includes("text/html")) return new Response(upstream.body, upstream);
  const html = rebrand(await upstream.text(), await store(), url.href);
  const out = new Headers(upstream.headers);
  out.delete("content-length");
  out.delete("etag");
  out.set("cache-control", "no-cache");
  return new Response(html, { status: upstream.status, headers: out });
}
