// Italien, Schritt 3 "Fehlende Angaben" (docs/konzept-italien.md §3, §4):
// - Pflichtangaben für Form A, die im Profil noch fehlen (direkt bearbeitbar,
//   automatisch gespeichert - wie Dänemark)
// - optional: Adresse der Bank, E-Mail und Angaben zu den Unternehmen
//   (Sitz, Codice fiscale). Optionales blockiert "Weiter" nie; Angaben zu
//   Unternehmen landen im Profil (profile.issuers), damit sie beim nächsten
//   Mal schon da sind.

import { getState, setState } from "../../store/store.js";
import * as profileRepo from "../../db/profileRepo.js";
import { PROFILE_FIELDS } from "../../util/profileFields.js";
import { hasInvalidInput } from "../../util/autosave.js";
import {
  PROFILE_ITEM, profileRow, optionalProfileRow, checklistRow, isItemFilled, bindChecklistAutosave, AUTOSAVE_ROW,
} from "../../components/checklist.js";
import { showToast } from "../../components/toast.js";
import { groupByIssuer, issuerDetails, isEligible } from "../../lib/italy.js";
import { REQUIRED_ITEMS } from "./step1Checklist.js";
import { esc, stepHeader, stepNavHtml, bindStepNav, goToStep } from "./itShared.js";

function issuerRow(group, profile) {
  const details = issuerDetails(group.isin, group.issuerName, profile);
  const own = profile.issuers?.[group.isin] ?? {};
  const name = esc(details.name || group.isin);
  if (details.source === "list") {
    return checklistRow("ok", details.name || group.isin, `<span class="ch-check-text">${esc(details.address)}<br><span class="mono">C.F. ${esc(details.taxCode)}</span></span>`, `<span class="badge badge-confirmed">aus DivRebound-Liste</span>`);
  }
  return checklistRow(
    details.source === "user" ? "ok" : "later",
    details.name || group.isin,
    `<span class="ch-check-text">${details.source === "user" ? "Ihre Angaben werden ins Formular übernommen." : "Nicht in der DivRebound-Liste. Ins Formular kommt nur der Name – das reicht aus."}</span>
     <details class="it-optional" ${details.source === "user" ? "open" : ""}>
       <summary>Sitz und Steuernummer ergänzen (optional)</summary>
       <div class="ch-inline-fields">
         <input class="field-input ch-inline wide" data-issuer="${esc(group.isin)}" data-issuer-field="address" placeholder="Sitz, z.B. Via Borgonuovo 20, 20121 Milano" value="${esc(own.address ?? "")}" aria-label="Sitz von ${name}">
         <input class="field-input ch-inline mono" data-issuer="${esc(group.isin)}" data-issuer-field="taxCode" placeholder="Codice fiscale (11 Ziffern)" value="${esc(own.taxCode ?? "")}" aria-label="Codice fiscale von ${name}">
       </div>
       <div class="field-hint">Zu finden im Impressum bzw. auf der Investor-Relations-Seite des Unternehmens („C.F.“ oder „P.IVA“).</div>
     </details>`,
    `<span class="badge badge-extracted">${details.source === "user" ? "eigene Angaben" : "nur Name"}</span>`
  );
}

function render(container, reclaimCase, profile) {
  const missing = REQUIRED_ITEMS.filter((k) => !isItemFilled(profile, PROFILE_ITEM[k]));
  const groups = groupByIssuer(reclaimCase.distributions.filter((d) => isEligible(d)));

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 3)}
    <p class="ch-lead">Hier steht nur noch, was nach dem Einlesen Ihrer Dividendenabrechnungen offen ist. Alles, was Sie hier eintragen, wird in Ihren persönlichen Daten gespeichert – beim nächsten Mal ist es schon da.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Bitte noch ergänzen</span><span class="count-pill">${missing.length ? `${missing.length} offen` : "nichts offen"}</span></div>
      ${
        missing.length
          ? missing.map((k) => profileRow(profile, PROFILE_ITEM[k])).join("") + AUTOSAVE_ROW
          : `<div class="card-body"><div class="md-all-done">✓ Alle Pflichtangaben für Form A sind vollständig. Sie stammen aus Ihren persönlichen Daten – <a href="#" data-go-checklist>ansehen oder ändern</a>.</div></div>`
      }
    </div>

    <div class="card">
      <div class="card-head"><span class="card-title">Optional</span><span class="ch-head-sub">blockiert nicht – Weiter geht auch ohne</span></div>
      ${optionalProfileRow(profile, PROFILE_ITEM.bankAddress)}
      ${optionalProfileRow(profile, PROFILE_ITEM.email)}
      ${groups.length ? `<div class="ch-check-group">Angaben zu den Unternehmen (Form A Seite 4, „Italian dividend payer“)</div>${groups.map((g) => issuerRow(g, profile)).join("")}` : ""}
    </div>

    ${stepNavHtml(3)}
    </div>`;

  container.querySelector("[data-go-checklist]")?.addEventListener("click", (e) => {
    e.preventDefault();
    goToStep(reclaimCase, 1);
  });
  container.querySelectorAll("[data-issuer]").forEach((input) =>
    input.addEventListener("change", async () => {
      const current = getState().currentProfile;
      const isin = input.dataset.issuer;
      current.issuers = { ...(current.issuers ?? {}), [isin]: { ...(current.issuers?.[isin] ?? {}), [input.dataset.issuerField]: input.value.trim() } };
      await profileRepo.put(current);
      setState({ currentProfile: current });
      showToast(`✓ ${input.dataset.issuerField === "taxCode" ? "Codice fiscale" : "Sitz"} gespeichert`);
    })
  );
  bindStepNav(container, reclaimCase, 3);
  updateNext(container);
}

/** "Weiter" erst, wenn alle Pflichtangaben vorhanden und gültig sind */
function updateNext(container) {
  const profile = getState().currentProfile;
  const complete = REQUIRED_ITEMS.every((k) => isItemFilled(profile, PROFILE_ITEM[k]));
  const valid = ["tin", "taxNumber", "iban"].every((k) => PROFILE_FIELDS[k].validate(PROFILE_FIELDS[k].read(profile), profile) === true);
  container.querySelector("[data-step-next]").disabled = !(complete && valid) || hasInvalidInput();
}

export function mount(container, reclaimCase, profile) {
  render(container, reclaimCase, profile);
  return bindChecklistAutosave(container, () => updateNext(container));
}
