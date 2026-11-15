// Neuen Antrag für ein Land anlegen und öffnen (Länderkacheln der Startseite).
// Ersetzt den früheren Dialog components/newCaseWizard.js: Privatvermögen und
// Wohnsitz Deutschland sind Voraussetzung und stehen als Satz auf der
// Startseite, gefragt wird nur noch das Land.

import { getState, setState } from "../store/store.js";
import { navigate } from "../router/router.js";
import * as profileRepo from "../db/profileRepo.js";
import * as caseRepo from "../db/caseRepo.js";
import { stepRoute } from "./caseNav.js";

/** @param {"DK"|"CH"|"IT"|"SE"} targetCountry */
export async function startCase(targetCountry) {
  let profile = getState().currentProfile;
  if (!profile) {
    profile = await profileRepo.createProfile("DE");
    setState({ currentProfile: profile });
  }
  const reclaimCase = await caseRepo.createCase(profile, targetCountry);
  setState({ cases: [...getState().cases, reclaimCase], currentCase: reclaimCase });
  navigate(stepRoute(reclaimCase, 1));
  return reclaimCase;
}
