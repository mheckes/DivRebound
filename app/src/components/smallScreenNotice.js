// Hinweis für Handys: DivRebound ist für Computer und Tablet gebaut (PDFs,
// Ausdrucke, ausländische Portale) und speichert nur im Browser des Geräts.
// Unter 760px Breite liegt beim Start diese Seite über der App. "Trotzdem
// öffnen" blendet sie aus und merkt sich die Wahl auf diesem Gerät.

import { websiteHome } from "../config/siteLinks.js";

const NARROW_QUERY = "(max-width: 760px)";
const STORAGE_KEY = "divrebound.smallScreenAccepted";

function accepted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Ohne Speicher erscheint der Hinweis beim nächsten Start eben wieder.
  }
}

/** Zeigt den Hinweis, falls der Bildschirm schmal ist und noch nicht bestätigt wurde. */
export function mountSmallScreenNotice(root) {
  if (!window.matchMedia(NARROW_QUERY).matches || accepted()) return;

  // Link auf die App ohne #/... - am Computer startet sie ohnehin auf der Startseite.
  const appUrl = location.origin + location.pathname;

  const el = document.createElement("div");
  el.className = "small-screen-notice";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "ssn-title");
  el.innerHTML = `
    <div class="ssn-inner">
      <div class="ssn-brand">
        <div class="ssn-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12L9 17" stroke="white" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M9 17L20 5M20 5L14.9 7.1M20 5L18.4 10.3" stroke="#00B4D8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span>DivRebound</span>
      </div>
      <div class="ssn-icon" aria-hidden="true">💻</div>
      <h1 class="ssn-title" id="ssn-title">DivRebound ist für Computer und Tablet gemacht</h1>
      <p class="ssn-text">Für die Rückforderung lädst du PDFs hoch, druckst Formulare aus und überträgst Werte in die Portale ausländischer Steuerbehörden. Das geht am großen Bildschirm deutlich leichter.</p>
      <div class="ssn-info">
        <strong>Gut zu wissen:</strong> Deine Daten bleiben nur auf dem Gerät, auf dem du startest. Öffne DivRebound deshalb am besten gleich am Computer.
      </div>
      <button type="button" class="ssn-btn ssn-btn-primary" data-ssn="copy">🔗 Link kopieren</button>
      <div class="ssn-link" hidden>${appUrl}</div>
      <p class="ssn-hint">Schick dir den Link per Mail oder Messenger und öffne ihn am Computer.</p>
      <button type="button" class="ssn-btn ssn-btn-secondary" data-ssn="open">Trotzdem öffnen</button>
      <a class="ssn-back" href="${websiteHome}">← Zur Website</a>
    </div>
  `;

  const copyBtn = el.querySelector('[data-ssn="copy"]');
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      copyBtn.textContent = "✓ Link kopiert";
    } catch {
      // Kein Zugriff auf die Zwischenablage: Link zum Markieren anzeigen.
      el.querySelector(".ssn-link").hidden = false;
      copyBtn.textContent = "Link unten markieren und kopieren";
    }
  });

  el.querySelector('[data-ssn="open"]').addEventListener("click", () => {
    remember();
    el.remove();
    document.documentElement.classList.remove("ssn-open");
  });

  document.documentElement.classList.add("ssn-open");
  root.appendChild(el);
}
