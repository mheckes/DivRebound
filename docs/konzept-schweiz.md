# DivRebound — Konzept Corridor Schweiz (Verrechnungssteuer)

**Status:** In Abstimmung (Stand 14.10.2026, nach Feedback zu Mockup v1)
**Visuelle Referenz:** `Mock Up Schweiz 10-2026/divrebound_ch_mockup.html` (klickbar, enthält auch die geänderten Dänemark-Screens)
**Ziel dieses Dokuments:** Grundlage für die Implementierung des zweiten Ziellands. Beschreibt den Ablauf im ESTV-Portal, was DivRebound pro Schritt beiträgt, die nötigen Erweiterungen am Datenmodell und eine Aufgabenliste.
**Referenzfall:** Antrag `DE-1407-5964-00` (Jungfraubahn Holding, CH0017875789, Dividendentermin 18.05.2026, 25 Stück, Rückerstattung CHF 42,50). Die FIFO-Berechnung muss diesen Fall exakt reproduzieren.

---

## 0. Entscheidungsgrundlage (aus Abstimmung mit Matthias)

| Frage | Entscheidung |
|---|---|
| Automatisierungsgrad | **Copilot, kein Roboter.** DivRebound loggt sich nicht ins ePortal ein (persönlicher Login mit 2FA, Unterschrift, Beglaubigung durch Finanzamt). Wie bei SKAT: Daten vorbereiten, Spickzettel mit Kopier-Buttons in Portal-Reihenfolge |
| Ansässigkeitsländer | Vorerst nur **Deutschland** (DBA DE-CH, Formular DIP-0085). Österreich zurückgestellt |
| Erfassungseinheit im Portal | **Ein Eintrag pro Kauf-Tranche und pro Dividendentermin** (ISIN, Erwerbsdatum, Stückzahl). Das Portal ergänzt Bruttodividende und Rückerstattung selbst |
| Teilverkäufe | **FIFO.** Ganz verkaufte Tranchen entfallen (Fall A), teilweise verkaufte Tranchen behalten ihr Erwerbsdatum mit reduzierter Stückzahl (Fall B) |
| Depots | **Werden nicht unterschieden** (Vereinfachung, Feedback 14.10.2026): Alle Käufe und Verkäufe einer Aktie bilden einen gemeinsamen Bestand, keine Depot-Pflege. Die Depot-Nr. aus Abrechnungen wird nur noch mitgespeichert. Grenzfall: dieselbe Aktie in zwei Depots mit Teilverkäufen – dann kann FIFO über alle Depots von der Depot-Sicht der Bank abweichen. |
| Stichtag | Bestand am Ende des Handelstags **vor dem Ex-Tag**. Kauf am Ex-Tag gibt keinen Anspruch, Verkauf am Ex-Tag behält ihn. Im Portal steht nur das Fälligkeitsdatum – der Ex-Tag wird dort nicht abgefragt. DivRebound übernimmt ihn aus der Dividendenabrechnung oder schätzt ihn (2 Bankarbeitstage vor Fälligkeit, ohne Feiertage) und zeigt ihn nur zur Prüfung an, wenn kurz vor der Fälligkeit (≤ 10 Tage) gekauft oder verkauft wurde |
| Erwerbsdatum | **Handelstag** der Abrechnung, nicht Auftragsdatum, nicht Valuta (Referenz: Kauf 27.04.2026 hatte Auftragsdatum 17.04. und Valuta 29.04.) |
| Mehrere Ausschüttungen pro Jahr | Selten, aber möglich (Halbjahres- oder Sonderdividenden). Jeder Termin ist ein eigener Block im Portal |
| Zeitraum | Ein DivRebound-Fall deckt **alle nicht verjährten Jahre ab (bis zu 3)**. Im Portal ist das **ein Antrag mit Mehrfachauswahl der Jahre** (Allgemeine Angaben). Also ein Spickzettel, eine Antrags-ID, ein Status pro Fall; die Vermögenswerte sind nach Jahr gruppiert |
| Bestandsquelle | **PDF-Import aller Kauf- und Verkaufsabrechnungen** als Standardweg. DivRebound pflegt daraus den Bestand. **Manuelle Erfassung** (Art, ISIN, Handelstag, Stück) gleichwertig daneben, z. B. wenn alte Abrechnungen nicht mehr abrufbar sind; manuelle Einträge sind bearbeit- und löschbar |
| Menü | Wertpapierbestand vorerst unter **Quellensteuer › Schweiz** (über den Fällen), nicht unter „Nutzer“. Ein länderübergreifender Bestand (auch aus DK-Dividendenabrechnungen ableitbar) ist später denkbar |
| Abschluss | Ein DivRebound ist erst **abgeschlossen**, wenn der bestätigte Antrag hochgeladen ist (CH: ePortal, DK: SKAT-Formular eingereicht). Dieser Status zählt für die Statistik. Optional danach: erhaltener Betrag und Datum |
| Folgefälle | Käufe und Verkäufe werden **pro Profil** dauerhaft gespeichert. Beim nächsten Fall: Stand anzeigen, „Hat sich etwas geändert?“, nur neue Abrechnungen hochladen |
| OCR | **Nicht im MVP.** Nur PDFs mit echtem Text werden ausgewertet, Werte ohne Text lassen sich die Nutzer bestätigen |

---

## 1. Ablauf im ESTV-Portal und Beitrag von DivRebound

Portal: `https://eportal.admin.ch` → Kachel „Verrechnungssteuer“ → Anwendung VST-DE (`vstde.estv.admin.ch`).

| # | Portal-Schritt | DivRebound |
|---|---|---|
| 0 | — | **Checkliste der Unterlagen** (Abschnitt 2), abgeglichen mit Profil und Depot-Journal |
| 1–3 | ePortal öffnen, einloggen bzw. registrieren, Kachel „Verrechnungssteuer“ | In der Checkliste: Button „ePortal öffnen“ und **Anleitung „Zugang einrichten“** (vorerst Platzhalter: Schritt-für-Schritt-Gerüst mit Screenshot-Flächen, Inhalte folgen) |
| 4 | Neuen Antrag anlegen | Ein Antrag für alle offenen Jahre |
| 5 | Allgemeine Angaben | **Auswahl der Jahre (Mehrfachauswahl):** DivRebound markiert die Jahre mit erstattungsfähigen Dividenden. Dazu Kopierwerte aus dem Profil: Name, Adresse, Geburtsdatum, Steuer-IdNr, Steuernummer |
| 6–7 | Vermögenswerte hinzufügen | **Kern:** FIFO-Liste pro Dividendentermin, eine Zeile pro Tranche mit Kopier-Buttons und „erledigt“-Haken. Aufklappbare Herleitung (welche Tranche durch welchen Verkauf reduziert wurde) |
| 8 | Tax Voucher pro Vermögenswert | Zuordnung Voucher ↔ ISIN + Termin, Warnung bei fehlendem Voucher, Prüfung: Summe der Voucher-Stückzahlen = FIFO-Bestand |
| 9 | Fragen | Vorbereitete Antworten mit Erklärung (Abschnitt 5). Abweichende Antwort (z. B. Erbschaft, Wertpapierleihe) → Hinweis „außerhalb des Leistungsumfangs“ |
| 10 | Zusätzliche Angaben | Telefon (Format `0049…`), E-Mail, IBAN, Kontoinhaber aus dem Profil |
| 11 | Angaben prüfen | Soll-Ist: erwartete Rückerstattung gegen Summe im Portal (sofern Bruttodividende bekannt) |
| 12 | Ausdrucken, Finanzamt beglaubigen lassen, unterschreiben | Seite „Formular & Finanzamt“ (Abschnitt 1a), Anschreiben ans Finanzamt (Wiederverwendung `buildTaxOfficeLetter.js`, `taxOffice.js`) |
| 13 | Beglaubigten Antrag hochladen | Eigener Schritt „Hochladen & abschließen“: Checkliste (Stempel prüfen, alle Seiten als ein PDF scannen, hochladen), Anleitung (Platzhalter), Button „DivRebound abschließen“ |

### 1a. Schritte in DivRebound und Angleichung an Dänemark

Beide Länder bekommen nummerierte Schritte in der Sidebar (Ziffer im Kreis, erledigt = ✓) und kurze Bezeichnungen ohne „Schritt n:“. Breadcrumb: „Land › Fall › n von N“.

| # | Schweiz | Dänemark |
|---|---|---|
| 1 | Unterlagen prüfen | Unterlagen prüfen (**neu**) |
| 2 | Bestand prüfen | Dividendenabrechnungen (bisher „Positions-/Jahresübersicht“) |
| 3 | Dividenden & Tax Voucher | Fehlende Angaben |
| 4 | ePortal ausfüllen | Formular & Finanzamt (ersetzt „Zusammenfassung & Download“) |
| 5 | Formular & Finanzamt | SKAT-Portal ausfüllen (Formular öffnen + Cheat Sheet, endet mit „Als eingereicht markieren“ = abgeschlossen) |
| 6 | Hochladen & abschließen | — |

**Gemeinsame Seite „Formular & Finanzamt“** (gleicher Aufbau in beiden Ländern, ein gemeinsamer Baustein):
1. **Status-Zeitleiste** mit 5 Punkten: Formular erstellt → Unterschrieben & versendet → Vom Finanzamt bestätigt → Eingereicht (CH: im ePortal hochgeladen / DK: bei SKAT eingereicht) → Ausgezahlt. Zum Anklicken, erscheint auch auf dem letzten Schritt.
2. **① Formular:** DK: Wohnsitzbescheinigung herunterladen (erzeugt DivRebound). CH: Antrag im ePortal erstellen und speichern (erzeugt das Portal), Antrags-ID eintragen.
3. **② Anschreiben an das Finanzamt:** PDF herunterladen.
4. **③ Nächste Schritte:** nummeriert, mit Link zum folgenden Schritt.
5. **Bearbeitung pausiert:** Bearbeitungsstand speichern, Erinnerung (.ics) – wie bisher bei DK.
6. **Zusammenfassung** (eingeklappt): Angaben und erwartete Erstattung.

Der Unterschied liegt nur in der Reihenfolge: Bei DK wird erst das Formular bestätigt und dann im SKAT-Portal eingereicht, bei CH erst im Portal erfasst, dann bestätigt und hochgeladen.

---

## 2. Checkliste zu Beginn eines Falls (länderübergreifend)

Beim Start eines neuen Falls zeigt DivRebound, was gebraucht wird, und hakt automatisch ab, was schon vorhanden ist. Das Konzept ist **pro Corridor konfigurierbar** (`CorridorConfig.requirements`) und wird anschließend auch für Dänemark übernommen.

Jeder Eintrag hat einen von drei Zuständen:
- ✓ **vorhanden** (aus Profil oder Journal, mit Wert zur Kontrolle)
- ○ **fehlt** (mit Link zum Ort, an dem man es nachträgt)
- ! **prüfen** (vorhanden, aber evtl. veraltet, z. B. „letzte Transaktion vor 8 Monaten“)

**Schweiz:**

| Gruppe | Eintrag | Quelle |
|---|---|---|
| Zugang | Konto für das ePortal | Abhaken, mit „ePortal öffnen“ und „Anleitung“ |
| Profil | Name, Adresse, Geburtsdatum | Profil |
| Profil | Steuer-IdNr | Profil (`residence.tin`) |
| Profil | **Steuernummer** | Profil, **neues Feld** |
| Profil | Zuständiges Finanzamt | Profil |
| Profil | Telefon, E-Mail, IBAN, Kontoinhaber | Profil |
| Depot | Käufe und Verkäufe aller CH-Aktien, **lückenlos ab dem ersten Kauf** (Abrechnung oder manuell) | Journal. Zeigt Anzahl und letzte erfasste Transaktion |
| Dividenden | Tax Voucher pro Dividendentermin (kommen teils erst Wochen danach; Referenz: Dividende 18.05., Voucher 17.07.) | Upload im Fall |
| Dividenden | Dividendenabrechnungen (optional; liefern Termin und Bruttobetrag für den Soll-Ist-Vergleich) | Upload im Fall |

**Dänemark:** Zugang (SKAT-Formular ohne Login, immer ✓), Profil (Name, Adresse, Geburtsdatum, Geburtsort, Steuer-IdNr, Finanzamt, IBAN/BIC), Dividendenabrechnungen der DK-Aktien (Schritt 2). Der **Zeitraum der Ansässigkeit** wird nicht abgefragt, sondern aus dem frühesten Zahltag der Abrechnungen abgeleitet und in Schritt 3 „Fehlende Angaben“ nur bestätigt. „Fehlende Angaben“ zeigt sonst ausschließlich Felder, die wirklich noch leer sind; ist nichts offen, erscheint ein Hinweis „alles vollständig“.

### 2a. Datenhaltung und Synchronisierung

„Unterlagen prüfen“ ist **keine eigene Datenhaltung**, sondern eine Sicht auf zwei Quellen plus die fallbezogenen Dokumente:

| Daten | Quelle | Gilt für |
|---|---|---|
| Persönliche Daten (Name, Adresse, IdNr, Steuernummer, Bank, Finanzamt …) | **Profil** | alle Fälle aller Länder |
| Käufe und Verkäufe CH | **Depot-Journal** (Abschnitt 3.1) | alle CH-Fälle |
| Ausschüttungen, Voucher, Ansässigkeitszeitraum, Jahre, Antrags-ID | **Fall** | nur diesen Fall |

Regeln:
1. **Bearbeiten direkt in der Checkliste, genau wie in „Persönliche Daten“.** Gefüllte Felder wirken wie Text (`.confirmed-input`) und werden per Klick ins Feld bearbeitet, leere Felder erscheinen als Eingabefeld (`.field-input`, bei fehlenden Pflichtangaben rot umrandet). Gespeichert wird **automatisch** ins Profil (gleiche Felder, gleiche Validierung, gemeinsamer Feld-Baustein), siehe 2c. Kein „ändern“- und kein „Speichern“-Button.
2. **Offene Fälle lesen immer das aktuelle Profil.** Eine Änderung wirkt sofort in allen Fällen, deren Formular noch nicht erzeugt ist.
3. **Einfrieren beim Erzeugen des Formulars.** Sobald ein offizielles Dokument entsteht (DK: Wohnsitzbescheinigung heruntergeladen, CH: Antrags-ID eingetragen), speichert der Fall einen Schnappschuss der verwendeten Werte. Das ersetzt den bisherigen `applicantSnapshot`, der beim Anlegen des Falls gezogen wird und dann oft noch leer ist.
4. **Hinweis bei Abweichung.** Wird danach ein im Formular enthaltener, vorher gefüllter Wert im Profil geändert, zeigt der Fall auf „Formular & Finanzamt“: welche Angabe sich geändert hat, und bietet „Neu herunterladen“ (DK) bzw. „Im ePortal korrigieren“ (CH) oder „Bereits verschickt – ignorieren“. Erstmaliges Ausfüllen eines leeren Felds löst keinen Hinweis aus.
5. **Abgeschlossene Fälle** behalten ihren Schnappschuss als Nachweis; Profiländerungen betreffen sie nicht mehr.

### 2b. Erweiterung „Persönliche Daten“

- Neue Karte **„Steuerliche Angaben“**: Steuer-ID (TIN), **Steuernummer (neu)** und das **zuständige Finanzamt mit Anschrift** (Name, Straße, PLZ, Ort). Steuer-ID und Finanzamt wandern aus den bisherigen Karten hierher; die eigene Karte „Finanzamt“ entfällt.
- **„Anschreiben Finanzamt“** zeigt die Finanzamt-Anschrift weiterhin zur Bestätigung vor dem Download – mit denselben Feldern aus derselben Quelle (Profil). Eine Änderung dort ist eine Änderung im Profil; es gibt keine zweite Kopie der Daten und keinen eigenen Speichern-Button mehr.
- Keine Hinweise, wofür ein Feld gebraucht wird, und keine „neu“-Kennzeichnung. Beispielwerte als Platzhalter: Steuer-ID „z.B. 86095742719“, Steuernummer „z.B. 143/123/45678“.
- Datenmodell: `profile.residence.taxNumber` (String, leer erlaubt), Export/Import unverändert über das Profil.
- Der „Speichern“-Button entfällt (2c). Hinweis am Seitenende statt „Aktualisierung gilt für neu angelegte Fälle“: „Änderungen werden beim Verlassen eines Felds automatisch gespeichert und gelten für alle offenen DivRebounds. Bereits erzeugte Formulare bleiben unverändert – der Fall weist Sie dann darauf hin.“ (Regel 2–4 oben).

### 2c. Automatisches Speichern (app-weit)

Gilt für **alle** Eingabefelder mit Nutzerdaten: Persönliche Daten, Anschreiben Finanzamt, Unterlagen prüfen, Fehlende Angaben, manuelle Transaktionen, Antrags-ID, Status.

1. **Speichern beim Verlassen des Felds** (`change`-Event). Zusätzlich während des Tippens mit kurzer Verzögerung (ca. 1 s), damit beim Schließen des Tabs nichts verloren geht.
2. **Rückmeldung:** kurze Meldung unten „✓ Steuernummer gespeichert · Rückgängig“ (4 s). „Rückgängig“ stellt den vorherigen Wert wieder her – Schutz gegen versehentliche Änderungen.
3. **Validierung vor dem Speichern:** Ungültige Werte (z. B. Steuer-ID ≠ 11 Ziffern, IBAN, PLZ) werden **nicht** gespeichert; das Feld bleibt rot mit Fehlertext. Nur in diesem Fall warnt die App beim Seitenwechsel bzw. Schließen („ungültige Eingabe wurde nicht gespeichert“).
4. **Kein Neuaufbau des bearbeiteten Bereichs** nach dem Speichern (Fokus bleibt im nächsten Feld); aktualisiert werden nur Status-Symbol, Zähler und andere Ansichten.
5. **Buttons bleiben nur für Aktionen**, nicht fürs Speichern: „Weiter“ (Navigation, ggf. gesperrt solange Pflichtfelder fehlen), „herunterladen“, „abschließen“. „Fehlende Angaben“ (DK) arbeitet heute mit einer lokalen Kopie bis „Weiter“ – das wird auf direktes Speichern umgestellt.
6. **Risiko/Abwägung:** Versehentliche Änderungen sind sofort gespeichert → abgefedert durch „Rückgängig“ und den Hinweis bei Formularen, die schon erzeugt sind. Halb ausgefüllte Gruppen (z. B. nur PLZ geändert) sind unkritisch, weil alles lokal liegt und Pflichtfeld-Prüfungen erst beim Erzeugen eines Formulars greifen.

---

## 3. Datenmodell

### 3.1 Depot-Journal (neu, pro Profil)

Neuer IndexedDB-Store `transactions`, unabhängig von Fällen:

```
Transaction {
  transactionId,
  profileId,
  depotId,          // Depot-Nr. aus der Abrechnung, z. B. "3257973001"
  isin,
  issuerName,
  type: "buy" | "sell",
  tradeDate,        // Handelstag, ISO
  quantity,
  source: { kind: "pdf" | "manual", broker, documentRef, fileName, importedAt },
  extractionConfidence: "extracted" | "confirmed",
}
```

- **FIFO pro ISIN über alle Depots** (siehe §0 „Depots“). `lib/holdings.js` kann weiterhin pro Depot rechnen, die App übergibt aber keine Depot-Nr.
- **Duplikatprüfung** über `broker + documentRef` (bei Baader: Vorgangs-Nr. + Referenz-Nr.). Derselbe Upload zweimal ändert nichts.
- **Lückenprüfung:** Verkauf größer als FIFO-Bestand → Warnung „Abrechnungen fehlen“, Möglichkeit, einen Anfangsbestand mit Erwerbsdatum manuell zu erfassen.

### 3.2 Fall (Erweiterung `ReclaimCase` für CH)

```
distributions[]   { isin, depotId, exDate, paymentDate, grossPerShare?, voucherRefs[] }
claim             { status, claimId?,        // z. B. "DE-1407-5964-00"
                    years[],                   // Mehrfachauswahl im Portal
                    entries[] { year, isin, acquisitionDate, quantity, paymentDate }  // berechnet
                  }
completedAt?, receivedRefund? { date, amountEur }  // Abschluss + optional für die Statistik
```

`entries` werden immer aus Journal + Ausschüttungen neu berechnet und nicht von Hand gepflegt. Sobald der Antrag erstellt ist (`claimId` gesetzt), wird er eingefroren. Status-Werte entsprechen der Zeitleiste (Abschnitt 1a); `completed` erst nach dem Hochladen.

### 3.3 Corridor-Config

```
CH: {
  targetCountry: "CH",
  residencyCountries: ["DE"],
  flow: "portal",                 // DK: "form+portal"
  onlinePortalUrl: "https://eportal.admin.ch",
  requiresLogin: true,
  claimGranularity: "calendarYear",
  limitationPeriodYears: 3,
  standardWithholdingRate: 0.35,
  treatyRateByResidence: { DE: 0.15 },
  isinPrefix: "CH",
  nativeCurrency: "CHF",
  requirements: [...],            // Checkliste, Abschnitt 2
}
```

Die Annahme in `corridors.js` („neues Land = neue Config + neuer Parser“) gilt für CH nicht vollständig: Ablauf (`flow`) und Feldzuordnung (`eportalFieldMap.js` analog `skatFieldMap.js`) sind pro Corridor.

---

## 4. Dokument-Import

Nur PDFs mit echtem Textlayer (pdf.js). Alle Werte bleiben `extracted`, bis die Nutzer sie bestätigen.

| Dokument | Erkennung | Felder | Kalibriert an |
|---|---|---|---|
| Kauf-/Verkaufsabrechnung | „Wertpapierabrechnung: Kauf“ / „Verkauf“ | ISIN, Name, Stück (`STK n`), **Handelsdatum** aus „Details zur Ausführung“, Depot-Nr., Vorgangs-Nr., Referenz-Nr. | Baader/Smartbroker+ 09.01.2026 und 27.04.2026 |
| Tax Voucher (Baader) | „Tax Voucher“ auf Seite 1 | ISIN, Stück (Bestand), Vorgangs-Nr., Referenz-Nr. | Baader 17.07.2026 (20 und 5 Stück) |
| Dividendenabrechnung | vorhandener `parseDividendCertificate.js` mit `nativeCurrency: "CHF"` | Termin, Bruttobetrag, Stück | comdirect Calida (bereits kalibriert) |

**Aktienerkennung bei manueller Erfassung:** Eingebaute Liste aller Schweizer Aktien der SIX Swiss Exchange (ISIN → Name, `app/src/config/swissShares.js`, erzeugt mit `npm run update-swiss-shares` aus der offiziellen SIX-Aktienliste). Die App selbst greift nicht aufs Internet zu. Eigene Namen aus dem Bestand haben Vorrang; ISINs werden per Prüfziffer validiert.

Erkenntnisse aus den Referenzdokumenten:
- **Voucher ≠ Tranche.** Baader stellt für einen Termin mehrere Voucher mit derselben Vorgangs-Nr. aus (20 + 5 Stück für 4 Tranchen). Zuordnung immer über ISIN + Termin, Prüfung über die Summe.
- **Seite 2 des Vouchers** (das eigentliche Schreiben an die ESTV mit „Dividendentermin“) ist als Vektorgrafik ohne Text eingebettet. Der Termin wird deshalb aus der Dividendenabrechnung übernommen oder von den Nutzern beim Upload bestätigt.
- **Handelsdatum:** Mit pdf.js steht es in beiden Referenzabrechnungen auf der Ausführungszeile (`STK | 3 | EUR | 300,00 | GETTEX - MM Munich | 27.04.2026 | 16:57:14:801`), Kurs und Spalten können aber verrutschen. Robust: Datum auf der `STK`-Zeile im Block „Details zur Ausführung“. **Nie** das erste Datum im Dokument nehmen, das wäre Briefdatum oder Auftragsdatum.
- **Teilausführungen:** Ein Auftrag kann in mehreren Ausführungszeilen abgerechnet werden. Jede Zeile wird als eigene Transaktion mit eigenem Handelsdatum und eigener Stückzahl übernommen, die Summe wird gegen `STK n` im Kopf geprüft.
- Verkaufsabrechnung liegt noch nicht als Beispiel vor; angenommen wird derselbe Aufbau mit „Verkauf“. Wird kalibriert, sobald ein Beispiel vorliegt.

---

## 5. Vorbereitete Antworten (Portal-Schritt 9)

| Frage im Portal | Standardantwort | Abweichung → |
|---|---|---|
| Im Sinne des DBA in [Ort] ansässig? | Ja | außerhalb Leistungsumfang |
| Nutzungsberechtigt zum Zeitpunkt der Fälligkeiten? | Ja | außerhalb Leistungsumfang |
| Für eigene Rechnung einkassiert? | Ja | außerhalb Leistungsumfang |
| Eigenbestände, nicht für Drittbegünstigte? | Ja | außerhalb Leistungsumfang |
| Securities Lending and Borrowing? | Nein | Hinweis: Wertpapierleihe im Depot prüfen |
| In Deutschland unbeschränkt steuerpflichtig? | Ja | außerhalb Leistungsumfang |
| Aus einer Erbschaft? | Nein | Hinweis: Sonderfall, Erwerbsdatum/Nachweise abweichend |

---

## 6. Folgefälle und Bestandsübersicht

1. **Stand anzeigen:** Bestand pro Depot und ISIN mit Tranchen, letzte erfasste Transaktion, bereits beantragte Termine mit Antrags-ID.
2. **„Hat sich seit dem [Datum der letzten Transaktion] etwas geändert?“**
   *Nein* → weiter. *Ja* → neue Abrechnungen hochladen oder manuell erfassen, Duplikate werden ignoriert.
3. **Abgleich:** Die Übersicht ist so aufgebaut, dass sie neben den Depotauszug des Brokers gelegt werden kann (Stückzahl pro ISIN). Abweichung = fehlende Transaktion.
4. Bereits beantragte Termine werden nicht erneut angeboten.

Die Bestandsübersicht ist auch außerhalb eines Falls erreichbar: Sidebar **Quellensteuer › Schweiz › Wertpapierbestand**.

---

## 7. Aufgabenliste

**Schweiz**
1. CH-Corridor-Config inkl. `flow`, `requirements`
1a. „Persönliche Daten“: Karte „Steuerliche Angaben“ mit Steuernummer und Finanzamt-Anschrift (Abschnitt 2b); „Anschreiben Finanzamt“ liest die Anschrift aus dem Profil
1b. Automatisches Speichern app-weit inkl. Rückgängig, Validierung und Verlassen-Warnung (Abschnitt 2c)
2. Store `transactions` + Repository (Duplikat- und Lückenprüfung)
3. FIFO-Berechnung (`computeEntitlements(transactions, distributions)`) mit Tests: Referenzfall Jungfraubahn, Fall A, Fall B, Kauf/Verkauf am Ex-Tag, zwei Termine im selben Jahr, zwei Depots
4. Parser Baader-Wertpapierabrechnung (Kauf/Verkauf) und Baader-Tax-Voucher-Anschreiben
5. Wertpapierbestand (Sidebar unter Schweiz) mit „Hat sich etwas geändert?“ und manueller Erfassung
6. ePortal-Spickzettel (`eportalFieldMap.js`): ein Antrag, Jahres-Mehrfachauswahl, Vermögenswerte nach Jahr gruppiert, Antworten auf die Fragen
7. Schritt „Hochladen & abschließen“ inkl. Abschluss-Status und optionalem Erstattungsbetrag
8. Anleitungen „Zugang einrichten“ und „Hochladen im ePortal“ (Platzhalter, Inhalte folgen)
9. Website: Schweiz in `site/_data/countries.yml` auf „verfügbar“

**Gemeinsam / Dänemark**
10. Sidebar: nummerierte Schritte, kurze Bezeichnungen, Breadcrumb „n von N“ (DK und CH)
11. Gemeinsamer Checklisten-Baustein „Unterlagen prüfen“ (CH und DK) mit Bearbeiten direkt ins Profil; Schnappschuss beim Erzeugen des Formulars statt beim Anlegen des Falls, Hinweis bei späterer Profiländerung (Abschnitt 2a)
11a. DK „Fehlende Angaben“: nur wirklich leere Felder, Ansässigkeitszeitraum nur bestätigen
12. Gemeinsamer Baustein „Formular & Finanzamt“ mit Status-Zeitleiste; ersetzt bei DK „Zusammenfassung & Download“
13. DK: „Als eingereicht markieren“ setzt den Fall auf abgeschlossen (gleiche Statistik wie CH)

**Offen:** Beispiel einer Verkaufsabrechnung; Abrechnungen weiterer Broker (comdirect, Trade Republic).
