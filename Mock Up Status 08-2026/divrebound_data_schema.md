# DivRebound – Konsolidiertes Datenmodell

Stand: Zusammenführung aller bisher besprochenen Strukturen (Profil, Case, Corridor-Config, Chunking, Export/Import).
`schemaVersion` ist überall vorgesehen, damit spätere Formatänderungen alte Exportdateien nicht brechen.

---

## 1. InvestorProfile

Korridor-übergreifend, personenbezogen, wiederverwendbar über mehrere Länder und Jahre hinweg.

**Mehrnutzer-Prinzip:** Ein `InvestorProfile` gehört immer genau einem Nutzer und liegt ausschließlich
lokal auf dessen Gerät (IndexedDB, kein Server). Es gibt keine geteilte/globale Instanz – jede Vorlage
(Wizard-Screens, Cheat Sheet, generierte Formulare) liest ihre Anzeigewerte zur Laufzeit aus dem Profil
des gerade angemeldeten Nutzers, nie aus fest im Code hinterlegten Beispieldaten. Zwei Personen, die
dieselbe App nutzen, sehen serverseitig identischen Code, aber jeweils nur ihr eigenes Profil.

```typescript
interface InvestorProfile {
  schemaVersion: string;            // z.B. "1.0"
  profileId: string;

  investorType: "private";          // "institutional" bewusst noch nicht implementiert,
                                     // separater Zweig für später (eigenes Formular,
                                     // Art. 10 DBA statt Art. 4, Substanzprüfung etc.)

  heldInPrivateAssets: boolean;     // ersetzt die frühere "Privatanleger vs. institutionell"-Frage;
                                     // deckt auch den Fall "natürliche Person mit Betriebsvermögen" ab

  residence: {
    country: "DE" | "AT" | "CH";
    firstName: string;
    lastName: string;
    birthDate: string;               // ISO 8601
    birthPlace: string;              // Hinweis im UI: "wie im gültigen Reisepass/Personalausweis"
    tin: string;                     // Format je nach residence.country validiert, siehe Abschnitt 5
    email?: string;                  // optional bei SKAT, in echter Einreichung trotzdem ausgefüllt
    phone?: string;                  // optional bei SKAT, inkl. Ländervorwahl
    address: string;                 // Straße + Hausnummer
    postalCode: string;
    city: string;
    // Hinweis: SKAT trennt "Postal code and postal district" und "Town" in zwei
    // eigene Felder. Für deutsche Adressen ohne eigenes Distrikt-Konzept: postalCode
    // -> "Postal code and postal district", city -> "Town". Nicht wie ursprünglich
    // angenommen zu einem Feld ("81377 München") zusammenfassen - echte Einreichung
    // hat beide getrennt ausgefüllt.

    taxOffice: {
      name: string;                  // z.B. "Finanzamt München I" / "Finanzamt Österreich" / kantonale Steuerverwaltung
      address: string;
      lastConfirmed: string;         // ISO 8601 Datum; UI fragt bei jedem neuen Case kurz nach "noch aktuell?"
    };
  };

  bank: {
    // Konto, auf das SKAT die Erstattung überweisen soll ("Payment information" -
    // "Name of bank"). Kann das Depot-/Verrechnungskonto beim Broker sein (in einem
    // echten, erfolgreich eingereichten Fall wurde genau das genutzt - comdirect),
    // muss es aber nicht: entscheidend ist nur, dass das Konto normale SEPA-
    // Überweisungen empfangen kann, nicht ob es beim Broker oder einer Hausbank liegt.
    bankName: string;              // z.B. "comdirect Bank" - freies Textfeld bei SKAT, keine BIC-Ableitung
    accountHolderName: string;     // meist identisch mit residence.firstName + lastName
    accountHolderAddress?: string; // optional bei SKAT
    iban: string;
    bic: string;
    // Hinweis: Wiederverwendung über Korridore hinweg NICHT blind annehmen;
    // pro CorridorConfig.bankRequirements verifizieren (z.B. Fremdwährungsfähigkeit)
  };

  createdAt: string;
  updatedAt: string;
}
```

---

## 2. ReclaimCase

Ein Case = ein Zielland (Corridor) + ein Investor. Kann mehrere Steuerjahre und mehrere Aktienpositionen umfassen.

```typescript
type CaseStatus =
  | "draft"
  | "residency_form_generated"     // Wohnsitzbescheinigung erzeugt/heruntergeladen
  | "awaiting_tax_office"          // wartet auf Bestätigung durch Finanzamt (Medienbruch, 2-3 Wochen)
  | "ready_for_skat_submission"    // Nutzer hat bestätigt: bestätigtes Formular liegt vor
  | "skat_form_verified"           // Nutzer hat bestätigt, im Portal das richtige Formular geöffnet zu haben
  | "submitted";
  // Beim Übergang zu "submitted" (Cheat-Sheet-Seite 6, "Als eingereicht markieren") bietet die UI
  // aktiv an, den Fall als .divrebound.json zu speichern - nicht nur als Backup, sondern bewusst
  // als Jahres-Historie: Beim nächsten Steuerjahr (neuer Case, gleicher Korridor) kann der Nutzer
  // auf diesen abgeschlossenen Fall zurückblicken (welche Werte, welcher Ansässigkeitszeitraum,
  // wann eingereicht), statt bei null anzufangen.

interface ReclaimCase {
  schemaVersion: string;
  caseId: string;
  profileId: string;                // ref → InvestorProfile

  targetCountry: string;             // "DK" (aktuell einziger Corridor), später "CH", "IT", "SE", ...
  status: CaseStatus;

  // Einfache Regel: bei Case-Anlage werden die relevanten Profilangaben (Name, Adresse,
  // TIN, Bank, Finanzamt) einmalig hierher kopiert. Spätere Profiländerungen wirken sich
  // NUR auf neu angelegte Cases aus. Passt ein übernommener Wert in einem bestehenden
  // (offenen oder bereits abgeschlossenen) Case nicht mehr, ändert der Nutzer ihn direkt
  // im jeweiligen Case - kein automatischer Abgleich, keine Sonderfälle pro Feldtyp.
  //
  // Umgekehrter Fall: Erkennt parseDividendCertificate.js beim Anlegen eines neuen Cases
  // aus der Abrechnung einen abweichenden Wert (z.B. neue Adresse nach Umzug), wird das im
  // Screen "Fehlende Angaben ergänzen" als einzeiliger Hinweis neben dem betroffenen Feld
  // angezeigt ("Profil zeigt noch X · auch dort übernehmen"). Ein Klick aktualisiert nur das
  // InvestorProfile, ab dann als Vorschlag für zukünftig neu angelegte Cases - nie rückwirkend
  // auf diesen oder ältere Cases, und nie automatisch ohne diesen Klick.
  applicantSnapshot: {
    firstName: string;
    lastName: string;
    address: string;
    postalCode: string;
    city: string;
    tin: string;
    bank: { name: string; holder: string; bic: string; iban: string };
    taxOffice: { name: string; address: string };
    snapshotTaken: string;             // ISO 8601, wann übernommen
  };

  residencePeriod: {
    from: string;                    // ISO 8601. Default: min(distributions[].paymentDate), im Wizard editierbar
    until: string | null;            // ISO 8601 oder null. Default: null = "andauernd" (leeres "Til"-Feld im Formular)
                                      // NICHT automatisch = max(distributions[].paymentDate) setzen –
                                      // ein offenes Enddatum ist der Normalfall bei durchgehender Ansässigkeit.
                                      // Nur befüllen, wenn der Wohnsitz nachweislich beendet wurde.
  };

  distributions: Distribution[];
  submissionChunks: SubmissionChunk[];
  generatedDocuments: GeneratedDocument[];

  createdAt: string;
  updatedAt: string;
}

interface Distribution {
  distributionId: string;
  sourceFile: string;                // Dateiname der hochgeladenen Dividendenabrechnung (nicht die Datei selbst!)
  isin: string;                      // muss CorridorConfig.isinPrefix entsprechen (z.B. ^DK)
  securityType: "share";             // fix – keine ETFs/Fonds, siehe Abschnitt 5
  issuerName: string;                // z.B. "Novo Nordisk A/S"
  taxYear: number;                   // abgeleitet aus paymentDate
  paymentDate: string;               // ISO 8601
  shares: number;
  grossDividend: number;
  withheldTax: number;
  currency: string;                  // z.B. "DKK"
  extractionConfidence: "extracted" | "user_confirmed" | "user_corrected";
  withinLimitationPeriod: boolean;   // paymentDate innerhalb CorridorConfig.limitationPeriodYears?
}

interface SubmissionChunk {
  chunkIndex: number;                // 1, 2, 3, ... (max. 20 distributions je Chunk bei DK)
  distributionIds: string[];
  status: "pending" | "submitted";
}

interface GeneratedDocument {
  type: "residency_certificate";     // aktuell nur ein Dokumenttyp, erweiterbar
  fileName: string;                  // z.B. "Ansaessigkeitsbescheinigung_DK_Mustermann_2024-2025.pdf"
  generatedAt: string;
}
```

---

## 3. CorridorConfig

Statische Konfiguration pro Zielland – kein Nutzerdaten-Objekt, sondern Teil des Programmcodes/Configs. Ein neues Zielland hinzuzufügen bedeutet: eine neue `CorridorConfig` + einen neuen Extraktions-Parser, der Rest der Wizard-Logik bleibt unverändert.

```typescript
interface CorridorConfig {
  targetCountry: string;                     // "DK"
  residencyCountries: string[];              // ["DE", "AT", "CH"] – wer darf diesen Corridor nutzen
  residencyFormId: string;                   // "02.050"
  onlinePortalUrl: string;
  requiresLogin: boolean;                    // false bei DK (MitID optional, Login-freie Variante existiert)
  maxDistributionsPerClaim: number;          // 20 bei DK
  limitationPeriodYears: number;             // 3 bei DK (Sonderfristen laut DBA möglich, hier vereinfacht)
  standardWithholdingRate: number;           // 0.27 bei DK
  treatyRateByResidence: Record<string, number>; // { DE: 0.15, AT: 0.15, CH: 0.15 }
  isinPrefix: string;                        // "DK"
  nativeCurrency: string;                    // "DKK" – Zielwährung für Brutto-/Steuerbeträge auf der Abrechnung
  bankRequirements?: string;                 // Freitext-Hinweis, falls Fremdwährungskonto nötig ist
}
```

---

## 4. Export-/Import-Datei (`.divrebound.json`)

Client-seitiger Snapshot des Bearbeitungsstands. Enthält **keine** hochgeladenen Roh-PDFs, nur extrahierte/bestätigte Werte. Passwortbasiert verschlüsselt (Web Crypto API, AES-GCM).

```typescript
interface DivReboundExportFile {
  schemaVersion: string;
  exportedAt: string;

  encryption: {
    algorithm: "AES-GCM";
    salt: string;                    // Base64
    iv: string;                      // Base64
  };

  // Der folgende Block ist im unverschlüsselten Zustand die reine Nutzlast;
  // im Datei-Export liegt er als encryptedPayload (Base64) vor.
  payload: {
    investorProfiles: InvestorProfile[];   // i.d.R. genau eins, Array für spätere Mehrpersonen-Fälle offen
    reclaimCases: ReclaimCase[];
  };
}
```

---

## 5. Validierungsregeln (Zusammenfassung)

| Regel | Prüfpunkt | Beispiel/Format |
|---|---|---|
| ISIN-Präfix | Upload/Extraktion | muss `CorridorConfig.isinPrefix` entsprechen, sonst Ablehnung mit Hinweis |
| Nur Aktien | Extraktion | `securityType` fix `"share"`, kein Fonds/ETF-Zweig |
| TIN Deutschland | Eingabe | 11-stellig, rein numerisch |
| TIN Österreich | Eingabe | 9-stellig, Format `FA-NNNNNN-P` |
| TIN Schweiz | Eingabe | 13-stellig, Format `756.NNNN.NNNN.NN` (AHV-Nr. als TIN) |
| Zielland ≠ Wohnsitzland | vor Case-Erstellung | sonst innerstaatlicher Fall, kein Cross-Border-Reclaim |
| DBA-Existenz | vor Case-Erstellung | Wohnsitzland ↔ Zielland |
| Verjährungsfrist | pro Distribution | `paymentDate` vs. `limitationPeriodYears`, Warnung bei Annäherung |
| Chunk-Größe | vor Dokumentengenerierung | `distributions.length > maxDistributionsPerClaim` → automatische Aufteilung |
| Reihenfolge `residencePeriod` | vor Dokumentengenerierung | kann erst berechnet werden, nachdem mind. 1 `distribution` erfasst wurde (Ableitung aus `paymentDate`) |

---

## Offene/nachgelagerte Punkte (bewusst nicht Teil von V1)

- `investorType: "institutional"` – eigener Prozesszweig, referenziert aber nicht implementiert
- Automatische Finanzamt-Zuordnung nach Adresse – im MVP Freitextfeld statt Lookup
- Server-seitige Synchronisation über Geräte hinweg – bewusst nicht vorgesehen, Export/Import-Datei übernimmt diese Rolle
- AT/CH als Zielland (targetCountry) – aktuell nicht Teil des MVP-Scopes, Sätze unten nur als Referenz für später

---

## Anhang: Referenzsätze für zukünftige Corridors (Wohnsitz Deutschland)

Quelle: Bund der Steuerzahler, Stand Januar 2023 – vom Nutzer bereitgestellt, nicht selbst verifiziert.
Nützlich als Ausgangswerte für künftige `CorridorConfig`-Einträge, wenn `targetCountry` über Dänemark hinaus
erweitert wird. Vor Produktivsetzung eines neuen Corridors gegen eine aktuelle Primärquelle (DBA-Text) prüfen,
da sich Sätze seit 2023 geändert haben können.

| Sitzland (targetCountry) | Effektiver nationaler Quellensteuersatz | In Deutschland anrechenbar (treatyRateByResidence.DE) | Erstattungspotenzial |
|---|---|---|---|
| Schweiz | 35 % | 15 % | 20 % |
| Finnland | 35 % | 15 % | 20 % |
| Belgien | 5–30 % | 0 % | 5–30 % |
| Schweden | 30 % | 15 % | 15 % |
| Österreich | 27,5 % | 15 % | 12,5 % |
| Frankreich | 25 % | 12,8 % | 12,2 % |
| **Dänemark** | **15–27 %** | **15 %** | **bis zu 12 %** ✓ (im Code verifiziert, siehe unten) |
| Italien | 26 % | 15 % | 11 % |
| Spanien | 19 % | 15 % | 4 % |
| Japan | 15–15,315 % | 15 % | 0–0,315 % |
| USA | 15 % | 15 % | 0 % |
| Luxemburg, Niederlande | 15 % | 15 % | 0 % |
| Großbritannien | 0 % | 0 % | 0 % |

**Cross-Check für Dänemark:** Die 15 % wurden gegen drei echte Baader/Smartbroker+-Abrechnungen
gegengerechnet (grossDividend × 12 %, umgerechnet zum jeweiligen Tageskurs) – das Ergebnis traf in
allen drei Fällen exakt den von der Bank selbst ausgewiesenen "rückforderbaren Steuerbetrag".
