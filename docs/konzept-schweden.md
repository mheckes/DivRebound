# DivRebound — Konzept Corridor Schweden (Utdelning, SKV 3740)

**Status:** Umgesetzt (Stand 12.11.2026), Ablauf wie Italien (`docs/konzept-italien.md`).
**Referenzfall:** Thule Group AB (SE0006422390), Zahltage 11.10.2022 (26 Stück à 6,50 SEK), 05.05.2023 und 10.10.2023 (je 57 Stück à 4,60 SEK). Erstattung gesamt **104,01 SEK** (Brutto 693,40 SEK, einbehalten 208,02 SEK). Die Befüllung und `test/sweden.test.js` reproduzieren diesen Fall.

## Ablauf (6 Schritte, `config/caseSteps.js` SE_STEPS)

1. Unterlagen prüfen · 2. Dividendenabrechnungen (gemeinsame Seite `shared/dividendUpload.js`) · 3. Fehlende Angaben · 4. Formular & Finanzamt · 5. Versand nach Schweden · 6. Erstattung erhalten (optional)

Nur Papier: SKV 3740 ausfüllen → selbst unterschreiben (Seite 1) → Finanzamt bestätigt die Ansässigkeit unten auf Seite 2 → per Post (oder E-Mail laut Formularkopf) an Skatteverket, Box 6037, 171 06 Solna, `skatteverket@skatteverket.se`. Anlagen: Kopien der Dividendenabrechnungen. Dazu ein englisches Begleitschreiben (`lib/buildSwedenCoverLetter.js`, wie Italien).

## Regeln (`config/corridors.js` SE)

| Punkt | Wert |
|---|---|
| Regelsatz / DBA-Satz | 30 % / 15 % (Art. 10) |
| Erstattung je Ausschüttung | gezahlte Steuer − 15 % × Brutto (wie DK/IT, `lib/withholding.js`) |
| Währung | Berechnung und Formular in **SEK**; Auszahlung wird in EUR gewünscht (Kästchen EUR) |
| Frist | fünf Jahre ab **Ende des Kalenderjahres** der Auszahlung (`limitationRule: "calendarYearEnd"`), also Zahltag 11.10.2022 → bis 31.12.2027 |
| Zeilen je Formular | 12 (Tabelle IV auf Seite 2), danach weiteres Formular |
| Ein Formular für | alle Unternehmen gemeinsam (Name steht je Zeile) |

## Formular (`lib/fillSkv3740.js`)

Vorlage `public/forms/se-skv3740-template.pdf` (Ausgabe 2026, SKV 3740 22 web 04) hat keine Formularfelder; Text und Kreuze werden an gemessenen Koordinaten gezeichnet, nur Seite 1 und 2 (Seite 3 = Hinweise). Ausgefüllt: Datum, Name, Adresse, E-Mail, Telefon, Ja/Nein-Kreuze wie im Muster (II.1 Ja, III.1 Ja, III.2 Nej, III.2a Nej), Betrag, Auszahlung in EUR, Bank (Name, SWIFT, IBAN, Kontoinhaber), Tabelle IV, Summen, „Germany“. Leer bleiben: Swedish TIN, Ombud, „Ansökan avser“, Plusgiro, Unterschrift, Stempel des Finanzamts.

## Parser (DAB BNP Paribas / Smartbroker)

`lib/dividendCertificateParser.js` liest jetzt auch das DAB-Layout: Tabellenzeile `STK … Ex-Tag Zahltag SEK je Stück`, Name aus der Zeile unter „Gattungsbezeichnung“ (ohne „(publ)“/„Namn-Aktier o.N.“), Quellensteuer und Satz aus „ausländische Quellensteuer 30% SEK …“, „erstattungsfähige Quellensteuer“ als Kontrollhinweis, Adresse trotz „Depotinhaber“ in derselben Zeile. Der Bruttobetrag steht auf DAB nur in EUR; in der Fremdwährung wird er als Stück × Dividende je Stück berechnet. Das gilt auch für andere Länder derselben Abrechnung.

## Offene Punkte

- **Datum in Spalte 3 der Tabelle:** DivRebound trägt den **Zahltag** ein („Due and payable date“). Das Muster des Nutzers (Divizend) nannte die **Ex-Tage**. Der Ex-Tag wird zusätzlich als `exDate` gespeichert.
- Website: Schweden steht in `site/_data/countries.yml` noch auf `planned`.
