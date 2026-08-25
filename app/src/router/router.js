// Hash-basiertes Routing. Bewusst kein History-API-Routing: GitHub Pages hat
// keine serverseitigen Rewrites, ein Hard-Reload auf einer tiefen History-API-
// URL würde 404en. Der Hash-Teil einer URL geht nie an den Server – GitHub
// Pages liefert immer index.html, der Router liest location.hash rein
// clientseitig. Bei der überschaubaren Routenzahl reicht einfaches manuelles
// Pattern-Matching, keine Router-Bibliothek nötig.

const routes = [];

/**
 * @param {string} pattern z.B. "#/dk/:caseId/step1"
 * @param {(params: Record<string,string>) => void} handler
 */
export function route(pattern, handler) {
  routes.push({ segments: pattern.split("/"), handler });
}

function match(hash) {
  const hashSegments = hash.split("/");
  for (const { segments, handler } of routes) {
    if (segments.length !== hashSegments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.startsWith(":")) {
        params[seg.slice(1)] = decodeURIComponent(hashSegments[i]);
      } else if (seg !== hashSegments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler, params };
  }
  return null;
}

function currentHash() {
  return window.location.hash || "#/";
}

function renderRoute() {
  const found = match(currentHash());
  if (found) {
    found.handler(found.params);
  } else {
    window.location.hash = "#/";
  }
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function startRouter() {
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}
