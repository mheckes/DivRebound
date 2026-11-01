// Portal neben einem Spickzettel (DK: SKAT-Formular, CH: ESTV-ePortal).
// portalBoxHtml(): Box ganz oben mit Hinweis und "… öffnen"-Button.
// portalSideHtml(): rechte Spalte neben der 600px breiten Übertragungshilfe -
// dort bleibt Platz für ein zweites Browserfenster mit dem echten Portal. Die
// Skizze deutet das nur an, ohne Layout oder Branding der Behördenseite
// nachzubilden. Auf schmalen Bildschirmen per CSS ausgeblendet
// (.cheat-illustration, dkCase/step5Skat.css).

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * @param {{ title: string, sub?: string, docTitle: string, text: string, url: string, buttonLabel: string }} options
 *   text darf einfaches HTML enthalten (z.B. <b>)
 */
export function portalBoxHtml({ title, sub, docTitle, text, url, buttonLabel }) {
  return `
    <div class="card">
      <div class="card-head head-navy"><span class="card-title">${esc(title)}</span>${sub ? `<span class="ch-head-sub">${esc(sub)}</span>` : ""}</div>
      <div class="doc-item">
        <div>
          <div class="doc-title">${esc(docTitle)}</div>
          <div class="doc-sub">${text}</div>
        </div>
        <div class="doc-actions"><a class="btn-accent btn-small" href="${esc(url)}" target="_blank" rel="noopener">${esc(buttonLabel)}</a></div>
      </div>
    </div>`;
}

/**
 * @param {{ host: string, caption: string }} options
 *   host: Adresse in der angedeuteten Adresszeile, z.B. "eportal.admin.ch"
 */
export function portalSideHtml({ host, caption }) {
  return `
    <aside class="cheat-illustration" aria-hidden="true">
      <div class="browser-mock">
        <div class="browser-mock-bar">
          <span class="browser-mock-dot"></span>
          <span class="browser-mock-dot"></span>
          <span class="browser-mock-dot"></span>
          <div class="browser-mock-url">${esc(host)}</div>
        </div>
        <div class="browser-mock-body">
          <div class="browser-mock-line browser-mock-title"></div>
          <div class="browser-mock-field-row"><div class="browser-mock-line browser-mock-label"></div><div class="browser-mock-box"></div></div>
          <div class="browser-mock-field-row"><div class="browser-mock-line browser-mock-label"></div><div class="browser-mock-box"></div></div>
          <div class="browser-mock-field-row"><div class="browser-mock-line browser-mock-label"></div><div class="browser-mock-box"></div></div>
          <div class="browser-mock-btn"></div>
        </div>
      </div>
      <div class="cheat-illustration-caption">${esc(caption)}</div>
    </aside>`;
}
