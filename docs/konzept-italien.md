# DivRebound — Konzept Corridor Italien (Ritenuta sui dividendi)

**Status:** Umgesetzt (Stand 31.10.2026). Unternehmensliste `config/italianShares.js` startet mit 5 belegten Einträgen.
**Vorbild für Ablauf und Screens:** Dänemark (Formular → Finanzamt → Einreichung). Von der Schweiz werden nur zwei Bausteine übernommen: die Gliederung dieses Dokuments und die Idee einer gepflegten Aktienliste (`swissShares.js`).
**Ziel dieses Dokuments:** Grundlage für die Implementierung des dritten Ziellands. Beschreibt den Papier-Ablauf mit Form A, was DivRebound pro Schritt beiträgt, das Feld-Mapping für das Formular, die Erweiterungen am Datenmodell und eine Aufgabenliste.
**Referenzfall:** Antrag Italmobiliare S.p.A. (IT0005253205), Zahltage 08.05.2024 (100 Stück, 3,00 €) und 07.05.2025 (240 Stück, 0,90 €), Erstattung gesamt **56,76 €**. Die Befüllung muss diesen Fall reproduzieren (Vorlage: `2025_IT0005253205_Antrag_Italmobiliare.pdf`, Werte dort als FreeText-Anmerkungen).
**Weitere Testabrechnung:** Baader/Smartbroker+, Italmobiliare, Zahltag 06.05.2026, 260 Stück à 1,10 €, Brutto 286,00 €, Quellensteuer 26 % = 74,36 €, „rückforderbarer Steuerbetrag“ 31,46 €.

---

## 0. Entscheidungsgrundlage (aus Abstimmung mit Matthias)

| Frage | Entscheidung |
|---|---|
| Ablauf | **Nur Papier.** Form A ausfüllen (erzeugt DivRebound) → selbst unterschreiben → deutsches Finanzamt bestätigt die Ansässigkeit auf Seite 5 → per Post an die Agenzia delle Entrate, Centro Operativo di Pescara. Kein Portal |
| Vorbild | **Dänemark.** Gleiche Schritte, gleiche Bausteine (Checkliste, Upload, Fehlende Angaben, Formular & Finanzamt, Status-Zeitleiste) und gleiches Look & Feel |
| Ein Form A pro … | **Pro italienischem Unternehmen (Zahler).** Ein Fall kann mehrere Unternehmen enthalten, daraus werden mehrere Form A erzeugt. Das Anschreiben an das Finanzamt und das Begleitschreiben nach Italien bleiben **je eines pro Fall**, über alle Unternehmen hinweg |
| Mehr als 4 Ausschüttungen eines Unternehmens | Die Tabelle auf Seite 4 hat 4 Zeilen. Bei mehr Zeilen wird **ein zweites (drittes …) Form A** für dasselbe Unternehmen erzeugt, jedes mit eigener Summe |
| Business year | **= Jahr des Zahltags** (nicht der „Zahlungszeitraum“ der Abrechnung; der ist bei Baader z. B. 2025 für den Zahltag 06.05.2026) |
| Angaben zum Zahler | **Optional, nie blockierend.** Stehen Sitz und Codice fiscale in der eigenen Liste, werden sie automatisch eingetragen; sonst kann der Nutzer sie ergänzen, muss aber nicht. Der Firmenname kommt immer aus der Abrechnung (Abschnitt 4). Depotbank bleibt leer (keine italienische Bank) |
| Quellensteuersatz | **Wird pro Abrechnung erkannt.** 26 % ist der Regelfall; weicht der Satz auf der hochgeladenen Abrechnung ab, reagiert DivRebound je nach Fall (Abschnitt 5) |
| Bestätigung des Finanzamts | **Wird vorausgefüllt:** Ort des Finanzamts, Steuerjahre, „Germany“, Artikel 10. Das Finanzamt ergänzt nur Datum, Unterschrift und Stempel |
| Anlagen nach Italien | Form A (Original, vom Finanzamt bestätigt) **und Kopien der Dividendenabrechnungen** |
| Frist | **48 Monate ab dem Tag des Steuerabzugs** (≈ Zahltag). `limitationPeriodYears: 4` |
| Sprache Begleitschreiben | **Englisch**, wie in der Vorlage |
| OCR | Wie bei DK/CH: nicht im MVP |

---

## 1. Ablauf und Schritte in DivRebound

| # | Schritt (Sidebar) | Inhalt | Wiederverwendung |
|---|---|---|---|
| 1 | Unterlagen prüfen | Checkliste: Dividendenabrechnungen, Persönliche Daten, Bankverbindung, Finanzamt | `components/checklist.js`, wie `dkChecklist` |
| 2 | Dividendenabrechnungen | **Gleiche Darstellung wie DK:** Upload-Feld mit Icon, Hinweise zu abgelehnten Dateien, Tabelle mit Auswahl-Häkchen und Status („automatisch erkannt“ / „bestätigt“), Zwischensummen, großer Erstattungsbanner, Leiste „x von y Ausschüttungen bestätigt“. Nur bestätigte Zeilen kommen ins Formular. Unterschied zu DK: gruppiert **nach Unternehmen** statt nach Steuerjahr, zusätzliche Spalte „Satz“ (Abschnitt 5), nur ISINs mit `IT`, Beträge in EUR | `shell.js` + `parseDividendCertificate.js` mit Corridor IT |
| 3 | Fehlende Angaben | Nur was fehlt (Abschnitt 3). Eingaben landen in den Persönlichen Daten bzw. im Unternehmens-Verzeichnis, damit man sie nur einmal eingibt | `missingData.js`, `PROFILE_FIELDS` |
| 4 | Formular & Finanzamt | Zeitleiste; Form A als Liste kompakter Zeilen (je Unternehmen/Teil: Vorschau + PDF, darunter „alle als ein PDF“); „Wer unterschreibt wo?“ (Seite 3 und 5 selbst, Seite 5 unten Finanzamt); Anschreiben an das Finanzamt; Nächste Schritte; Bearbeitung pausiert. **Keine Zusammenfassung** (gilt jetzt auch für DK) | `summaryDownload.js`-Aufbau (Formular-Zeile `.doc-item` wie DK), `buildTaxOfficeLetter.js` unverändert |
| 5 | Versand nach Italien | Erst sinnvoll, wenn das Finanzamt bestätigt hat. Begleitschreiben (Englisch) herunterladen; Checkliste fürs Kuvert (bestätigte Form A im Original, Kopien der Abrechnungen, Begleitschreiben, Unterschriften auf S. 3 und S. 5 vorhanden, Stempel auf S. 5 vorhanden); Adresse Pescara zum Kopieren; Button **„Als versendet markieren“** = abgeschlossen; optional später „Erstattung erhalten“ mit Betrag und Datum | neu, Aufbau wie Schritt 4 |

**Status-Zeitleiste Italien:** Formular erstellt → Unterschrieben & ans Finanzamt → Vom Finanzamt bestätigt → Nach Italien versendet → Ausgezahlt.

Statuswerte (`ReclaimCase.status`): `draft` → `residency_form_generated` → `awaiting_tax_office` → `ready_for_mailing` → `submitted` (= abgeschlossen, zählt für die Statistik) – analog DK (`ready_for_skat_submission` heißt hier `ready_for_mailing`).

Hinweis zur Dauer: Die Bearbeitung in Pescara dauert erfahrungsgemäß viele Monate (beim Referenzfall 9 Monate). Das sollte in Schritt 5 ehrlich stehen, damit der Fall nicht als „hängend“ empfunden wird.

---

## 2. Form A – Felder und Befüllung

Die Vorlage (`IT_Antrag_A-Dividends_FORM_A.pdf`, Agenzia delle Entrate) hat **keine AcroForm-Felder**. DivRebound schreibt den Text deshalb mit `pdf-lib` (`drawText`) an feste Koordinaten auf die Originalseiten – anders als das DK-Formular 02.050, das echte Felder hat. Vorlage nach `app/public/forms/it-form-a-template.pdf`.

Die Koordinaten unten stammen aus den FreeText-Anmerkungen des Referenzantrags (PDF-Punkte, Ursprung unten links, A4 595×842; `x,y` = linke untere Ecke des Textfelds). Sie sind der Startpunkt für das Feld-Mapping und müssen beim Implementieren am Ausdruck nachjustiert werden.

### Seite 1 – Deckblatt, Begünstigter

| Feld | Wert | Quelle | Pos. (x,y) |
|---|---|---|---|
| ☒ dividends (FORM A) | x | fest | 146,648 |
| ☒ DETAILS OF THE BENEFICIAL OWNER | x | fest, **neu** (im Referenzantrag fehlte das Kreuz) | Kästchen vor der Überschrift, Position messen |
| Surname / Name | Mustermann / Max | Profil | 155,455 / 259,455 |
| Place / Date of Birth | Augsburg / 14.06.1975 | Profil | 349,456 / 453,456 |
| Business Name | --- | fest | 156,416 |
| Foreign TIN | `Tax Number: 143/123/45678 ; Tax ID: 12345678901` | Profil (`taxNumber`, `tin`) | 199,388 |
| Italian TIN | --- | fest | 157,331 |
| Residence State / Full address | Germany / `Straße ; PLZ Ort ; Germany` | Profil | 155,292 / 242,291 |
| Domicile State / Full address | --- / --- | fest | 155,253 / 241,254 |
| E-MAIL | E-Mail | Profil (optional) | 155,201 |

### Seite 2 – Gesetzlicher Vertreter, Mitbegünstigte

Bleibt leer (Privatanleger, Einzeldepot). Gemeinschaftsdepots sind außerhalb des Leistungsumfangs (Hinweis in der Checkliste).

### Seite 3 – Bevollmächtigter, Zahlungsweg, Unterschrift

| Feld | Wert | Quelle | Pos. (x,y) |
|---|---|---|---|
| Proxy-Block | leer | – | – |
| FINANCIAL INSTITUTION | Commerzbank AG | Profil `bank.bankName` | 172,387 |
| BANK ACCOUNT HOLDER | Max MUSTERMANN | Profil `bank.accountHolderName` (Nachname groß wie im Referenzantrag) | 172,369 |
| BIC / IBAN | COBADEFFXXX / DE89 … | Profil | 245,344 / 380,344 |
| ADDRESS OF THE FINANCIAL INSTITUTION | `Commerzbank AG; Kaiserplatz; 60311 Frankfurt` | Profil, **neues Feld** `bank.address` (in der Eurozone optional laut Fußnote 4, aber im Referenzantrag ausgefüllt → befüllen, wenn vorhanden) | 242,294 |
| SIGNATURE | **leer – eigenhändig** | Hinweis in Schritt 4 | – |
| ATTACHMENTS | **neu:** `Copies of dividend statements (n)` | Anzahl Abrechnungen dieses Unternehmens | Zeile hinter „ATTACHMENTS:“ |

### Seite 4 – Form A, Dividenden

| Feld | Wert | Quelle | Pos. (x,y) |
|---|---|---|---|
| ☒ REFUND | x | fest | 54,719 |
| Article __ … between Italy and ___ | 10 / Germany | fest (DBA DE-IT, Art. 10) | 87,683 / 480,684 |
| ITALIAN DIVIDEND PAYER: Business Name, Italian TIN, Full address | Italmobiliare S.p.A., Codice fiscale, Sitz | Unternehmens-Verzeichnis (Abschnitt 4), Name sonst aus Abrechnung | in den leeren Zellen, Position messen |
| DEPOSITARY BANK | leer | – | – |
| Tabelle, Zeile 1–4 | Business year, Payment date, Number of shares, Dividends per share, Gross, Tax paid in Italy, Tax due, Requested refund | Ausschüttungen des Unternehmens (Abschnitt 5) | Zeilen bei y ≈ 298 / 268 / 239 / 209; Spalten x ≈ 51 / 96 / 156 / (Percentage leer) / 268 / 318 / 389 / 446 / 503 |
| TOTAL | Summe Requested refund | berechnet | 503,180 |

Beträge im Format `300,00 €` (deutsches Format wie im Referenzantrag).

### Seite 5 – Erklärung und Bestätigung des Finanzamts

| Feld | Wert | Quelle | Pos. (x,y) |
|---|---|---|---|
| The undersigned / acting as | Max MUSTERMANN / beneficial owner | Profil / fest | 129,716 / 311,716 |
| entity … is resident in | Max MUSTERMANN / Germany | Profil | 179,664 / 397,664 |
| Convention with / tax period(s) | Germany / `2024 and 2025` | fest / Jahre der Zahltage dieses Formulars | 144,648 / 384,648 |
| ☒ subject to tax in the Country of residence | x | fest | 52,562 |
| ☒ refund of taxes | x | fest | 52,359 |
| Place and date | `München 02.09.2025` | Wohnort aus Profil + Erstellungsdatum | 121,310 |
| Signature | **leer – eigenhändig** | – | – |
| Tax Authority of | München | Profil `taxOffice.city` | 161,235 |
| tax period/s | `2024 & 2025` | wie oben | 417,235 |
| resident in / Article | Germany / 10 | fest | 196,219 / 398,220 |
| Date, Signature and Office stamp | **leer – Finanzamt** | – | – |

**Empfehlung zu Frage 1 („fehlt etwas?“):** Gegenüber dem Referenzantrag zusätzlich (a) Kreuz bei „Details of the beneficial owner“, (b) Angaben zum italienischen Zahler (Name, Sitz, Codice fiscale), (c) Feld „Attachments“ auf Seite 3, (d) deutlicher Hinweis auf **zwei** eigenhändige Unterschriften (Seite 3 und Seite 5). Alle 5 Seiten werden ausgedruckt und vollständig eingeschickt – auch die leere Seite 2.

---

## 3. Fehlende Angaben (Schritt 3)

Pflicht für Form A: Vorname, Nachname, Geburtsdatum, Geburtsort, Steuer-ID, Steuernummer, Adresse, Bankname, Kontoinhaber, IBAN, BIC, Finanzamt (Name + Ort). Optional: E-Mail, Telefon (für das Begleitschreiben), **Adresse der Bank (neu)**.

Neu im Profil: `bank.address` (ein Feld, Freitext) in `PROFILE_FIELDS` und auf der Seite „Persönliche Daten“.

Pro Unternehmen, falls nicht in der Liste (Abschnitt 4): Sitz (Adresse) und Codice fiscale als **aufklappbarer, optionaler Bereich** („Angaben zum Unternehmen ergänzen (optional)“) mit Erklärung, wo man sie findet (Impressum/Investor-Relations-Seite, „C.F./P.IVA“). Diese Felder zählen **nicht** zu den Pflichtangaben: Der Weiter-Button und der Fortschritt hängen nicht davon ab. Eingegebene Werte werden pro Profil gespeichert, damit sie beim nächsten Fall schon da sind.

---

## 4. Angaben zum italienischen Zahler – Datenquelle

**Ergebnis der Recherche:** Es gibt **keine offene, maschinenlesbare Quelle**, die ISIN, Codice fiscale und Sitz börsennotierter italienischer Gesellschaften zusammenführt. Borsa Italiana veröffentlicht Listen mit Name/ISIN/Kapitalisierung, Codice fiscale und Sitz stehen im Registro Imprese (InfoCamere, kostenpflichtig) bzw. im Impressum der Unternehmen. Aus der Dividendenabrechnung lässt sich nur der **Firmenname** (und die ISIN) lesen – Sitz und Codice fiscale nicht.

**Vorschlag (zweistufig):**
1. **Statische Liste `config/italianShares.js`** (wie `swissShares.js`): ISIN → Name, Codice fiscale, Sitz. Startumfang: FTSE MIB + FTSE Italia Mid Cap (≈ 100 Gesellschaften mit IT-ISIN), einmalig recherchiert aus den Unternehmensseiten; Pflege bei Bedarf. Achtung: Gesellschaften mit Sitz in den Niederlanden (Stellantis, Ferrari, Exor, CNH, Cementir …) haben **NL-ISINs** und fallen ohnehin nicht unter Italien.
2. **Fallback:** Unbekannte ISIN → Name aus der Abrechnung, Sitz/Codice fiscale optional in Schritt 3 ergänzbar und pro Profil gemerkt.

**Nie blockierend:** Fehlen Sitz oder Codice fiscale, wird nur der Name eingetragen und die übrigen Zellen bleiben leer – das Formular wird trotzdem erzeugt (der Referenzantrag wurde ganz ohne diese Angaben eingereicht). Reihenfolge der Quellen: eigene Eingabe des Nutzers > Liste > leer.

---

## 5. Beträge und Prüfungen

Pro Ausschüttung (aus der Abrechnung, Währung EUR):

| Spalte | Berechnung | Referenz 2024 |
|---|---|---|
| Dividends per share | aus Abrechnung („EUR 1,10 p.STK“), sonst Brutto / Stück | 3,00 € |
| Gross | „Bruttobetrag“ | 300,00 € |
| Tax paid in Italy | „Quellensteuer“-Betrag (nicht berechnet, wenn ausgewiesen) | 78,00 € (26 %) |
| Tax due | Brutto × 15 % | 45,00 € |
| Requested refund | Tax paid − Tax due | 33,00 € |

Corridor-Config:

```js
IT: {
  targetCountry: "IT",
  residencyCountries: ["DE"],
  flow: "form+mail",
  formId: "FORM_A",
  maxDistributionsPerForm: 4,      // Zeilen auf Seite 4, sonst weiteres Formular
  limitationPeriodYears: 4,        // 48 Monate ab Steuerabzug
  standardWithholdingRate: 0.26,
  treatyRateByResidence: { DE: 0.15 },
  treatyArticle: 10,
  isinPrefix: "IT",
  nativeCurrency: "EUR",
  mailingAddress: ["Agenzia delle Entrate", "Centro Operativo di Pescara", "Via Rio Sparto 21", "65129 Pescara", "Italy"],
}
```

### Ausnahmen vom 26-%-Satz und wie DivRebound sie erkennt

26 % ist für Privatanleger mit deutschem Depot der Regelfall (Ritenuta a titolo d'imposta auf Dividenden an Nicht-Ansässige). Abweichungen:

| Fall | Häufigkeit (Einschätzung) | Erkennung | Verhalten |
|---|---|---|---|
| **Entlastung an der Quelle** (Depotkette wendet direkt 15 % an) | selten bei deutschen Retail-Brokern | Satz auf der Abrechnung = 15 % bzw. Steuer/Brutto ≈ 0,15 | Hinweis „nichts zu erstatten“, Ausschüttung nicht ins Formular |
| **Ausschüttung aus Kapitalrücklagen** (keine Dividende im steuerlichen Sinn) | gelegentlich, unternehmensspezifisch | keine oder geringere Quellensteuer bei vorhandenem Bruttobetrag | Hinweis, Ausschüttung nur übernehmen, wenn Steuer > 15 % |
| **Gemischte Ausschüttung** (Teil aus Rücklagen) | selten | Steuer/Brutto deutlich unter 26 % | Warnung, Erstattung = tatsächliche Steuer − 15 % × Brutto, Nutzer bestätigt |
| **Sachdividende / Scrip** | selten | kein EUR-Bruttobetrag oder Hinweistext | ablehnen mit Hinweis „außerhalb des Leistungsumfangs“ |
| 1,2 % für EU-Kapitalgesellschaften | nicht relevant (nur juristische Personen) | – | – |

**Erkennung pro hochgeladener Abrechnung.** Maßgeblich ist der effektive Satz: bevorzugt der ausgewiesene Satz („Quellensteuer 26,00 %“), zur Kontrolle immer auch `Quellensteuer-Betrag / Bruttobetrag`. Weichen beide voneinander ab (> 0,5 Prozentpunkte), gilt der Betrag und der Nutzer bekommt eine Warnung.

| Effektiver Satz | Einstufung | Reaktion in Schritt 2 |
|---|---|---|
| 26 % (± 0,5 Pp.) | Regelfall | übernehmen, kein Hinweis |
| > 15 % und < 25,5 % | abweichend (z. B. teilweise aus Rücklagen) | übernehmen mit gelbem Hinweis „Quellensteuer x % statt 26 % – Erstattung nur auf den tatsächlichen Abzug“; Nutzer bestätigt die Zeile |
| ≤ 15 % (inkl. 0 bzw. keine Quellensteuer) | nichts zu erstatten (Entlastung an der Quelle oder Rücklagen-Ausschüttung) | nicht ins Formular; Zeile ausgegraut mit Begründung, wie abgelehnte Abrechnungen bei DK |
| > 26,5 % | unplausibel (Lesefehler?) | Warnung, Werte prüfen und bestätigen lassen |
| kein EUR-Bruttobetrag | Sachdividende o. Ä. | ablehnen mit Hinweis „außerhalb des Leistungsumfangs“ |

Grundsatz: **Erstattet wird immer „tatsächlich gezahlte Steuer − 15 % vom Brutto“**, nie pauschal 11 %. Technisch: die vorhandene Satzprüfung im Parser (ausgewiesener Satz vs. `standardWithholdingRate`) plus neue Funktion zur Einstufung (`classifyWithholding`) mit Unit-Tests für alle Fälle der Tabelle.

Cross-Check: Baader weist den „rückforderbaren Steuerbetrag“ selbst aus (31,46 € = 11 % von 286,00 €) – wie bei DK nur als Kontrollhinweis.

---

## 6. Begleitschreiben nach Italien

Neues Modul `lib/buildItalyCoverLetter.js`, Aufbau wie `buildTaxOfficeLetter.js` (pdf-lib, A4, gleiche Ränder/Schrift), Text Englisch nach Vorlage `2025_IT_Anschreiben_Finanzamt_Italien.docx`:

- Absender (rechts): Name, Straße, PLZ Ort, Datum (`22 September 2025`), Telefon, E-Mail – aus dem Profil
- Empfänger: Agenzia delle Entrate, Centro Operativo di Pescara, Via Rio Sparto 21, 65129 Pescara, Italy
- Subject: Request for Refund of Withholding Tax on Dividends
- Text: Erstattung der Quellensteuer auf Dividenden von *„Italmobiliare S.p.A.“ (IT0005253205)* – bei mehreren Unternehmen als Aufzählung –, Ansässigkeit Deutschland nach DBA, deutsche Steuer-ID
- Enclosures: „The completed tax refund application form(s) (**Form A**), certified by the German tax office“ (Vorlage sagte fälschlich „Modello D“) und „Dividend statements for the fiscal year(s) …, confirming the amount of withholding tax paid“
- Bitte um Überweisung, IBAN und BIC
- Grußformel, Platz für Unterschrift, Name

---

## 7. Datenmodell

- `ReclaimCase` für IT: wie DK (`distributions[]`, `residencePeriod` entfällt – Form A fragt keinen Zeitraum, nur Steuerjahre), zusätzlich `generatedDocuments` mit Typen `it_form_a` (je Unternehmen/Teil), `tax_office_letter`, `it_cover_letter`, `timelineStep`, `mailedAt`, optional `refundReceived { amount, date }`.
- Gruppierung nach ISIN wird **zur Laufzeit** aus `distributions` gebildet (keine eigene Struktur nötig); Aufteilung in Formulare zu je 4 Zeilen, sortiert nach Zahltag.
- `InvestorProfile.bank.address` (neu).
- `InvestorProfile.issuers` (neu, optional): `{ [isin]: { name, taxCode, address } }` – nur für Unternehmen, die nicht in `italianShares.js` stehen.

---

## 8. Aufgabenliste

1. Corridor `IT` in `config/corridors.js`, `IT_STEPS` in `config/caseSteps.js`, Routen `#/it/:caseId/...`, Italien im Neuer-Fall-Dialog freischalten (`newCaseWizard.js`), Sidebar.
2. Parser gegen die drei Italmobiliare-Abrechnungen (Baader 2024, 2025, 2026) kalibrieren und als Test-Fixtures aufnehmen; Dividende je Stück auslesen; Einstufung des Quellensteuersatzes (`classifyWithholding`, Abschnitt 5) mit Tests.
3. Schritt 1 Checkliste und Schritt 2 Upload mit Gruppierung nach Unternehmen (Wiederverwendung DK).
4. Schritt 3 Fehlende Angaben inkl. `bank.address` und optionaler, nicht blockierender Unternehmensangaben.
5. `lib/fillFormA.js`: Vorlage laden, Text an Koordinaten zeichnen, Aufteilung > 4 Zeilen, Ausgabe je Unternehmen. Abgleich mit dem Referenzantrag (56,76 €).
6. Schritt 4 Formular & Finanzamt (Zeitleiste, Downloads, Unterschriften-Hinweis).
7. `lib/buildItalyCoverLetter.js` und Schritt 5 Versand nach Italien inkl. Abschluss.
8. `config/italianShares.js` (FTSE MIB + Mid Cap) – kann parallel bzw. nachgelagert laufen.
9. Website: Italien in `site/_data/countries.yml` als verfügbar markieren.

---

## 9. Quellen

- Agenzia delle Entrate, Form A: https://agenziaentrate.gov.it/portale/documents/180690/1186121/Form%20A-Dividends_FORM_A.pdf
- Agenzia delle Entrate, Conventions for the avoidance of double taxation (48 Monate, Pescara): https://www.agenziaentrate.gov.it/portale/web/english/nse/business/double-taxation-relief/conventions-for-the-avoidance-of-double-taxation
- DSW, Erläuterungsvordruck Italien: https://www.dsw-info.de/fileadmin/Redaktion/Dokumente/PDF/Quellensteuer/Formulare/Italien-Erlaeuterungsvordruck_2022.pdf
- PwC Tax Summaries Italy, Withholding taxes: https://taxsummaries.pwc.com/Italy/Corporate/Withholding-taxes
