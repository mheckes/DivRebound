// Italienische Gesellschaften (ISIN -> Name, Codice fiscale, Sitz) für die
// Angaben zum Zahler auf Form A, Seite 4 (docs/konzept-italien.md §4).
// Es gibt keine offene Datenquelle dafür; jeder Eintrag ist einzeln belegt
// (Impressum/Investor Relations bzw. Pflichtmitteilungen, Stand 10/2026).
// Fehlt eine Gesellschaft, trägt DivRebound nur den Namen ein - das genügt.
// Erweiterung: nur mit Quelle aufnehmen, lieber weglassen als raten.

export const ITALIAN_SHARES = {
  IT0005253205: { name: "Italmobiliare S.p.A.", taxCode: "00796400158", address: "Via Borgonuovo 20, 20121 Milano" },
  IT0003128367: { name: "Enel S.p.A.", taxCode: "00811720580", address: "Viale Regina Margherita 137, 00198 Roma" },
  IT0003132476: { name: "Eni S.p.A.", taxCode: "00484960588", address: "Piazzale Enrico Mattei 1, 00144 Roma" },
  IT0000072618: { name: "Intesa Sanpaolo S.p.A.", taxCode: "00799960158", address: "Piazza San Carlo 156, 10121 Torino" },
  IT0005239360: { name: "UniCredit S.p.A.", taxCode: "00348170101", address: "Piazza Gae Aulenti 3, Tower A, 20154 Milano" },
};
