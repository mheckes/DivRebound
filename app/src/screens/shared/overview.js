// Überblick "So läuft es ab" - erste Seite eines Antrags in allen Ländern.
// Hier wird nichts eingetippt: die Phasen, wer was macht (je höchstens drei
// kurze Punkte) und was bereitliegen sollte (ein Satz). Für wen der Antrag
// ist (privat, Wohnsitz), zeigt der Antragsteller-Chip im Kopf
// (shared/stepFrame.js) - kein Häkchen, kein Erklärsatz (Stand 2.1).

import { phasesHtml } from "../../components/flow.js";

/**
 * @param {HTMLElement} container
 * @param {{
 *   reclaimCase?: object,
 *   country: string, headerHtml: string, navHtml: string,
 *   does: string[], youDo: string[],
 *   prepare: string   // "Leg dir bereit", ein Satz, einfaches HTML erlaubt
 * }} options
 */
export function renderOverview(container, profile, { country, headerHtml, navHtml, does, youDo, prepare }) {
  const list = (items) => `<ul class="ch-list">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  container.innerHTML = `
    <div class="ch-page">
    ${headerHtml}

    ${phasesHtml({ country, current: "prepare" })}

    <div class="ch-two-col">
      <div class="card"><div class="card-head"><span class="card-title">Das übernimmt DivRebound</span></div><div class="card-body">${list(does)}</div></div>
      <div class="card"><div class="card-head"><span class="card-title">Das machst du selbst</span></div><div class="card-body">${list(youDo)}</div></div>
    </div>

    <div class="card"><div class="card-body"><b>Leg dir bereit:</b> ${prepare}</div></div>

    ${navHtml}
    </div>`;
}
