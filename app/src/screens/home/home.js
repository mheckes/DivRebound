// Startseite (#/home), Stand 2.1 (Mock Up Ablauf 11-2026/divrebound_ux_v2_mockup.html):
//  - erster Besuch: die vier Phasen als Gesamtbild, darunter "Neuen Antrag
//    starten" mit einer Kachel je Land (legt Profil und Antrag direkt an,
//    util/startCase.js)
//  - mit Anträgen: "+ Neuer Antrag" oben rechts öffnet die Länderwahl als
//    Dialog; die Karten stehen in Gruppen (Du bist dran / Wartet auf Antwort /
//    Abgeschlossen, letzteres eingeklappt). Jede Karte ist klickbar, hat
//    rechts einen Knopf und den Papierkorb, darunter die Schrittleiste.
//    Wartende Anträge zeigen die Wartezeit (seit dem Abschicken ans
//    Finanzamt bzw. dem Einreichen) und genau eine Aktion; nach mehr als vier
//    Wochen beim Finanzamt wird die Karte gelb und bietet eine Nachfrage an.
//  - darunter eine Statistikzeile und der Hinweis zur Sicherung
//  - immer: der Beta-Hinweis unter dem Inhalt

import { getState, setState, subscribe } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { corridors } from "../../config/corridors.js";
import { PHASES } from "../../config/caseSteps.js";
import { formatNumberDe, formatDateDe } from "../../util/format.js";
import { nextStep, stepRoute, stepsFor, casePhase } from "../../util/caseNav.js";
import { isSubmitted, submittedAt, refundReceived, parseAmount, monthsBetween } from "../../util/caseProgress.js";
import { caseName, COUNTRY_NAMES } from "../../util/caseName.js";
import { startCase } from "../../util/startCase.js";
import { isEligible, totalRefund } from "../../lib/withholding.js";
import { phasesHtml, flagHtml, refundPercent, payoutTime, TRASH_ICON } from "../../components/flow.js";
import { openConfirmModal } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";

const COUNTRIES = ["DK", "CH", "IT", "SE"];

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Erwartete Erstattung aus den ausgewählten Ausschüttungen (DK in DKK, IT in EUR, SE in SEK); Schweiz: 0 */
function expectedRefund(reclaimCase, residenceCountry) {
  if (reclaimCase.targetCountry === "CH") return 0;
  const corridor = corridors[reclaimCase.targetCountry];
  const eligible = reclaimCase.distributions.filter((d) => isEligible(d, corridor, { residenceCountry }));
  return totalRefund(eligible, corridor, residenceCountry);
}

/**
 * Statistik über alle Anträge: erhaltene Erstattungen, durchschnittliche
 * Wartezeit ab Einreichung und ausstehende Beträge je Währung.
 */
function statistics(cases, residenceCountry) {
  let receivedEur = 0;
  let receivedCount = 0;
  const waits = [];
  const open = {};
  for (const c of cases) {
    const r = refundReceived(c);
    if (!r.received) {
      const cur = corridors[c.targetCountry].nativeCurrency;
      open[cur] = (open[cur] ?? 0) + expectedRefund(c, residenceCountry);
      continue;
    }
    const amount = parseAmount(r.amountEur);
    if (amount !== null) {
      receivedEur += amount;
      receivedCount += 1;
    }
    const months = monthsBetween(submittedAt(c)?.slice(0, 10), r.date);
    if (months !== null) waits.push(months);
  }
  const avgWait = waits.length ? Math.round(waits.reduce((s, m) => s + m, 0) / waits.length) : null;
  return { receivedEur, receivedCount, avgWait, open: Object.entries(open).filter(([, v]) => v > 0) };
}

/** Euro-Betrag aus einer Eingabe ("40.80", "40,8") immer deutsch: "40,80" */
function eurDe(value) {
  const n = parseAmount(value);
  return n === null ? String(value ?? "") : formatNumberDe(n);
}

// Die vier Schritte eines Antrags, beschriftet. "Geld erhalten" ist der
// aktuelle Schritt, solange nach dem Einreichen auf die Auszahlung gewartet wird.
const STEP_LABELS = [PHASES.prepare.title, PHASES.confirm.title, PHASES.submit.title, "Geld erhalten"];
const PHASE_INDEX = { prepare: 0, confirm: 1, submit: 2, submitted: 3, received: 4 };

function stepperHtml(phase) {
  const at = PHASE_INDEX[phase] ?? 0;
  return `
    <ol class="case-steps" aria-label="Fortschritt">
      ${STEP_LABELS.map((label, i) => {
        const cls = i < at ? "done" : i === at ? "now" : "";
        const mark = i < at ? "✓" : i === 3 ? "€" : i + 1;
        return `<li class="${cls}"${i === at ? ' aria-current="step"' : ""}><span class="case-step-mark">${mark}</span>${esc(label)}</li>`;
      }).join("")}
    </ol>`;
}

/** "todo": du bist dran · "wait": Finanzamt oder Behörde ist dran · "done": Geld da */
function caseGroup(phase) {
  if (phase === "received") return "done";
  if (phase === "confirm" || phase === "submitted") return "wait";
  return "todo";
}

const DAY = 86_400_000;
/** Ab so vielen Tagen beim Finanzamt gilt es als "länger als üblich" */
const TAX_OFFICE_LATE_DAYS = 28;

/** Dauer im Dativ für "seit …"/"vor …": "1 Tag", "12 Tagen", "3 Wochen", "2 Monaten" */
function durationDe(days) {
  if (days < 14) return days === 1 ? "1 Tag" : `${days} Tagen`;
  if (days < 60) return `${Math.round(days / 7)} Wochen`;
  const months = Math.round(days / 30.44);
  return months === 1 ? "1 Monat" : `${months} Monaten`;
}
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY));


/**
 * Karte eines Antrags (Stand 2.1): oben Name und Betrag, rechts ein Knopf und
 * der Papierkorb, darunter die Schrittleiste. Wartende Anträge zeigen statt
 * einer Ja/Nein-Frage, wie lange es schon dauert, und genau eine Aktion.
 * Die ganze Karte ist klickbar (data-open).
 */
function caseCardHtml(reclaimCase, residence) {
  const phase = casePhase(reclaimCase);
  const step = nextStep(reclaimCase);
  const steps = stepsFor(reclaimCase);
  const refundStep = steps[steps.length - 1];
  const currency = corridors[reclaimCase.targetCountry].nativeCurrency;
  const expected = expectedRefund(reclaimCase, residence);
  const submitted = submittedAt(reclaimCase);

  let meta;
  let route;
  let button = "";
  let wait = "";
  let late = false;
  if (phase === "received") {
    const r = refundReceived(reclaimCase);
    meta = `${r.amountEur ? `<b>${esc(eurDe(r.amountEur))} EUR</b> erhalten` : "Erstattet"}${r.date ? ` am ${formatDateDe(r.date)}` : ""}`;
    route = stepRoute(reclaimCase, refundStep.n);
    button = `<button class="btn-secondary btn-small" type="button" tabindex="-1">Ansehen</button>`;
  } else if (phase === "submitted") {
    meta = expected ? `<b>${formatNumberDe(expected)} ${currency}</b> erwartet` : submitted ? `eingereicht am ${formatDateDe(submitted.slice(0, 10))}` : "eingereicht";
    route = stepRoute(reclaimCase, refundStep.n);
    const since = submitted ? `Eingereicht vor ${durationDe(daysSince(submitted))}` : "Eingereicht";
    wait = `<span class="wait-info"><b>${since}</b> · meist ${esc(payoutTime(reclaimCase.targetCountry))}</span>`;
    // Gleiche Stelle wie "Weiter"/"Starten": oben rechts neben dem Papierkorb
    button = `<button class="btn-accent btn-small" data-nav="${route}" type="button">Geld ist da →</button>`;
  } else if (phase === "confirm") {
    meta = expected ? `<b>${formatNumberDe(expected)} ${currency}</b> erwartet` : `angelegt am ${formatDateDe(reclaimCase.createdAt.slice(0, 10))}`;
    route = stepRoute(reclaimCase, step.n);
    const sentAt = reclaimCase.taxOfficeSentAt;
    const days = sentAt ? daysSince(sentAt) : null;
    late = days !== null && days > TAX_OFFICE_LATE_DAYS;
    const since = sentAt ? (days === 0 ? "Heute ans Finanzamt geschickt" : `Beim Finanzamt seit ${durationDe(days)}`) : "Wartet auf dein Finanzamt";
    wait = `<span class="wait-info"><b>${since}</b> · ${late ? `länger als üblich. <a href="#" data-follow-up="${reclaimCase.caseId}">Beim Finanzamt nachfragen</a>` : "meist 2–3 Wochen"}</span>`;
    button = `<button class="btn-accent btn-small" data-confirmed="${reclaimCase.caseId}" type="button">Ist bestätigt →</button>`;
  } else {
    meta = expected ? `<b>${formatNumberDe(expected)} ${currency}</b> erwartet` : `angelegt am ${formatDateDe(reclaimCase.createdAt.slice(0, 10))}`;
    route = stepRoute(reclaimCase, step.n);
    button = `<button class="btn-primary btn-small" type="button" tabindex="-1">${step.intro ? "Starten" : "Weiter"} →</button>`;
  }

  return `
    <div class="case-card ${wait ? "attn" : ""} ${late ? "late" : ""} ${phase === "received" ? "is-done" : ""}" data-open="${route}" role="link" tabindex="0" aria-label="${esc(caseName(reclaimCase))} öffnen">
      <div class="case-top">
        <span class="case-name">${flagHtml(reclaimCase.targetCountry)}${esc(caseName(reclaimCase))}</span>
        <span class="case-meta">${meta}</span>
      </div>
      <div class="case-tools">
        ${button}
        <button class="btn-trash" data-delete="${reclaimCase.caseId}" title="Antrag löschen" aria-label="Antrag löschen" type="button">${TRASH_ICON}</button>
      </div>
      ${phase === "received" ? "" : stepperHtml(phase)}
      ${wait ? `<div class="case-wait">${wait}</div>` : ""}
    </div>`;
}

/** Fertiger Text für eine Nachfrage beim Finanzamt, wenn die Bestätigung lange dauert */
function followUpText(reclaimCase, profile) {
  const r = profile?.residence ?? {};
  const sent = reclaimCase.taxOfficeSentAt ? new Date(reclaimCase.taxOfficeSentAt).toLocaleDateString("de-DE") : "";
  const way = (reclaimCase.taxOfficeWay ?? "elster") === "elster" ? "per ELSTER" : "per Post";
  return [
    "Sehr geehrte Damen und Herren,",
    "",
    `am ${sent} habe ich Ihnen ${way} ein Formular zur Bestätigung meiner steuerlichen Ansässigkeit in Deutschland geschickt (Erstattung ${COUNTRY_GENITIVE[reclaimCase.targetCountry]} Quellensteuer). Darf ich nachfragen, wie der Stand ist?`,
    "",
    r.tin ? `Steuer-ID: ${r.tin}` : "",
    r.taxNumber ? `Steuernummer: ${r.taxNumber}` : "",
    "",
    "Vielen Dank und freundliche Grüße",
    [r.firstName, r.lastName].filter(Boolean).join(" "),
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");
}
const COUNTRY_GENITIVE = { DK: "dänischer", CH: "schweizerischer", IT: "italienischer", SE: "schwedischer" };

function openFollowUpModal(reclaimCase, profile) {
  const text = followUpText(reclaimCase, profile);
  const overlay = document.createElement("div");
  overlay.className = "dr-modal-overlay";
  overlay.innerHTML = `
    <div class="dr-modal">
      <h2 class="dr-modal-title">Beim Finanzamt nachfragen</h2>
      <p class="dr-modal-hint">Per ELSTER als „Sonstige Nachricht an das Finanzamt“ oder als Brief.</p>
      <textarea class="follow-up-text" readonly rows="10">${esc(text)}</textarea>
      <div class="dr-modal-actions">
        <button class="btn-secondary" data-close type="button">Schließen</button>
        <button class="btn-primary" data-copy type="button">⧉ Text kopieren</button>
      </div>
    </div>`;
  document.getElementById("divrebound-app").appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => e.target === overlay && close());
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.querySelector("[data-copy]").addEventListener("click", () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    showToast("✓ Text kopiert");
  });
}

/** Länderwahl für "+ Neuer Antrag" als Dialog */
function openCountryPicker(cases) {
  const overlay = document.createElement("div");
  overlay.className = "dr-modal-overlay";
  overlay.innerHTML = `
    <div class="dr-modal dr-modal-wide">
      <div class="picker-head">
        <h2 class="dr-modal-title">Für welches Land?</h2>
        <button class="picker-close" data-close type="button" aria-label="Schließen">×</button>
      </div>
      ${countryTilesHtml(cases)}
    </div>`;
  document.getElementById("divrebound-app").appendChild(overlay);
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", (e) => e.target === overlay && close());
  overlay.querySelector("[data-close]").addEventListener("click", close);
  bindCountryTiles(overlay, cases, close);
  overlay.querySelector(".home-country")?.focus();
}

// Zustand, der ein Neuzeichnen (z.B. nach dem Löschen) überstehen soll
const ui = { doneOpen: false, allCountries: false };

/** Ab so vielen Ländern zeigt die Auswahl zuerst nur COUNTRY_PREVIEW davon */
const COUNTRY_COLLAPSE_AT = 9;
const COUNTRY_PREVIEW = 6;

/** Länder mit eigenen Anträgen zuerst, danach nach Erstattung in Prozent */
function orderedCountries(cases) {
  const used = new Set(cases.map((c) => c.targetCountry));
  return [...COUNTRIES].sort((a, b) => Number(used.has(b)) - Number(used.has(a)) || refundPercent(b) - refundPercent(a));
}

function countryTilesHtml(cases) {
  const all = orderedCountries(cases);
  const collapse = all.length >= COUNTRY_COLLAPSE_AT && !ui.allCountries;
  const shown = collapse ? all.slice(0, COUNTRY_PREVIEW) : all;
  return `
    <div class="country-pick">
      <div class="home-countries">
        ${shown.map((c) => `<button class="home-country" data-start="${c}" type="button"><b>${flagHtml(c)}${COUNTRY_NAMES[c]}</b><span>${refundPercent(c)} % deiner Dividende zurück</span></button>`).join("")}
      </div>
      ${collapse ? `<button class="btn-link" data-all-countries type="button">Alle ${all.length} Länder anzeigen</button>` : ""}
    </div>`;
}

/** Klick auf ein Land legt den Antrag an; "Alle Länder" zeichnet die Kacheln neu */
function bindCountryTiles(root, cases, onStart = () => {}) {
  const pick = root.querySelector(".country-pick");
  pick.querySelectorAll("[data-start]").forEach((el) =>
    el.addEventListener("click", () => {
      onStart();
      startCase(el.dataset.start);
    })
  );
  pick.querySelector("[data-all-countries]")?.addEventListener("click", () => {
    ui.allCountries = true;
    pick.outerHTML = countryTilesHtml(cases);
    bindCountryTiles(root, cases, onStart);
  });
}

const GROUPS = [
  { key: "todo", title: "Du bist dran" },
  { key: "wait", title: "Wartet auf Antwort" },
  { key: "done", title: "Abgeschlossen", collapsible: true },
];

function caseListHtml(cases, residence) {
  const byGroup = { todo: [], wait: [], done: [] };
  for (const c of cases) byGroup[caseGroup(casePhase(c))].push(c);
  // Abgeschlossene nach Auszahlungsdatum, neueste zuerst
  byGroup.done.sort((a, b) => (refundReceived(b).date ?? "").localeCompare(refundReceived(a).date ?? ""));
  return GROUPS.filter((g) => byGroup[g.key].length)
    .map((g) => {
      const cards = byGroup[g.key].map((c) => caseCardHtml(c, residence)).join("");
      if (g.collapsible) {
        return `
          <details class="home-group-fold" data-done-fold ${ui.doneOpen ? "open" : ""}>
            <summary class="home-group">${g.title} <span class="home-group-count">${byGroup[g.key].length}</span></summary>
            ${cards}
          </details>`;
      }
      return `<div class="home-group">${g.title} <span class="home-group-count">${byGroup[g.key].length}</span></div>${cards}`;
    })
    .join("");
}

function render(container) {
  const state = getState();
  const profile = state.currentProfile;
  const residence = profile?.residence?.country;
  const cases = [...state.cases].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  const stats = statistics(cases, residence);
  const submittedCount = cases.filter((c) => isSubmitted(c) || refundReceived(c).received).length;
  const firstName = profile?.residence?.firstName;

  const beta = `
    <section class="beta-card" aria-labelledby="beta-title">
      <div class="beta-main">
        <span class="beta-badge">Beta-Test</span>
        <h2 class="beta-title" id="beta-title">Danke, dass du DivRebound testest</h2>
        <p>Sag uns, was hakt: ein Fehler, ein unklarer Text, eine fehlende Funktion.</p>
        <button type="button" class="btn-accent btn-small" data-feedback="home-beta">💬 Feedback geben</button>
      </div>
      <div class="beta-want">
        <div class="beta-want-label">Besonders gesucht</div>
        <b>Abrechnungen anderer Banken</b>
        <p>Bisher kennt DivRebound nur wenige Layouts. Ein kurzes „hat geklappt“ mit dem Namen deiner Bank hilft schon.</p>
      </div>
    </section>`;

  const statParts = [
    `<span><b>${cases.length}</b> ${cases.length === 1 ? "Antrag" : "Anträge"}, ${submittedCount} eingereicht</span>`,
    ...stats.open.map(([cur, v]) => `<span><b>${formatNumberDe(v)} ${cur}</b> ausstehend</span>`),
    stats.receivedCount ? `<span><b>${formatNumberDe(stats.receivedEur)} EUR</b> erhalten</span>` : "",
    stats.avgWait !== null ? `<span><b>${stats.avgWait} ${stats.avgWait === 1 ? "Monat" : "Monate"}</b> Ø bis zur Auszahlung</span>` : "",
  ].filter(Boolean);

  container.innerHTML = `
    <div class="home-page">
    <div class="content-header home-head">
      <div>
        <h1 class="content-title" data-feedback-skip>${cases.length ? `Willkommen zurück${firstName ? `, ${esc(firstName)}` : ""}` : "Hol dir deine Quellensteuer zurück"}</h1>
        <div class="content-breadcrumb">${cases.length ? "Übersicht" : "Für Privatanleger mit Wohnsitz in Deutschland"}</div>
      </div>
      ${cases.length ? `<button class="btn-primary home-new-btn" data-new-case type="button">+ Neuer Antrag</button>` : ""}
    </div>

    ${
      cases.length
        ? `${caseListHtml(cases, residence)}
           <div class="home-statline">${statParts.join("")}</div>
           <p class="home-backup">Deine Anträge liegen nur in diesem Browser. Sichere sie über „Sicherung speichern“ in der Seitenleiste.</p>`
        : `${phasesHtml()}
           <h2 class="home-section">Neuen Antrag starten</h2>
           ${countryTilesHtml(cases)}`
    }

    ${beta}
    </div>`;

  if (!cases.length) bindCountryTiles(container, cases);
  container.querySelector("[data-new-case]")?.addEventListener("click", () => openCountryPicker(cases));
  container.querySelectorAll("[data-nav]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      navigate(el.dataset.nav);
    })
  );
  // Die ganze Karte öffnet den Antrag; Knöpfe und Links darin haben eigene Aktionen
  container.querySelectorAll("[data-open]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-delete], [data-confirmed], [data-nav], [data-follow-up]")) return;
      navigate(card.dataset.open);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target === card) navigate(card.dataset.open);
    });
  });
  container.querySelectorAll("[data-follow-up]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openFollowUpModal(getState().cases.find((c) => c.caseId === a.dataset.followUp), getState().currentProfile);
    })
  );
  container.querySelector("[data-done-fold]")?.addEventListener("toggle", (e) => {
    ui.doneOpen = e.currentTarget.open;
  });

  // "Bestätigung ist da": Finanzamt-Schritt abhaken und zum Einreichen springen
  container.querySelectorAll("[data-confirmed]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const reclaimCase = getState().cases.find((c) => c.caseId === btn.dataset.confirmed);
      const step = nextStep(reclaimCase);
      const key = reclaimCase.targetCountry === "DK" ? null : reclaimCase.targetCountry.toLowerCase();
      if (key) reclaimCase[key].stepsDone = [...new Set([...(reclaimCase[key].stepsDone ?? []), step.n])].sort();
      else reclaimCase.dkStepsDone = [...new Set([...(reclaimCase.dkStepsDone ?? []), step.n])].sort();
      await caseRepo.put(reclaimCase);
      setState({ cases: getState().cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)) });
      navigate(stepRoute(reclaimCase, nextStep(reclaimCase).n));
    })
  );

  container.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const reclaimCase = getState().cases.find((c) => c.caseId === btn.dataset.delete);
      const confirmed = await openConfirmModal(
        "Antrag wirklich löschen?",
        `„${caseName(reclaimCase)}“ wird unwiderruflich gelöscht, inklusive aller erfassten Ausschüttungen. Bereits heruntergeladene Dokumente sind davon nicht betroffen.`,
        { confirmLabel: "Löschen", danger: true }
      );
      if (!confirmed) return;
      await caseRepo.remove(reclaimCase.caseId);
      const wasCurrent = getState().currentCase?.caseId === reclaimCase.caseId;
      setState({ cases: getState().cases.filter((c) => c.caseId !== reclaimCase.caseId), currentCase: wasCurrent ? null : getState().currentCase });
    })
  );
}

export function mount(container) {
  render(container);
  // z.B. nach dem Löschen eines Antrags oder dem Laden einer Sicherung
  return subscribe(() => render(container));
}
