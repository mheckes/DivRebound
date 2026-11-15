// Bausteine des Ablaufs, gleich für alle Länder
// (Mock Up Ablauf 11-2026/divrebound_ablauf_mockup.html):
//  - phasesHtml(): die vier Boxen "Vorbereiten -> Bestätigen lassen ->
//    Einreichen -> Geld erhalten" (Startseite und Überblick eines Antrags)
//  - flagHtml(): Landesflagge in CSS (Windows zeigt Flaggen-Emoji nicht)
//  - taxOfficeWaysHtml(): "So kommt es zu deinem Finanzamt" mit den beiden
//    Wegen ELSTER und Post

import { corridors } from "../config/corridors.js";
import { PHASES } from "../config/caseSteps.js";
import { normalizeTaxOffice } from "../util/taxOffice.js";
import { showToast } from "./toast.js";

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

/** Text für die ELSTER-Nachricht an das Finanzamt */
export function elsterMessageText(profile, { reference, originalRequired = false }) {
  const r = profile.residence;
  const lines = [
    "Sehr geehrte Damen und Herren,",
    "",
    `ich bitte um Bestätigung meiner steuerlichen Ansässigkeit in Deutschland auf dem beigefügten Dokument: ${reference}.`,
    "",
    originalRequired
      ? "Bitte senden Sie mir das bestätigte Dokument (Stempel und Unterschrift) im Original per Post zurück. Die ausländische Steuerbehörde verlangt das Original."
      : "Bitte senden Sie mir das bestätigte Dokument (Stempel und Unterschrift) zurück.",
    "",
    r.tin ? `Steuer-ID: ${r.tin}` : "",
    r.taxNumber ? `Steuernummer: ${r.taxNumber}` : "",
    "",
    "Vielen Dank und freundliche Grüße",
    [r.firstName, r.lastName].filter(Boolean).join(" "),
  ];
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n");
}

/**
 * Karte "So kommt es zu deinem Finanzamt" mit Umschalter ELSTER / Post.
 * @param {object} profile
 * @param {{
 *   doc: string,             // "die Bescheinigung" | "den Antrag" | "die Formulare"
 *   signText: string,        // z.B. "Bescheinigung ausdrucken und unterschreiben"
 *   confirmText: string,     // z.B. "Das Finanzamt stempelt und schickt die Bescheinigung zurück"
 *   originalRequired?: boolean, // ausländische Behörde verlangt das Original -> Post ist der sichere Weg
 *   letterButtonsHtml: string   // Vorschau/PDF des Anschreibens (Postweg)
 * }} options
 */
export function taxOfficeWaysHtml(profile, { doc, signText, confirmText, originalRequired = false, letterButtonsHtml }) {
  const office = normalizeTaxOffice(profile.residence.taxOffice);
  const first = originalRequired ? "post" : "elster";
  const btn = (way, label) => `<button type="button" data-way="${way}" class="${way === first ? "on" : ""}">${label}</button>`;
  return `
    <div class="card" data-ways>
      <div class="card-head">
        <span class="card-title">So kommt es zu deinem Finanzamt</span>
        <span class="ch-head-sub">${esc(office.name || "")}</span>
        <span class="way-toggle">${originalRequired ? btn("post", "Per Post") + btn("elster", "Digital per ELSTER") : btn("elster", "Digital per ELSTER") + btn("post", "Per Post")}</span>
      </div>
      <div class="card-body way ${first === "elster" ? "on" : ""}" data-way-pane="elster">
        ${originalRequired ? `<div class="way-warning">Die ausländische Steuerbehörde verlangt das Original mit Stempel und Unterschriften. Per ELSTER klappt das nur, wenn dein Finanzamt den Ausdruck stempelt und per Post zurückschickt. Der sichere Weg ist die Post.</div>` : ""}
        <div class="ch-next"><span class="ch-next-num">1</span><span>${esc(signText)} und als PDF einscannen.</span></div>
        <div class="ch-next"><span class="ch-next-num">2</span><span>In ELSTER unter <b>Formulare und Leistungen → Alle Formulare → Anträge und Nachrichten</b> das Formular <b>„Sonstige Nachricht an das Finanzamt“</b> öffnen.</span></div>
        <div class="ch-next"><span class="ch-next-num">3</span><span>Nachrichtentext einfügen, den Scan anhängen und absenden. <button class="btn-secondary btn-small" data-action="copy-elster" type="button">⧉ Nachrichtentext kopieren</button></span></div>
        <div class="ch-next"><span class="ch-next-num">4</span><span>${esc(confirmText)}, meist nach 2–3 Wochen${originalRequired ? "" : ". Die Antwort kommt per Post oder ins ELSTER-Postfach"}.</span></div>
        <div class="field-hint" style="margin-top:10px;">Du brauchst ein ELSTER-Konto. Ein Anschreiben ist nicht nötig, der Text steht in der Nachricht.</div>
      </div>
      <div class="card-body way ${first === "post" ? "on" : ""}" data-way-pane="post">
        <div class="ch-next"><span class="ch-next-num">1</span><span>${esc(signText)}. Das Anschreiben dazu ausdrucken. <span class="way-letter">${letterButtonsHtml}</span></span></div>
        <div class="ch-next"><span class="ch-next-num">2</span><span>Beides per Post an dein Finanzamt schicken.</span></div>
        <div class="ch-next"><span class="ch-next-num">3</span><span>${esc(confirmText)}, meist nach 2–3 Wochen.</span></div>
      </div>
    </div>`;
}

/** @param {() => string} getMessageText */
export function bindTaxOfficeWays(container, getMessageText) {
  const root = container.querySelector("[data-ways]");
  if (!root) return;
  root.querySelectorAll("[data-way]").forEach((btn) =>
    btn.addEventListener("click", () => {
      root.querySelectorAll("[data-way]").forEach((b) => b.classList.toggle("on", b === btn));
      root.querySelectorAll("[data-way-pane]").forEach((p) => p.classList.toggle("on", p.dataset.wayPane === btn.dataset.way));
    })
  );
  root.querySelector('[data-action="copy-elster"]').addEventListener("click", () => {
    navigator.clipboard?.writeText(getMessageText()).catch(() => {});
    showToast("✓ Nachrichtentext kopiert");
  });
}

/** Hinweis "Hier ist Pause" mit dem Knopf für den Wiedereinstieg (ersetzt "Weiter") */
export function waitHtml(text, nextLabel) {
  return `
    <div class="wait-box">
      <span><b>Hier ist Pause.</b> ${esc(text)}</span>
      <span class="wait-actions">
        <button class="btn-secondary btn-small" data-action="save-state" type="button">💾 Sicherung speichern</button>
        <button class="btn-primary btn-small" data-step-next type="button">${esc(nextLabel)} →</button>
      </span>
    </div>`;
}
