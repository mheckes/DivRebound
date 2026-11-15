// Überblick "So läuft es ab" - erste Seite eines Antrags in allen Ländern
// (ersetzt die frühere Checkliste "Unterlagen prüfen"). Hier wird nichts
// eingetippt: die drei Phasen, wer was macht und was bereitliegen sollte.
// Persönliche Angaben fragt erst der Schritt "Deine Angaben" ab, nach dem
// Upload - und nur, was im Profil noch fehlt.

import { phasesHtml } from "../../components/flow.js";

/**
 * @param {HTMLElement} container
 * @param {{
 *   country: string, headerHtml: string, navHtml: string,
 *   does: string[], youDo: string[],
 *   prepare: string[]   // "Leg dir das bereit", einfaches HTML erlaubt
 * }} options
 * @param {object} profile
 */
export function renderOverview(container, profile, { country, headerHtml, navHtml, does, youDo, prepare }) {
  const known = Boolean(profile?.residence?.tin && profile?.bank?.iban);
  const list = (items) => `<ul class="ch-list">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  container.innerHTML = `
    <div class="ch-page">
    ${headerHtml}

    ${phasesHtml({ country, current: "prepare" })}

    <div class="ch-two-col">
      <div class="card"><div class="card-head"><span class="card-title">Das übernimmt DivRebound</span></div><div class="card-body">${list(does)}</div></div>
      <div class="card"><div class="card-head"><span class="card-title">Das machst du selbst</span></div><div class="card-body">${list(youDo)}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-title">Leg dir das bereit</span></div>
      <div class="card-body">
        ${list(prepare)}
        <div class="field-hint" style="margin-top:10px;">${
          known
            ? "✓ Deine persönlichen Angaben kommen aus deinem Profil. Du musst nichts erneut eintippen."
            : "Beim ersten Antrag fragen wir einmalig ein paar persönliche Angaben ab, zum Beispiel Steuer-ID und IBAN. Sie landen in deinem Profil und sind beim nächsten Antrag schon da."
        }</div>
      </div>
    </div>

    ${navHtml}
    </div>`;
}
