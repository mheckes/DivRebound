// Schweden, Schritt 3 "Fehlende Angaben": nur die Pflichtangaben für SKV 3740,
// die im Profil noch fehlen (direkt bearbeitbar, automatisch gespeichert - wie
// Italien), dazu optional Adresse der Bank und Kontaktdaten. Angaben zu den
// Unternehmen braucht das schwedische Formular nicht (nur der Name aus der
// Abrechnung).

import { getState } from "../../store/store.js";
import { PROFILE_FIELDS } from "../../util/profileFields.js";
import { hasInvalidInput } from "../../util/autosave.js";
import {
  PROFILE_ITEM, profileRow, optionalProfileRow, isItemFilled, profileCardsHtml, bindChecklistAutosave, AUTOSAVE_ROW,
} from "../../components/checklist.js";
import { REQUIRED_ITEMS } from "./step1Checklist.js";
import { stepHeader, stepNavHtml, bindStepNav, goToStep } from "./seShared.js";

function render(container, reclaimCase, profile) {

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 3)}
    <p class="ch-lead">Diese Angaben kommen ins Formular.</p>

    ${profileCardsHtml(profile, REQUIRED_ITEMS)}

    <div class="card">
      <div class="card-head"><span class="card-title">Optional</span><span class="ch-head-sub">blockiert nicht – Weiter geht auch ohne</span></div>
      ${optionalProfileRow(profile, PROFILE_ITEM.bankAddress)}
      ${optionalProfileRow(profile, PROFILE_ITEM.contact)}
    </div>

    ${stepNavHtml(3)}
    </div>`;

  container.querySelector("[data-go-checklist]")?.addEventListener("click", (e) => {
    e.preventDefault();
    goToStep(reclaimCase, 1);
  });
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
