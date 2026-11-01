// Rechte Spalte neben einem Spickzettel (DK: SKAT-Formular, CH: ESTV-ePortal).
// Links steht die 600px breite Übertragungshilfe, rechts bleibt Platz für ein
// zweites Browserfenster mit dem echten Portal. Die Skizze deutet das nur an,
// ohne Layout oder Branding der Behördenseite nachzubilden. Auf schmalen
// Bildschirmen per CSS ausgeblendet (.cheat-illustration, dkCase/step5Skat.css);
// dort zeigt portalInlineHtml() Hinweis und Button oberhalb des Spickzettels.

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * @param {{ url: string, host: string, caption: string, buttonLabel: string }} options
 *   host: Adresse in der angedeuteten Adresszeile, z.B. "eportal.admin.ch"
 */
export function portalSideHtml({ url, host, caption, buttonLabel }) {
  return `
    <aside class="cheat-illustration">
      <div class="browser-mock" aria-hidden="true">
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
      <div class="cheat-illustration-caption">${caption}</div>
      <a class="btn-accent btn-small cheat-illustration-btn" href="${esc(url)}" target="_blank" rel="noopener">${esc(buttonLabel)}</a>
    </aside>`;
}

/** Gleicher Hinweis kompakt, nur sichtbar, wenn die rechte Spalte ausgeblendet ist */
export function portalInlineHtml({ url, caption, buttonLabel }) {
  return `
    <div class="info-banner cheat-portal-inline"><span class="icon">🔗</span><div>
      ${caption}
      <div style="margin-top:8px;"><a class="btn-accent btn-small" href="${esc(url)}" target="_blank" rel="noopener">${esc(buttonLabel)}</a></div>
    </div></div>`;
}
