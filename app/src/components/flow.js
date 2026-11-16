// Bausteine des Ablaufs, gleich für alle Länder
// (Mock Up Ablauf 11-2026/divrebound_ux_v2_mockup.html, Stand 2.1):
//  - phasesHtml(): die vier Boxen "Vorbereiten -> Bestätigen lassen ->
//    Einreichen -> Geld erhalten" (Startseite und Überblick eines Antrags)
//  - flagHtml(): Landesflagge als SVG (Windows zeigt Flaggen-Emoji nicht)
//  - taxOfficeWaysHtml(): "So kommt es zu deinem Finanzamt" mit den Wegen
//    ELSTER (Formular ohne Unterschrift, Original kommt per Post zurück) und Post
//  - taxOfficePauseHtml(): "Ist abgeschickt" (Datum für die Wartezeit) und
//    danach "Bestätigung ist da"; signNowHtml(): Unterschrift beim Einreichen
//  - pauseHtml(): die eine Pause-Komponente für alle Länder

import { corridors } from "../config/corridors.js";
import { PHASES } from "../config/caseSteps.js";
import { normalizeTaxOffice } from "../util/taxOffice.js";
import { showToast } from "./toast.js";
import * as caseRepo from "../db/caseRepo.js";
import { getState, setState } from "../store/store.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function flagHtml(country) {
  return `<span class="flag flag-${esc(String(country).toLowerCase())}" aria-hidden="true"></span>`;
}

/** Erstattung in Prozent der Bruttodividende (Quellensteuer minus DBA-Satz) */
export function refundPercent(country, residence = "DE") {
  const c = corridors[country];
  return Math.round((c.standardWithholdingRate - (c.treatyRateByResidence[residence] ?? c.treatyRateByResidence.DE)) * 100);
}

const GENERIC = {
  prepare: "Du lädst deine Dividendenabrechnungen hoch, DivRebound füllt das Formular aus.",
  confirm: "Dein deutsches Finanzamt bestätigt deinen Wohnsitz auf dem Formular, per ELSTER oder Post.",
  submit: "Du reichst den Antrag bei der ausländischen Steuerbehörde ein, online oder per Post.",
  money: "Die Erstattung kommt auf dein Konto.",
  moneyTime: "einige Monate",
};

const BY_COUNTRY = {
  DK: {
    prepare: "Du lädst deine Abrechnungen hoch und ergänzt ein paar Angaben.",
    submit: "Du überträgst die Werte ins Online-Formular der dänischen Steuerbehörde SKAT.",
  },
  CH: {
    prepareTime: "ca. 30 Min.",
    prepare: "Du erfasst deinen Bestand, lädst die Tax Voucher hoch und erstellst den Antrag im ePortal.",
    confirm: "Dein deutsches Finanzamt bestätigt deinen Wohnsitz auf dem Antrag, per ELSTER oder Post.",
    submit: "Du lädst den bestätigten Antrag im ePortal der Schweizer Steuerverwaltung hoch.",
    moneyTime: "einige Wochen",
  },
  IT: {
    prepare: "Du lädst deine Abrechnungen hoch und ergänzt ein paar Angaben.",
    confirm: "Dein deutsches Finanzamt bestätigt deinen Wohnsitz auf dem Formular.",
    submit: "Du schickst die bestätigten Formulare per Post an die italienische Steuerbehörde.",
    moneyTime: "viele Monate",
  },
  SE: {
    prepare: "Du lädst deine Abrechnungen hoch und ergänzt ein paar Angaben.",
    confirm: "Dein deutsches Finanzamt bestätigt deinen Wohnsitz auf dem Formular.",
    submit: "Du schickst das bestätigte Formular an die schwedische Steuerbehörde Skatteverket.",
  },
};

/** Übliche Dauer bis zur Auszahlung, z.B. "einige Monate" (Startseite: Wartezeit) */
export function payoutTime(country) {
  return { ...GENERIC, ...(BY_COUNTRY[country] ?? {}) }.moneyTime;
}

/**
 * @param {{ country?: string, current?: "prepare"|"confirm"|"submit"|"submitted"|"received" }} [options]
 *   country: Texte für dieses Land, sonst allgemein. current: hervorgehobene Phase.
 */
export function phasesHtml({ country, current } = {}) {
  const t = { ...GENERIC, ...(country ? BY_COUNTRY[country] : {}) };
  if (country) t.money = `Du bekommst ${refundPercent(country)} % der Bruttodividende zurück.`;
  const order = ["prepare", "confirm", "submit", "submitted", "received"];
  const at = order.indexOf(current);
  const box = (key, i, title, time, text, extra = "") => {
    const cls = at < 0 ? "" : i < at ? "past" : i === at ? "now" : "";
    return `
      <div class="phase ${cls} ${extra}">
        <span class="phase-n">${i < at && at >= 0 ? "✓" : key === "money" ? "€" : i + 1}</span>
        <div class="phase-title">${esc(title)}</div>
        <div class="phase-time">${esc(time)}</div>
        <p>${esc(text)}</p>
      </div>`;
  };
  return `
    <div class="phases">
      ${box("prepare", 0, PHASES.prepare.title, t.prepareTime ?? PHASES.prepare.time, t.prepare)}
      ${box("confirm", 1, PHASES.confirm.title, PHASES.confirm.time, t.confirm)}
      ${box("submit", 2, PHASES.submit.title, PHASES.submit.time, t.submit)}
      ${box("money", 3, "Geld erhalten", t.moneyTime, t.money, "phase-money")}
    </div>`;
}

/**
 * Text für die ELSTER-Nachricht an das Finanzamt. Seit Stand 2.1 geht das
 * Formular per ELSTER noch ohne Unterschrift ans Finanzamt; der Nutzer
 * unterschreibt das bestätigte Original, wenn es per Post zurück ist
 * (so von einem Finanzamt bestätigt).
 */
export function elsterMessageText(profile, { reference, originalRequired = false }) {
  const r = profile.residence;
  const lines = [
    "Sehr geehrte Damen und Herren,",
    "",
    `ich bitte um Bestätigung meiner steuerlichen Ansässigkeit in Deutschland auf dem beigefügten Dokument: ${reference}.`,
    "",
    originalRequired
      ? "Bitte senden Sie mir das bestätigte Dokument (Stempel und Unterschrift) im Original per Post zurück. Die ausländische Steuerbehörde verlangt das Original; ich unterschreibe es nach Erhalt selbst."
      : "Bitte senden Sie mir das bestätigte Dokument (Stempel und Unterschrift) per Post zurück. Ich unterschreibe es nach Erhalt selbst.",
    "",
    r.tin ? `Steuer-ID: ${r.tin}` : "",
    r.taxNumber ? `Steuernummer: ${r.taxNumber}` : "",
    "",
    "Vielen Dank und freundliche Grüße",
    [r.firstName, r.lastName].filter(Boolean).join(" "),
  ];
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n");
}

/** Gewählter Weg zum Finanzamt: "elster" (Standard) oder "post" */
export const taxOfficeWay = (reclaimCase) => reclaimCase?.taxOfficeWay ?? "elster";

/**
 * Karte "So kommt es zu deinem Finanzamt" (Stand 2.1): erst den Weg wählen
 * (zwei Kacheln), darunter die Schritte. ELSTER: Formular ohne Unterschrift
 * hochladen, das Finanzamt schickt das bestätigte Original per Post zurück,
 * unterschrieben wird beim Einreichen (signNowHtml). Post: unterschreiben und
 * mit Anschreiben schicken.
 * @param {object} profile
 * @param {object} reclaimCase
 * @param {{
 *   signText: string,           // z.B. "Formular ausdrucken und auf Seite 1 unterschreiben"
 *   confirmText: string,        // z.B. "Das Finanzamt bestätigt auf Seite 2 und schickt das Formular zurück"
 *   letterButtonsHtml: string   // Vorschau/PDF des Anschreibens (Postweg)
 * }} options
 */
export function taxOfficeWaysHtml(profile, reclaimCase, { signText, confirmText, letterButtonsHtml }) {
  const office = normalizeTaxOffice(profile.residence.taxOffice);
  const way = taxOfficeWay(reclaimCase);
  const tile = (key, label) => `<button type="button" class="way-tile ${way === key ? "on" : ""}" data-way="${key}" aria-pressed="${way === key}">${label}</button>`;
  const path = (...parts) => `<span class="ui-path">${parts.map((p) => `<b>${esc(p)}</b>`).join("<span>›</span>")}</span>`;
  return `
    <div class="card" data-ways>
      <div class="card-head">
        <span class="card-title">So kommt es zu deinem Finanzamt</span>
        <span class="ch-head-sub">${esc(office.name || "")}</span>
      </div>
      <div class="card-body">
        <div class="way-tiles">${tile("elster", "Digital per ELSTER")}${tile("post", "Per Post")}</div>

        <div class="way ${way === "elster" ? "on" : ""}" data-way-pane="elster">
          <ol class="flow-steps">
            <li><div>Bei ${path("Mein ELSTER")} anmelden.</div></li>
            <li><div>${path("Formulare & Leistungen", "Alle Formulare")}</div></li>
            <li><div>${path("Anträge und Nachrichten", "Sonstige Nachricht an das Finanzamt")}</div></li>
            <li><div>Nachrichtentext einfügen. <button class="btn-secondary btn-small" data-action="copy-elster" type="button">⧉ Text kopieren</button></div></li>
            <li><div>Anhang hochladen: das Formular als PDF, noch ohne Unterschrift.</div></li>
            <li><div>Absenden.</div></li>
          </ol>
          <p class="flow-after">Das Finanzamt bestätigt und schickt das Original per Post zurück. Unterschreiben kommt danach, beim Einreichen.</p>
        </div>

        <div class="way ${way === "post" ? "on" : ""}" data-way-pane="post">
          <ol class="flow-steps">
            <li><div>${esc(signText)}.</div></li>
            <li><div>Mit dem Anschreiben an dein Finanzamt schicken. <span class="way-letter">${letterButtonsHtml}</span></div></li>
          </ol>
          <p class="flow-after">${esc(confirmText)}.</p>
        </div>
      </div>
    </div>`;
}

/**
 * @param {() => string} getMessageText
 * @param {object} [reclaimCase] merkt sich den gewählten Weg (für signNowHtml)
 */
export function bindTaxOfficeWays(container, getMessageText, reclaimCase) {
  const root = container.querySelector("[data-ways]");
  if (!root) return;
  root.querySelectorAll("[data-way]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      root.querySelectorAll("[data-way]").forEach((b) => {
        b.classList.toggle("on", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      root.querySelectorAll("[data-way-pane]").forEach((p) => p.classList.toggle("on", p.dataset.wayPane === btn.dataset.way));
      if (reclaimCase && reclaimCase.taxOfficeWay !== btn.dataset.way) {
        reclaimCase.taxOfficeWay = btn.dataset.way;
        await saveCaseQuietly(reclaimCase);
      }
    })
  );
  root.querySelector('[data-action="copy-elster"]').addEventListener("click", () => {
    navigator.clipboard?.writeText(getMessageText()).catch(() => {});
    showToast("✓ Nachrichtentext kopiert");
  });
}

/** Speichert den Antrag und aktualisiert den Store, ohne neu zu zeichnen */
async function saveCaseQuietly(reclaimCase) {
  await caseRepo.put(reclaimCase);
  const state = getState();
  setState({
    cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
    currentCase: state.currentCase?.caseId === reclaimCase.caseId ? reclaimCase : state.currentCase,
  });
}

/**
 * Hinweis beim Einreichen, wenn das Formular per ELSTER beim Finanzamt war:
 * erst jetzt das bestätigte Original unterschreiben.
 * @param {string} what z.B. "das Formular auf Seite 1 (Feld „Sökandens signatur“)"
 */
export function signNowHtml(reclaimCase, what) {
  // Nur bei gespeichertem ELSTER-Weg: ältere Anträge (vor Stand 2.1) haben
  // keinen Weg gespeichert und wurden schon vorher unterschrieben.
  if (reclaimCase?.taxOfficeWay !== "elster") return "";
  return `
    <div class="sign-now">
      <span class="sign-now-icon">✍</span>
      <div><b>Zuerst unterschreiben:</b> ${esc(what)}, im bestätigten Original vom Finanzamt.</div>
    </div>`;
}

/**
 * Die eine Pause-Komponente (Stand 2.1): Symbol, ein fetter Satz, ein grauer
 * Satz, rechts die Knöpfe. Gleich in allen Ländern und Pausen.
 * @param {{ icon?: string, title: string, text?: string, actionsHtml?: string }} options
 */
export function pauseHtml({ icon = "❚❚", title, text = "", actionsHtml = "" }) {
  return `
    <div class="pause">
      <span class="pause-icon">${icon}</span>
      <div class="pause-text"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ""}</div>
      ${actionsHtml ? `<div class="pause-actions">${actionsHtml}</div>` : ""}
    </div>`;
}

/**
 * Pause nach "Ans Finanzamt schicken": erst "Ist abgeschickt" (merkt sich das
 * Datum für die Wartezeit auf der Startseite), dann "Bestätigung ist da".
 * Enthält immer [data-step-next] (der Schritt bindet daran das Weiter).
 */
export function taxOfficePauseHtml(reclaimCase, readyLabel = "Bestätigung ist da") {
  const sentAt = reclaimCase.taxOfficeSentAt;
  const save = `<button class="btn-secondary btn-small" data-action="save-state" type="button">💾 Sicherung</button>`;
  if (!sentAt) {
    return pauseHtml({
      title: "Abgeschickt? Dann ist hier Pause, meist 2–3 Wochen.",
      text: "Wir merken uns das Datum und zeigen dir auf der Übersicht, wie lange es schon dauert.",
      actionsHtml: `<button class="btn-secondary btn-small" data-step-next type="button">${esc(readyLabel)} →</button><button class="btn-primary btn-small" data-action="mark-sent" type="button">✓ Ist abgeschickt</button>`,
    });
  }
  return pauseHtml({
    title: `Abgeschickt am ${new Date(sentAt).toLocaleDateString("de-DE")} · jetzt ist Pause, meist 2–3 Wochen.`,
    text: "Wenn die Bestätigung zurück ist, geht es mit dem Einreichen weiter.",
    actionsHtml: `${save}<button class="btn-primary btn-small" data-step-next type="button">${esc(readyLabel)} →</button>`,
  });
}

/** @param {() => void} rerender */
export function bindTaxOfficePause(container, reclaimCase, rerender) {
  container.querySelector('[data-action="mark-sent"]')?.addEventListener("click", async () => {
    reclaimCase.taxOfficeSentAt = new Date().toISOString();
    // Der angezeigte Weg gilt als gewählt, auch ohne Klick auf die Kachel
    reclaimCase.taxOfficeWay = taxOfficeWay(reclaimCase);
    await saveCaseQuietly(reclaimCase);
    showToast("✓ Datum gespeichert");
    rerender();
  });
}

/** Älterer Hinweis "Hier ist Pause" - jetzt in der einheitlichen Pause-Komponente */
export function waitHtml(text, nextLabel) {
  return pauseHtml({
    title: "Hier ist Pause.",
    text,
    actionsHtml: `<button class="btn-secondary btn-small" data-action="save-state" type="button">💾 Sicherung</button><button class="btn-primary btn-small" data-step-next type="button">${esc(nextLabel)} →</button>`,
  });
}
