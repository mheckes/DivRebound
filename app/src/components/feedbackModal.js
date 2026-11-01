// Beta-Feedback direkt aus der App. Bildschirm, Schritt, Version und Browser
// werden automatisch mitgeschickt, Falldaten nie. Eine vorher im Inhalt
// markierte Textstelle wird als Zitat übernommen - sichtbar und editierbar,
// damit nichts ungewollt (z. B. eine IBAN) mitgeht.

import { FEEDBACK_ENDPOINT, FEEDBACK_EMAIL, FEEDBACK_KINDS } from "../config/feedback.js";
import { showToast } from "./toast.js";

const MAX_QUOTE = 500;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Link für die Brotkrumen-Zeile eines Schritts */
export function feedbackLinkHtml() {
  return `<button type="button" class="feedback-step-link" data-feedback="step">Feedback zu diesem Schritt</button>`;
}

function selectedContentText() {
  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? "";
  if (!text || !sel.anchorNode) return "";
  if (!document.getElementById("content-root")?.contains(sel.anchorNode)) return "";
  return text.replace(/\s+/g, " ").slice(0, MAX_QUOTE);
}

function screenContext() {
  // Überschriften mit persönlichen Angaben (Begrüßung mit Vornamen auf der
  // Startseite) tragen data-feedback-skip und werden nicht mitgeschickt.
  const titleEl = document.querySelector("#content-root .content-title:not([data-feedback-skip])");
  const title = titleEl?.textContent.trim() ?? "";
  const crumb = document.querySelector("#content-root .content-breadcrumb")?.textContent ?? "";
  // Fall-ID aus der Route entfernen - sagt dem Entwickler nichts und gehört dem Nutzer.
  const route = window.location.hash.replace(/^(#\/(?:dk|ch|it))\/[^/]+\//, "$1/:fall/");
  return {
    screen: [title, crumb.replace(/Feedback zu diesem Schritt/, "").replace(/\s+/g, " ").trim()]
      .filter(Boolean)
      .join(" · "),
    route,
    version: __APP_VERSION__,
    browser: navigator.userAgent,
    time: new Date().toISOString(),
  };
}

function mailtoHref(payload) {
  const body = [
    `Art: ${payload.kind}`,
    `Bildschirm: ${payload.screen} (${payload.route})`,
    ...(payload.quote ? [`Markiert: „${payload.quote}“`] : []),
    "",
    payload.message,
    "",
    `Version ${payload.version} · ${payload.browser} · ${payload.time}`,
  ].join("\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(body)}`;
}

export function openFeedbackModal({ quote = "" } = {}) {
  const ctx = screenContext();
  const overlay = document.createElement("div");
  overlay.className = "dr-modal-overlay";
  overlay.innerHTML = `
    <form class="dr-modal feedback-modal" novalidate>
      <h2 class="dr-modal-title">Feedback zur Beta</h2>
      <p class="dr-modal-hint">Danke fürs Testen! Bildschirm, App-Version und Browserinformation werden automatisch mitgeschickt. Nicht gesendet werden deine persönlichen Daten, Finanz- und Steuerdaten.</p>
      <details class="feedback-privacy">
        <summary>Datenschutzhinweis</summary>
        <p>Dein Feedback wird über den Dienst Formspree (USA) übermittelt und per E-Mail an den Betreiber von DivRebound weitergeleitet. Formspree speichert die Meldung bis zu 30 Tage.</p>
      </details>

      <div class="feedback-context">📍 ${esc(ctx.screen || ctx.route || "Startseite")}</div>

      <label class="feedback-field">
        <span class="field-label">Art</span>
        <select class="field-select" name="kind">
          ${FEEDBACK_KINDS.map((k) => `<option value="${k.value}" ${k.value === (quote ? "text" : "bug") ? "selected" : ""}>${k.label}</option>`).join("")}
        </select>
      </label>

      <label class="feedback-field" ${quote ? "" : "hidden"}>
        <span class="field-label">Markierte Textstelle</span>
        <textarea class="field-input feedback-quote" name="quote" rows="3">${esc(quote)}</textarea>
      </label>

      <label class="feedback-field">
        <span class="field-label">Was ist dir aufgefallen?</span>
        <textarea class="field-input feedback-message" name="message" rows="5" placeholder="z. B. „Hier ist unklar, welche Bescheinigung gemeint ist.“"></textarea>
      </label>

      <label class="feedback-field">
        <span class="field-label">E-Mail für Rückfragen <span class="field-hint">(freiwillig)</span></span>
        <input type="email" class="field-input" name="email" autocomplete="email" />
      </label>

      ${quote ? "" : `<p class="field-hint feedback-tip">Tipp: Markiere vorher eine Textstelle auf der Seite, dann wird sie hier automatisch eingefügt.</p>`}
      <p class="field-error dr-modal-error" hidden></p>
      <div class="dr-modal-actions">
        <button type="button" class="btn-secondary dr-modal-cancel">Abbrechen</button>
        <button type="submit" class="btn-primary dr-modal-confirm">Senden</button>
      </div>
    </form>`;
  document.getElementById("divrebound-app").appendChild(overlay);

  const form = overlay.querySelector("form");
  const error = overlay.querySelector(".dr-modal-error");
  const submit = overlay.querySelector(".dr-modal-confirm");
  form.elements.message.focus();

  const close = () => overlay.remove();
  overlay.querySelector(".dr-modal-cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  form.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.requestSubmit();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = form.elements.message.value.trim();
    if (!message) {
      error.textContent = "Bitte beschreibe kurz, was dir aufgefallen ist.";
      error.hidden = false;
      return;
    }
    // Leeres Feld ist gültig (freiwillig); Formspree lehnt ungültige Adressen sonst ab.
    const emailInput = form.elements.email;
    emailInput.value = emailInput.value.trim();
    if (!emailInput.checkValidity()) {
      error.textContent = "Bitte gültige E-Mail-Adresse eingeben oder das Feld leer lassen.";
      error.hidden = false;
      emailInput.focus();
      return;
    }
    const kindLabel = FEEDBACK_KINDS.find((k) => k.value === form.elements.kind.value).label;
    const payload = {
      subject: `DivRebound Beta · ${kindLabel} · ${ctx.screen || ctx.route}`,
      kind: kindLabel,
      screen: ctx.screen,
      route: ctx.route,
      quote: form.elements.quote.value.trim(),
      message,
      email: form.elements.email.value.trim(),
      version: ctx.version,
      browser: ctx.browser,
      time: ctx.time,
    };

    if (FEEDBACK_ENDPOINT) {
      submit.disabled = true;
      submit.textContent = "Wird gesendet …";
      try {
        const res = await fetch(FEEDBACK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        close();
        showToast("✓ Danke, dein Feedback ist angekommen");
        return;
      } catch {
        submit.disabled = false;
        submit.textContent = "Senden";
      }
    }

    if (!FEEDBACK_EMAIL) {
      error.textContent = "Feedback kann gerade nicht gesendet werden. Bitte versuche es später noch einmal.";
      error.hidden = false;
      return;
    }
    // Ohne Dienst bzw. wenn er nicht erreichbar ist: Mailprogramm mit dem schon geschriebenen Text.
    if (FEEDBACK_ENDPOINT) {
      error.innerHTML = `Senden hat nicht geklappt. <a href="${esc(mailtoHref(payload))}">Stattdessen per E-Mail schicken</a>`;
      error.hidden = false;
      error.querySelector("a").addEventListener("click", () => setTimeout(close, 0));
      return;
    }
    window.location.href = mailtoHref(payload);
    close();
  });
}

// Ein Listener für alle [data-feedback]-Auslöser (Seitenleiste, Schritt-Links).
// Die Markierung wird bei pointerdown gelesen - beim click hat der Browser sie
// unter Umständen schon aufgehoben.
export function installFeedbackTriggers() {
  let pendingQuote = "";
  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest("[data-feedback]")) pendingQuote = selectedContentText();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-feedback]")) return;
    const quote = pendingQuote || selectedContentText();
    pendingQuote = "";
    openFeedbackModal({ quote });
  });
}
